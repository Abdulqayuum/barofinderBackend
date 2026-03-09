import db from '../config/database.js';

export function requireRole(...roles) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });

    const [rows] = await db.query(
      'SELECT role FROM user_roles WHERE user_id = ? AND role IN (?)',
      [req.user.id, roles]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
    }
    next();
  };
}

export async function hasRole(userId, role) {
  const [rows] = await db.query(
    'SELECT 1 FROM user_roles WHERE user_id = ? AND role = ?',
    [userId, role]
  );
  return rows.length > 0;
}
