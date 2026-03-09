import { Router } from 'express';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { updateProfileSchema } from '../schemas/profile.schema.js';
import { wrap } from '../middleware/error-handler.js';

const router = Router();

router.get('/me', authMiddleware, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM profiles WHERE user_id = ?', [req.user.id]);
  const profile = rows[0];
  if (!profile) return res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' });
  res.json(profile);
}));

router.patch('/me', authMiddleware, validateBody(updateProfileSchema), wrap(async (req, res) => {
  const updates = req.body;
  const fields = [];
  const values = [];

  for (const key of Object.keys(updates)) {
    fields.push(`${key} = ?`);
    values.push(updates[key]);
  }

  if (fields.length === 0) {
    return res.json({ message: 'No changes', profile: null });
  }

  values.push(req.user.id);
  await db.query(`UPDATE profiles SET ${fields.join(', ')} WHERE user_id = ?`, values);

  const [rows] = await db.query('SELECT * FROM profiles WHERE user_id = ?', [req.user.id]);
  const profile = rows[0];
  res.json({ message: 'Profile updated', profile });
}));

router.get('/:userId', wrap(async (req, res) => {
  const { userId } = req.params;
  const [rows] = await db.query('SELECT * FROM profiles WHERE user_id = ?', [userId]);
  const profile = rows[0];
  if (!profile) return res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' });
  res.json(profile);
}));

export default router;
