import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { courseCreateSchema, courseUpdateSchema } from '../schemas/course.schema.js';
import { getPagination } from '../utils/pagination.js';
import { wrap } from '../middleware/error-handler.js';
import { toPublicUploadUrl, toStoredUploadPath } from '../utils/uploads.js';

const router = Router();

function toNumericPrice(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function resolvePricingType(course) {
  if (course?.pricing_type === 'free' || course?.pricing_type === 'paid') {
    return course.pricing_type;
  }

  return toNumericPrice(course?.price) > 0 ? 'paid' : 'free';
}

function normalizeCoursePayload(payload, existingCourse = null) {
  const hasPrice = Object.prototype.hasOwnProperty.call(payload, 'price');
  const hasPricingType = Object.prototype.hasOwnProperty.call(payload, 'pricing_type');

  if (!hasPrice && !hasPricingType) {
    return { payload };
  }

  const nextPrice = hasPrice ? toNumericPrice(payload.price) : toNumericPrice(existingCourse?.price);
  const pricing_type = hasPricingType
    ? payload.pricing_type
    : hasPrice
      ? (nextPrice > 0 ? 'paid' : 'free')
      : resolvePricingType(existingCourse);

  if (pricing_type === 'paid' && nextPrice <= 0) {
    return { error: 'Paid courses must have a price greater than 0' };
  }

  return {
    payload: {
      ...payload,
      pricing_type,
      price: pricing_type === 'free' ? 0 : nextPrice,
    },
  };
}

function toCourseResponse(course) {
  if (!course) return course;

  return {
    ...course,
    pricing_type: resolvePricingType(course),
    cover_image_url: toPublicUploadUrl(course.cover_image_url),
    tutor_photo: toPublicUploadUrl(course.tutor_photo),
  };
}

router.get('/', wrap(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const filters = ['c.is_published = TRUE'];
  const params = [];

  if (req.query.subject) {
    filters.push('c.subject = ?');
    params.push(req.query.subject);
  }

  if (req.query.pricing_type === 'free' || req.query.pricing_type === 'paid') {
    filters.push(`COALESCE(c.pricing_type, CASE WHEN c.price > 0 THEN 'paid' ELSE 'free' END) = ?`);
    params.push(req.query.pricing_type);
  }

  if (req.query.q) {
    filters.push('(c.title LIKE ? OR c.description LIKE ?)');
    const q = `%${req.query.q}%`;
    params.push(q, q);
  }

  const where = filters.join(' AND ');

  const [rows] = await db.query(
    `SELECT c.*, p.full_name AS tutor_name, tp.profile_photo_url AS tutor_photo, tp.verified_badge AS tutor_verified
     FROM courses c
     JOIN tutor_profiles tp ON tp.id = c.tutor_id
     JOIN profiles p ON p.user_id = tp.user_id
     WHERE ${where}
     ORDER BY c.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM courses c WHERE ${where}`,
    params
  );

  const total = countRows[0]?.total || 0;
  res.json({
    courses: rows.map(toCourseResponse),
    total,
    page,
    totalPages: Math.ceil(total / limit)
  });
}));

router.get('/my-courses', authMiddleware, wrap(async (req, res) => {
  const [rows] = await db.query(
    'SELECT * FROM courses WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(rows.map(toCourseResponse));
}));

router.get('/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query('SELECT * FROM courses WHERE id = ?', [id]);
  const course = rows[0];
  if (!course) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND' });

  const [tutorRows] = await db.query(
    `SELECT p.full_name AS name, tp.profile_photo_url AS photo, tp.verified_badge AS verified
     FROM tutor_profiles tp JOIN profiles p ON p.user_id = tp.user_id WHERE tp.id = ?`,
    [course.tutor_id]
  );
  const tutor = tutorRows[0] || null;

  const [lessons] = await db.query('SELECT * FROM course_lessons WHERE course_id = ? ORDER BY sort_order ASC', [id]);
  const [quizzes] = await db.query('SELECT * FROM course_quizzes WHERE course_id = ? ORDER BY sort_order ASC', [id]);
  const [enrollCount] = await db.query('SELECT COUNT(*) AS count FROM course_enrollments WHERE course_id = ? AND status = "approved"', [id]);
  const [reviews] = await db.query('SELECT AVG(rating) AS average, COUNT(*) AS count FROM course_reviews WHERE course_id = ?', [id]);

  const avg = reviews[0]?.average || 0;
  const avgNum = typeof avg === 'string' ? parseFloat(avg) : Number(avg);

  res.json({
    course: toCourseResponse(course),
    tutor: tutor ? { ...tutor, photo: toPublicUploadUrl(tutor.photo) } : null,
    lessons,
    quizzes,
    enrollment_count: enrollCount[0]?.count || 0,
    reviews: {
      average: avgNum,
      count: reviews[0]?.count || 0
    }
  });
}));

router.post('/', authMiddleware, validateBody(courseCreateSchema), wrap(async (req, res) => {
  const normalized = normalizeCoursePayload(req.body);
  if (normalized.error) {
    return res.status(400).json({ error: normalized.error, code: 'VALIDATION_ERROR' });
  }

  const data = normalized.payload;
  const [tutorRows] = await db.query('SELECT id FROM tutor_profiles WHERE user_id = ?', [req.user.id]);
  const tutor = tutorRows[0];
  if (!tutor) return res.status(403).json({ error: 'Tutor profile required', code: 'FORBIDDEN' });

  const courseId = uuid();
  await db.query(
    `INSERT INTO courses (id, tutor_id, user_id, title, description, subject, pricing_type, price, currency, max_students, cover_image_url, is_published, status, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      courseId,
      tutor.id,
      req.user.id,
      data.title,
      data.description || null,
      data.subject || null,
      data.pricing_type,
      data.price,
      data.currency || 'USD',
      data.max_students || 20,
      toStoredUploadPath(data.cover_image_url),
      data.is_published || false,
      data.status || 'draft',
      data.start_date || null,
      data.end_date || null
    ]
  );

  const [rows] = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);
  res.status(201).json(toCourseResponse(rows[0]));
}));

router.patch('/:id', authMiddleware, validateBody(courseUpdateSchema), wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query('SELECT user_id, price, pricing_type FROM courses WHERE id = ?', [id]);
  const course = rows[0];
  if (!course) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND' });
  if (course.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  const normalized = normalizeCoursePayload(req.body, course);
  if (normalized.error) {
    return res.status(400).json({ error: normalized.error, code: 'VALIDATION_ERROR' });
  }

  const updates = normalized.payload;
  const fields = [];
  const values = [];

  for (const key of Object.keys(updates)) {
    fields.push(`${key} = ?`);
    values.push(key === 'cover_image_url' ? toStoredUploadPath(updates[key]) : updates[key]);
  }
  if (fields.length === 0) return res.json({ message: 'No changes' });

  values.push(id);
  await db.query(`UPDATE courses SET ${fields.join(', ')} WHERE id = ?`, values);
  const [updated] = await db.query('SELECT * FROM courses WHERE id = ?', [id]);
  res.json(toCourseResponse(updated[0]));
}));

router.delete('/:id', authMiddleware, wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query('SELECT user_id FROM courses WHERE id = ?', [id]);
  const course = rows[0];
  if (!course) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND' });
  if (course.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  await db.query('DELETE FROM courses WHERE id = ?', [id]);
  res.json({ message: 'Course deleted' });
}));

router.get('/tutor/student-progress', authMiddleware, wrap(async (req, res) => {
  // First, get all courses owned by this tutor
  const [courses] = await db.query('SELECT id, title FROM courses WHERE user_id = ?', [req.user.id]);
  if (courses.length === 0) return res.json({ enrollments: [], lessons: [], progress: [], profiles: [] });

  const courseIds = courses.map(c => c.id);

  // Get approved enrollments
  const [enrollments] = await db.query(
    'SELECT * FROM course_enrollments WHERE course_id IN (?) AND status = "approved"',
    [courseIds]
  );

  // Get lessons
  const [lessons] = await db.query(
    'SELECT id, course_id, title, sort_order FROM course_lessons WHERE course_id IN (?) ORDER BY sort_order ASC',
    [courseIds]
  );

  // Get progress
  const [progress] = await db.query(
    'SELECT student_id, lesson_id, course_id, completed, completed_at FROM lesson_progress WHERE course_id IN (?)',
    [courseIds]
  );

  // Get student profiles
  const studentIds = [...new Set(enrollments.map(e => e.student_id))];
  let profiles = [];
  if (studentIds.length > 0) {
    const [pRows] = await db.query(
      'SELECT user_id, full_name, email FROM profiles WHERE user_id IN (?)',
      [studentIds]
    );
    profiles = pRows;
  }

  res.json({ enrollments, lessons, progress, profiles });
}));

export default router;
