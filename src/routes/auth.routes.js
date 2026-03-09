import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { loginSchema, refreshSchema, resetPasswordSchema, signupSchema, updatePasswordSchema } from '../schemas/auth.schema.js';
import { wrap } from '../middleware/error-handler.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const JWT_EXPIRES_IN = parseInt(process.env.JWT_EXPIRES_IN || '3600', 10);
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
const EMAIL_VERIFICATION_REQUIRED = process.env.EMAIL_VERIFICATION_REQUIRED === 'true';

function signAccessToken(userId, email) {
  return jwt.sign({ sub: userId, email, type: 'access' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function signRefreshToken(userId) {
  return jwt.sign({ sub: userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
}

async function verifyPassword(inputPassword, storedPasswordHash) {
  if (!storedPasswordHash) return false;
  // Support manual DB inserts during development where password_hash may be plain text.
  if (!storedPasswordHash.startsWith('$2')) {
    return inputPassword === storedPasswordHash;
  }
  return bcrypt.compare(inputPassword, storedPasswordHash);
}

router.post('/signup', validateBody(signupSchema), wrap(async (req, res) => {
  const data = req.body;

  const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [data.email]);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Email already registered', code: 'CONFLICT' });
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);
  const userId = uuid();
  const emailVerified = !EMAIL_VERIFICATION_REQUIRED;
  const verificationToken = EMAIL_VERIFICATION_REQUIRED ? uuid() : null;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'INSERT INTO users (id, email, password_hash, email_verified, verification_token) VALUES (?, ?, ?, ?, ?)',
      [userId, data.email, passwordHash, emailVerified, verificationToken]
    );

    await conn.query(
      `INSERT INTO profiles (user_id, full_name, email, phone, city, role, is_parent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        data.full_name,
        data.email,
        data.phone || null,
        data.city || null,
        data.role || 'student',
        data.is_parent || false
      ]
    );

    await conn.query(
      'INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)',
      [userId, 'user']
    );

    await conn.query(
      'CALL log_activity(?, ?, ?, ?, ?, ?)',
      [userId, 'user.signup', 'user', userId, JSON.stringify({ email: data.email }), req.ip || null]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  res.status(201).json({
    user: { id: userId, email: data.email },
    message: 'Account created successfully'
  });
}));

router.post('/login', validateBody(loginSchema), wrap(async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials', code: 'UNAUTHORIZED' });

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials', code: 'UNAUTHORIZED' });

  if (EMAIL_VERIFICATION_REQUIRED && !user.email_verified) {
    return res.status(403).json({ error: 'Email not verified', code: 'FORBIDDEN' });
  }

  const [profiles] = await db.query('SELECT status FROM profiles WHERE user_id = ?', [user.id]);
  const profile = profiles[0];
  if (profile?.status === 'suspended') {
    return res.status(403).json({ error: 'Account suspended', code: 'FORBIDDEN' });
  }

  const accessToken = signAccessToken(user.id, user.email);
  const refreshToken = signRefreshToken(user.id);

  res.json({
    user: { id: user.id, email: user.email },
    session: { access_token: accessToken, refresh_token: refreshToken, expires_in: JWT_EXPIRES_IN }
  });
}));

router.post('/refresh', validateBody(refreshSchema), wrap(async (req, res) => {
  const { refresh_token } = req.body;
  try {
    const payload = jwt.verify(refresh_token, JWT_SECRET);
    if (payload.type !== 'refresh') throw new Error('Invalid token');
    const [rows] = await db.query('SELECT email FROM users WHERE id = ?', [payload.sub]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid token', code: 'UNAUTHORIZED' });
    const accessToken = signAccessToken(payload.sub, user.email);
    res.json({ access_token: accessToken, expires_in: JWT_EXPIRES_IN });
  } catch {
    res.status(401).json({ error: 'Invalid token', code: 'UNAUTHORIZED' });
  }
}));

router.post('/logout', authMiddleware, wrap(async (_req, res) => {
  res.json({ message: 'Signed out' });
}));

router.post('/reset-password', validateBody(resetPasswordSchema), wrap(async (req, res) => {
  const { email } = req.body;
  const token = uuid();
  const expires = new Date(Date.now() + 1000 * 60 * 30);
  await db.query(
    'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?',
    [token, expires, email]
  );
  res.json({ message: 'If the email exists, a reset link was sent.' });
}));

router.post('/update-password', authMiddleware, validateBody(updatePasswordSchema), wrap(async (req, res) => {
  const { current_password, new_password } = req.body;
  const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });

  if (current_password) {
    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials', code: 'UNAUTHORIZED' });
  }

  const passwordHash = await bcrypt.hash(new_password, BCRYPT_SALT_ROUNDS);
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
  res.json({ message: 'Password updated' });
}));

router.post('/confirm-reset', wrap(async (req, res) => {
  const { token, password } = req.body;
  const [rows] = await db.query(
    'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
    [token]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  await db.query(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
    [passwordHash, user.id]
  );

  res.json({ message: 'Password updated' });
}));

router.get('/me', authMiddleware, wrap(async (req, res) => {
  const [profiles] = await db.query('SELECT * FROM profiles WHERE user_id = ?', [req.user.id]);
  const profile = profiles[0];
  const [roles] = await db.query('SELECT role FROM user_roles WHERE user_id = ?', [req.user.id]);
  res.json({
    user: { id: req.user.id, email: req.user.email },
    profile: profile || null,
    roles: roles.map(r => r.role)
  });
}));

export default router;
