import { Router } from 'express';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { tutorPhotoUpload, courseCoverUpload } from '../config/storage.js';
import { wrap } from '../middleware/error-handler.js';

const router = Router();

router.post('/tutor-photo', authMiddleware, tutorPhotoUpload().single('photo'), wrap(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded', code: 'VALIDATION_ERROR' });

  const url = `${process.env.API_BASE_URL || ''}/uploads/tutor-photos/${file.filename}`;
  await db.query('UPDATE tutor_profiles SET profile_photo_url = ? WHERE user_id = ?', [url, req.user.id]);
  res.json({ url });
}));

router.post('/course-cover', authMiddleware, courseCoverUpload().single('cover'), wrap(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded', code: 'VALIDATION_ERROR' });

  const url = `${process.env.API_BASE_URL || ''}/uploads/course-covers/${file.filename}`;
  res.json({ url });
}));

export default router;
