import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { conversationCreateSchema, messageCreateSchema } from '../schemas/message.schema.js';
import { wrap } from '../middleware/error-handler.js';

const router = Router();

router.get('/', authMiddleware, wrap(async (req, res) => {
  const userId = req.user.id;
  const [rows] = await db.query(
    `SELECT
      c.*,
      (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.is_read = FALSE AND m.sender_id != ?) AS unread_count,
      CASE WHEN c.student_id = ? THEN p2.full_name ELSE p1.full_name END AS other_name,
      CASE WHEN c.student_id = ? THEN p2.email ELSE p1.email END AS other_email
     FROM conversations c
     JOIN profiles p1 ON p1.user_id = c.student_id
     JOIN profiles p2 ON p2.user_id = c.tutor_id
     WHERE c.student_id = ? OR c.tutor_id = ?
     ORDER BY c.updated_at DESC`,
    [userId, userId, userId, userId, userId]
  );

  const data = rows.map(r => ({
    id: r.id,
    student_id: r.student_id,
    tutor_id: r.tutor_id,
    other_user: { full_name: r.other_name, email: r.other_email },
    last_message: r.last_message,
    unread_count: r.unread_count,
    updated_at: r.updated_at
  }));

  res.json(data);
}));

router.post('/', authMiddleware, validateBody(conversationCreateSchema), wrap(async (req, res) => {
  const { student_id, tutor_id } = req.body;
  if (req.user.id !== student_id && req.user.id !== tutor_id) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }

  const [rows] = await db.query(
    'SELECT id FROM conversations WHERE student_id = ? AND tutor_id = ?',
    [student_id, tutor_id]
  );
  const existing = rows[0];
  if (existing) return res.json({ id: existing.id });

  const conversationId = uuid();
  await db.query('INSERT INTO conversations (id, student_id, tutor_id) VALUES (?, ?, ?)', [conversationId, student_id, tutor_id]);
  res.status(201).json({ id: conversationId });
}));

router.get('/:id/messages', authMiddleware, wrap(async (req, res) => {
  const { id } = req.params;
  const [convRows] = await db.query('SELECT * FROM conversations WHERE id = ?', [id]);
  const conv = convRows[0];
  if (!conv) return res.status(404).json({ error: 'Conversation not found', code: 'NOT_FOUND' });
  if (conv.student_id !== req.user.id && conv.tutor_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }

  const [rows] = await db.query('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [id]);
  res.json(rows);
}));

router.post('/:id/messages', authMiddleware, validateBody(messageCreateSchema), wrap(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  const [convRows] = await db.query('SELECT * FROM conversations WHERE id = ?', [id]);
  const conv = convRows[0];
  if (!conv) return res.status(404).json({ error: 'Conversation not found', code: 'NOT_FOUND' });
  if (conv.student_id !== req.user.id && conv.tutor_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }

  const msgId = uuid();
  await db.query(
    'INSERT INTO messages (id, conversation_id, sender_id, content) VALUES (?, ?, ?, ?)',
    [msgId, id, req.user.id, content]
  );

  const recipientId = conv.student_id === req.user.id ? conv.tutor_id : conv.student_id;
  await db.query(
    `INSERT INTO notifications (user_id, type, title, message, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [
      recipientId,
      'new_message',
      'New Message',
      content,
      JSON.stringify({ conversation_id: id, sender_id: req.user.id })
    ]
  );

  const [rows] = await db.query('SELECT * FROM messages WHERE id = ?', [msgId]);
  const message = rows[0];

  const io = req.app.get('io');
  if (io) {
    io.to(`conversation:${id}`).emit('message', message);
  }

  res.status(201).json(message);
}));

router.patch('/:id/messages/read', authMiddleware, wrap(async (req, res) => {
  const { id } = req.params;
  await db.query(
    'UPDATE messages SET is_read = TRUE WHERE conversation_id = ? AND sender_id != ?',
    [id, req.user.id]
  );
  res.json({ message: 'Messages marked as read' });
}));

export default router;
