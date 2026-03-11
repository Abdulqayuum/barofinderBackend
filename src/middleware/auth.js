import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import { getJwtSecret } from '../config/security.js';

export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided', code: 'UNAUTHORIZED' });

  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (payload.type !== 'access') {
      return res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
    }
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
      const payload = jwt.verify(token, getJwtSecret());
      if (payload.type === 'access') {
        req.user = { id: payload.sub, email: payload.email };
      }
    } catch {
      // ignore
    }
  }
  next();
}

export async function adminMiddleware(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });

  try {
    const [rows] = await db.query('SELECT role FROM profiles WHERE user_id = ?', [req.user.id]);
    const profile = rows[0];

    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Admin check failed', code: 'INTERNAL_ERROR' });
  }
}
