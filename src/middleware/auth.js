import jwt from 'jsonwebtoken';
import db from '../config/database.js';

export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided', code: 'UNAUTHORIZED' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || '');
    req.user = { id: payload.sub, email: payload.email };
    try {
      const [rows] = await db.query('SELECT status FROM profiles WHERE user_id = ?', [req.user.id]);
      const profile = rows[0];
      if (profile?.status === 'suspended') {
        return res.status(403).json({ error: 'Account suspended', code: 'FORBIDDEN' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Auth check failed', code: 'INTERNAL_ERROR' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
  }
}

export function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || '');
      req.user = { id: payload.sub, email: payload.email };
    } catch {
      // ignore
    }
  }
  next();
}
