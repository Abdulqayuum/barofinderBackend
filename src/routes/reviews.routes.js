import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { tutorReviewCreateSchema, tutorReviewUpdateSchema, courseReviewCreateSchema } from '../schemas/review.schema.js';
import { wrap } from '../middleware/error-handler.js';

const router = Router();

router.get('/tutors/:id/reviews', wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query('SELECT * FROM reviews WHERE tutor_id = ? ORDER BY created_at DESC', [id]);
  res.json(rows);
}));

router.post('/tutors/:id/reviews', authMiddleware, validateBody(tutorReviewCreateSchema), wrap(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const [existing] = await db.query('SELECT id FROM reviews WHERE tutor_id = ? AND student_id = ?', [id, req.user.id]);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Review already exists', code: 'CONFLICT' });
  }

  const reviewId = uuid();
  await db.query(
    'INSERT INTO reviews (id, tutor_id, student_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
    [reviewId, id, req.user.id, data.rating, data.comment || null]
  );

  const [rows] = await db.query('SELECT * FROM reviews WHERE id = ?', [reviewId]);
  res.status(201).json(rows[0]);
}));

router.patch('/reviews/:id', authMiddleware, validateBody(tutorReviewUpdateSchema), wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query('SELECT student_id FROM reviews WHERE id = ?', [id]);
  const review = rows[0];
  if (!review) return res.status(404).json({ error: 'Review not found', code: 'NOT_FOUND' });
  if (review.student_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  const updates = req.body;
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    fields.push(`${key} = ?`);
    values.push(updates[key]);
  }
  if (fields.length === 0) return res.json({ message: 'No changes' });

  values.push(id);
  await db.query(`UPDATE reviews SET ${fields.join(', ')} WHERE id = ?`, values);
  const [updated] = await db.query('SELECT * FROM reviews WHERE id = ?', [id]);
  res.json(updated[0]);
}));

router.get('/courses/:id/reviews', wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query('SELECT * FROM course_reviews WHERE course_id = ? ORDER BY created_at DESC', [id]);
  res.json(rows);
}));

router.post('/courses/:id/reviews', authMiddleware, validateBody(courseReviewCreateSchema), wrap(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const [existing] = await db.query('SELECT id FROM course_reviews WHERE course_id = ? AND student_id = ?', [id, req.user.id]);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Review already exists', code: 'CONFLICT' });
  }

  const reviewId = uuid();
  await db.query(
    'INSERT INTO course_reviews (id, course_id, student_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
    [reviewId, id, req.user.id, data.rating, data.comment || null]
  );

  const [rows] = await db.query('SELECT * FROM course_reviews WHERE id = ?', [reviewId]);
  res.status(201).json(rows[0]);
}));

export default router;
