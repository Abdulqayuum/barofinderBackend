import { Router } from 'express';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { updateProfileSchema } from '../schemas/profile.schema.js';
import { wrap } from '../middleware/error-handler.js';
import { toPublicUploadUrl, toStoredUploadPath } from '../utils/uploads.js';

const router = Router();

function toProfileResponse(profile) {
  if (!profile) return profile;
  return {
    ...profile,
    profile_photo_url: toPublicUploadUrl(profile.profile_photo_url),
  };
}

router.get('/me', authMiddleware, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM profiles WHERE user_id = ?', [req.user.id]);
  const profile = rows[0];
  if (!profile) return res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' });
  res.json(toProfileResponse(profile));
}));

router.patch('/me', authMiddleware, validateBody(updateProfileSchema), wrap(async (req, res) => {
  const updates = req.body;
  const fields = [];
  const values = [];

  for (const key of Object.keys(updates)) {
    fields.push(`${key} = ?`);
    values.push(key === 'profile_photo_url' ? toStoredUploadPath(updates[key]) : updates[key]);
  }

  if (fields.length === 0) {
    return res.json({ message: 'No changes', profile: null });
  }

  values.push(req.user.id);
  await db.query(`UPDATE profiles SET ${fields.join(', ')} WHERE user_id = ?`, values);

  const [rows] = await db.query('SELECT * FROM profiles WHERE user_id = ?', [req.user.id]);
  const profile = rows[0];
  res.json({ message: 'Profile updated', profile: toProfileResponse(profile) });
}));

router.get('/:userId', wrap(async (req, res) => {
  const { userId } = req.params;
  const [rows] = await db.query('SELECT * FROM profiles WHERE user_id = ?', [userId]);
  const profile = rows[0];
  if (!profile) return res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' });
  res.json(toProfileResponse(profile));
}));

export default router;
