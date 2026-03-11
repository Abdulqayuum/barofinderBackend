import { Router } from 'express';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { wrap } from '../middleware/error-handler.js';

const router = Router();

function normalizeNotificationRow(row) {
  if (!row) return row;

  let metadata = row.metadata ?? {};
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      metadata = {};
    }
  }

  return {
    ...row,
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
  };
}

router.get('/', authMiddleware, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json(rows.map(normalizeNotificationRow));
}));

router.patch('/:id/read', authMiddleware, wrap(async (req, res) => {
  const { id } = req.params;
  await db.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [id, req.user.id]);
  res.json({ message: 'Notification marked as read' });
}));

router.patch('/read-all', authMiddleware, wrap(async (req, res) => {
  await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
  res.json({ message: 'All notifications marked as read' });
}));

export default router;
