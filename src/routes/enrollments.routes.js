import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { enrollmentCreateSchema, enrollmentUpdateSchema } from '../schemas/enrollment.schema.js';
import { wrap } from '../middleware/error-handler.js';
import { toPublicUploadUrl } from '../utils/uploads.js';
import { assertAppSettingEnabled, assertPlatformWritable } from '../utils/app-settings.js';

const router = Router();

router.post('/courses/:id/enroll', authMiddleware, validateBody(enrollmentCreateSchema), wrap(async (req, res) => {
  await assertPlatformWritable();
  await assertAppSettingEnabled('allow_course_enrollment', 'Course enrollments are currently disabled.');

  const { id } = req.params;
  const data = req.body;

  const [courseRows] = await db.query('SELECT * FROM courses WHERE id = ?', [id]);
  const course = courseRows[0];
  if (!course) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND' });

  const [existing] = await db.query(
    'SELECT id FROM course_enrollments WHERE course_id = ? AND student_id = ?',
    [id, req.user.id]
  );
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Already enrolled', code: 'CONFLICT' });
  }

  const enrollmentId = uuid();
  await db.query(
    `INSERT INTO course_enrollments
     (id, course_id, student_id, status, amount, currency, payment_method, transaction_ref)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
    [
      enrollmentId,
      id,
      req.user.id,
      data.amount ?? course.price ?? null,
      data.currency ?? course.currency ?? null,
      data.payment_method || null,
      data.transaction_ref || null
    ]
  );

  const [rows] = await db.query('SELECT * FROM course_enrollments WHERE id = ?', [enrollmentId]);
  res.status(201).json({
    enrollment: rows[0],
    message: 'Enrollment request submitted. Awaiting tutor approval.'
  });
}));

router.get('/courses/:id/enrollments', authMiddleware, wrap(async (req, res) => {
  const { id } = req.params;
  const [courseRows] = await db.query('SELECT user_id FROM courses WHERE id = ?', [id]);
  const course = courseRows[0];
  if (!course) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND' });
  if (course.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  const [rows] = await db.query(
    `SELECT e.*, p.full_name, p.email
     FROM course_enrollments e
     JOIN profiles p ON p.user_id = e.student_id
     WHERE e.course_id = ?
     ORDER BY e.created_at DESC`,
    [id]
  );
  res.json(rows);
}));

router.patch('/enrollments/:id', authMiddleware, validateBody(enrollmentUpdateSchema), wrap(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const [enrollRows] = await db.query('SELECT * FROM course_enrollments WHERE id = ?', [id]);
  const enrollment = enrollRows[0];
  if (!enrollment) return res.status(404).json({ error: 'Enrollment not found', code: 'NOT_FOUND' });

  const [courseRows] = await db.query('SELECT user_id FROM courses WHERE id = ?', [enrollment.course_id]);
  const course = courseRows[0];
  if (!course || course.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  const enrolledAt = status === 'approved' ? new Date() : null;
  await db.query(
    'UPDATE course_enrollments SET status = ?, enrolled_at = ? WHERE id = ?',
    [status, enrolledAt, id]
  );

  if (status === 'approved' || status === 'rejected') {
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [
        enrollment.student_id,
        status === 'approved' ? 'enrollment_approved' : 'enrollment_rejected',
        status === 'approved' ? 'Enrollment Approved' : 'Enrollment Rejected',
        status === 'approved'
          ? 'Your enrollment was approved.'
          : 'Your enrollment was rejected.',
        JSON.stringify({ enrollment_id: id, course_id: enrollment.course_id })
      ]
    );
  }

  const [rows] = await db.query('SELECT * FROM course_enrollments WHERE id = ?', [id]);
  res.json(rows[0]);
}));

router.delete('/enrollments/:id', authMiddleware, wrap(async (req, res) => {
  const { id } = req.params;

  const [enrollRows] = await db.query('SELECT * FROM course_enrollments WHERE id = ?', [id]);
  const enrollment = enrollRows[0];
  if (!enrollment) return res.status(404).json({ error: 'Enrollment not found', code: 'NOT_FOUND' });

  const [courseRows] = await db.query('SELECT user_id FROM courses WHERE id = ?', [enrollment.course_id]);
  const course = courseRows[0];
  if (!course || course.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  await db.query('DELETE FROM course_enrollments WHERE id = ?', [id]);
  res.json({ message: 'Enrollment deleted' });
}));

router.get('/my-learning', authMiddleware, wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT
       e.*,
       c.title, c.description, c.subject, c.pricing_type, c.price, c.currency, c.cover_image_url,
       (SELECT COUNT(*) FROM course_lessons WHERE course_id = c.id) AS lesson_count
     FROM course_enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.student_id = ?
     ORDER BY e.created_at DESC`,
    [req.user.id]
  );
  res.json(rows.map((row) => ({
    ...row,
    cover_image_url: toPublicUploadUrl(row.cover_image_url),
  })));
}));

export default router;
