import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../config/database.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { lessonCreateSchema, lessonUpdateSchema, lessonReorderSchema } from '../schemas/course.schema.js';
import { wrap } from '../middleware/error-handler.js';

const router = Router();

router.get('/courses/:id/lessons', optionalAuth, wrap(async (req, res) => {
  const { id } = req.params;
  const [courseRows] = await db.query('SELECT user_id, is_published FROM courses WHERE id = ?', [id]);
  const course = courseRows[0];
  if (!course) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND' });

  const isOwner = req.user && course.user_id === req.user.id;
  if (!course.is_published && !isOwner) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }

  const [rows] = await db.query('SELECT * FROM course_lessons WHERE course_id = ? ORDER BY sort_order ASC', [id]);
  res.json(rows);
}));

router.post('/courses/:id/lessons', authMiddleware, validateBody(lessonCreateSchema), wrap(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const [courseRows] = await db.query('SELECT user_id FROM courses WHERE id = ?', [id]);
  const course = courseRows[0];
  if (!course) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND' });
  if (course.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  const lessonId = uuid();
  await db.query(
    `INSERT INTO course_lessons (id, course_id, title, description, content_type, content_url, external_url, text_content, duration_minutes, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      lessonId,
      id,
      data.title,
      data.description || null,
      data.content_type || 'text',
      data.content_url || null,
      data.external_url || null,
      data.text_content || null,
      data.duration_minutes || null,
      data.sort_order || 0
    ]
  );

  const [rows] = await db.query('SELECT * FROM course_lessons WHERE id = ?', [lessonId]);
  res.status(201).json(rows[0]);
}));

router.patch('/lessons/:id', authMiddleware, validateBody(lessonUpdateSchema), wrap(async (req, res) => {
  const { id } = req.params;
  const [lessonRows] = await db.query(
    `SELECT l.id, c.user_id
     FROM course_lessons l JOIN courses c ON c.id = l.course_id
     WHERE l.id = ?`,
    [id]
  );
  const lesson = lessonRows[0];
  if (!lesson) return res.status(404).json({ error: 'Lesson not found', code: 'NOT_FOUND' });
  if (lesson.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  const updates = req.body;
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    fields.push(`${key} = ?`);
    values.push(updates[key]);
  }
  if (fields.length === 0) return res.json({ message: 'No changes' });

  values.push(id);
  await db.query(`UPDATE course_lessons SET ${fields.join(', ')} WHERE id = ?`, values);
  const [rows] = await db.query('SELECT * FROM course_lessons WHERE id = ?', [id]);
  res.json(rows[0]);
}));

router.delete('/lessons/:id', authMiddleware, wrap(async (req, res) => {
  const { id } = req.params;
  const [lessonRows] = await db.query(
    `SELECT l.id, c.user_id
     FROM course_lessons l JOIN courses c ON c.id = l.course_id
     WHERE l.id = ?`,
    [id]
  );
  const lesson = lessonRows[0];
  if (!lesson) return res.status(404).json({ error: 'Lesson not found', code: 'NOT_FOUND' });
  if (lesson.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  await db.query('DELETE FROM course_lessons WHERE id = ?', [id]);
  res.json({ message: 'Lesson deleted' });
}));

router.patch('/lessons/:id/reorder', authMiddleware, validateBody(lessonReorderSchema), wrap(async (req, res) => {
  const { id } = req.params;
  const { sort_order } = req.body;

  const [lessonRows] = await db.query(
    `SELECT l.id, c.user_id
     FROM course_lessons l JOIN courses c ON c.id = l.course_id
     WHERE l.id = ?`,
    [id]
  );
  const lesson = lessonRows[0];
  if (!lesson) return res.status(404).json({ error: 'Lesson not found', code: 'NOT_FOUND' });
  if (lesson.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  await db.query('UPDATE course_lessons SET sort_order = ? WHERE id = ?', [sort_order, id]);
  const [rows] = await db.query('SELECT * FROM course_lessons WHERE id = ?', [id]);
  res.json(rows[0]);
}));

router.post('/lessons/:id/complete', authMiddleware, wrap(async (req, res) => {
  const { id } = req.params;
  const [lessonRows] = await db.query('SELECT course_id FROM course_lessons WHERE id = ?', [id]);
  const lesson = lessonRows[0];
  if (!lesson) return res.status(404).json({ error: 'Lesson not found', code: 'NOT_FOUND' });

  const [existing] = await db.query(
    'SELECT id FROM lesson_progress WHERE student_id = ? AND lesson_id = ?',
    [req.user.id, id]
  );

  if (existing.length === 0) {
    await db.query(
      'INSERT INTO lesson_progress (student_id, course_id, lesson_id, completed, completed_at) VALUES (?, ?, ?, TRUE, NOW())',
      [req.user.id, lesson.course_id, id]
    );
  } else {
    // Toggle
    const current = await db.query('SELECT completed FROM lesson_progress WHERE id = ?', [existing[0].id]);
    const newState = !current[0][0].completed;
    await db.query(
      'UPDATE lesson_progress SET completed = ?, completed_at = ? WHERE id = ?',
      [newState, newState ? new Date() : null, existing[0].id]
    );
  }

  const [completedRows] = await db.query(
    'SELECT COUNT(*) AS completed FROM lesson_progress WHERE student_id = ? AND course_id = ? AND completed = TRUE',
    [req.user.id, lesson.course_id]
  );
  const [totalRows] = await db.query(
    'SELECT COUNT(*) AS total FROM course_lessons WHERE course_id = ?',
    [lesson.course_id]
  );

  const completed = completedRows[0]?.completed || 0;
  const total = totalRows[0]?.total || 0;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  res.json({
    lesson_progress: { completed: true, completed_at: new Date().toISOString() },
    course_progress: { completed, total, percentage }
  });
}));

router.get('/courses/:id/progress', authMiddleware, wrap(async (req, res) => {
  const { id } = req.params;
  const [completedRows] = await db.query(
    'SELECT COUNT(*) AS completed FROM lesson_progress WHERE student_id = ? AND course_id = ? AND completed = TRUE',
    [req.user.id, id]
  );
  const [totalRows] = await db.query('SELECT COUNT(*) AS total FROM course_lessons WHERE course_id = ?', [id]);

  const completed = completedRows[0]?.completed || 0;
  const total = totalRows[0]?.total || 0;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  res.json({ completed, total, percentage });
}));

router.get('/courses/:id/all-progress', authMiddleware, wrap(async (req, res) => {
  const { id } = req.params;
  const [courseRows] = await db.query('SELECT user_id FROM courses WHERE id = ?', [id]);
  const course = courseRows[0];
  if (!course) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND' });
  if (course.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  const [rows] = await db.query(
    'SELECT student_id, lesson_id, completed FROM lesson_progress WHERE course_id = ?',
    [id]
  );
  res.json(rows);
}));

router.get('/my-progress', authMiddleware, wrap(async (req, res) => {
  const [rows] = await db.query(
    'SELECT course_id, lesson_id, completed FROM lesson_progress WHERE student_id = ?',
    [req.user.id]
  );
  res.json(rows);
}));

export default router;
