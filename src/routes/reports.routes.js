import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { wrap } from '../middleware/error-handler.js';
import { tutorReportCreateSchema } from '../schemas/report.schema.js';
import { assertAppSettingEnabled, assertPlatformWritable } from '../utils/app-settings.js';

const router = Router();

function normalizeOptionalId(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function getReportedAccountType(profile) {
  if (!profile) return 'student';
  if (profile.role === 'parent' || profile.is_parent) return 'parent';
  if (profile.role === 'student') return 'student';
  return typeof profile.role === 'string' ? profile.role.toLowerCase() : 'student';
}

async function loadCourseContext({ tutorUserId, targetUserId, enrollmentId = null, courseId = null }) {
  if (enrollmentId) {
    const [rows] = await db.query(
      `SELECT e.id, e.course_id, c.title AS course_title
       FROM course_enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.id = ?
         AND e.student_id = ?
         AND c.user_id = ?
         AND e.status = 'approved'
         ${courseId ? 'AND e.course_id = ?' : ''}
       LIMIT 1`,
      courseId ? [enrollmentId, targetUserId, tutorUserId, courseId] : [enrollmentId, targetUserId, tutorUserId],
    );
    return rows[0] || null;
  }

  if (courseId) {
    const [rows] = await db.query(
      `SELECT e.id, e.course_id, c.title AS course_title
       FROM course_enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.course_id = ?
         AND e.student_id = ?
         AND c.user_id = ?
         AND e.status = 'approved'
       ORDER BY e.created_at DESC
       LIMIT 1`,
      [courseId, targetUserId, tutorUserId],
    );
    return rows[0] || null;
  }

  const [rows] = await db.query(
    `SELECT e.id, e.course_id, c.title AS course_title
     FROM course_enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.student_id = ?
       AND c.user_id = ?
       AND e.status = 'approved'
     ORDER BY e.created_at DESC
     LIMIT 1`,
    [targetUserId, tutorUserId],
  );
  return rows[0] || null;
}

async function loadConversationContext({ tutorUserId, targetUserId, conversationId = null }) {
  if (conversationId) {
    const [rows] = await db.query(
      `SELECT id
       FROM conversations
       WHERE id = ?
         AND tutor_id = ?
         AND student_id = ?
       LIMIT 1`,
      [conversationId, tutorUserId, targetUserId],
    );
    return rows[0] || null;
  }

  const [rows] = await db.query(
    `SELECT id
     FROM conversations
     WHERE tutor_id = ?
       AND student_id = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [tutorUserId, targetUserId],
  );
  return rows[0] || null;
}

router.post('/', authMiddleware, validateBody(tutorReportCreateSchema), wrap(async (req, res) => {
  await assertPlatformWritable();
  await assertAppSettingEnabled('show_tutor_report_button', 'Tutor reporting is currently disabled.');

  const [tutorRows] = await db.query('SELECT id FROM tutor_profiles WHERE user_id = ? LIMIT 1', [req.user.id]);
  if (!tutorRows[0]) {
    return res.status(403).json({ error: 'Only tutors can submit reports.', code: 'FORBIDDEN' });
  }

  const targetUserId = req.body.target_user_id;
  if (targetUserId === req.user.id) {
    return res.status(400).json({ error: 'You cannot report your own account.', code: 'VALIDATION_ERROR' });
  }

  const [targetRows] = await db.query(
    'SELECT user_id, full_name, role, is_parent FROM profiles WHERE user_id = ? LIMIT 1',
    [targetUserId],
  );
  const targetProfile = targetRows[0];
  if (!targetProfile) {
    return res.status(404).json({ error: 'Reported account not found.', code: 'NOT_FOUND' });
  }

  const reportedAccountType = getReportedAccountType(targetProfile);
  if (reportedAccountType !== 'student' && reportedAccountType !== 'parent') {
    return res.status(400).json({ error: 'Tutors can only report student or parent accounts.', code: 'VALIDATION_ERROR' });
  }

  const courseId = normalizeOptionalId(req.body.course_id);
  const enrollmentId = normalizeOptionalId(req.body.enrollment_id);
  const conversationId = normalizeOptionalId(req.body.conversation_id);

  let courseContext = null;
  if (courseId || enrollmentId) {
    courseContext = await loadCourseContext({
      tutorUserId: req.user.id,
      targetUserId,
      courseId,
      enrollmentId,
    });
    if (!courseContext) {
      return res.status(403).json({
        error: 'You can only report learners attached to your approved course enrollments.',
        code: 'FORBIDDEN',
      });
    }
  }

  let conversationContext = null;
  if (conversationId) {
    conversationContext = await loadConversationContext({
      tutorUserId: req.user.id,
      targetUserId,
      conversationId,
    });
    if (!conversationContext) {
      return res.status(403).json({
        error: 'You can only report learners who have an existing conversation with you.',
        code: 'FORBIDDEN',
      });
    }
  }

  if (!courseContext && !conversationContext) {
    courseContext = await loadCourseContext({ tutorUserId: req.user.id, targetUserId });
    conversationContext = await loadConversationContext({ tutorUserId: req.user.id, targetUserId });
  }

  if (!courseContext && !conversationContext) {
    return res.status(403).json({
      error: 'You can only report students or parents who are enrolled with you or messaging you.',
      code: 'FORBIDDEN',
    });
  }

  const [reporterRows] = await db.query(
    'SELECT full_name FROM profiles WHERE user_id = ? LIMIT 1',
    [req.user.id],
  );
  const reporterProfile = reporterRows[0] || { full_name: 'Tutor' };

  const reportId = uuid();
  const sourceType = courseContext ? 'course_enrollment' : conversationContext ? 'conversation' : 'general';

  await db.query(
    `INSERT INTO tutor_reports
      (id, reporter_user_id, target_user_id, reported_user_role, reported_user_is_parent, source_type,
       course_id, enrollment_id, conversation_id, reason_category, description, status, action_taken)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'none')`,
    [
      reportId,
      req.user.id,
      targetUserId,
      reportedAccountType,
      reportedAccountType === 'parent',
      sourceType,
      courseContext?.course_id || null,
      courseContext?.id || null,
      conversationContext?.id || null,
      req.body.reason_category,
      req.body.description.trim(),
    ],
  );

  await db.query(
    `INSERT INTO notifications (user_id, type, title, message, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [
      null,
      'new_report',
      'New Tutor Report',
      `${reporterProfile.full_name || 'A tutor'} reported ${targetProfile.full_name || 'a learner'}.`,
      JSON.stringify({
        report_id: reportId,
        reporter_user_id: req.user.id,
        target_user_id: targetUserId,
      }),
    ],
  );

  await db.query(
    `INSERT INTO notifications (user_id, type, title, message, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [
      req.user.id,
      'report_update',
      'Report Submitted',
      `Your report about ${targetProfile.full_name || 'this account'} was sent to admin review.`,
      JSON.stringify({
        report_id: reportId,
        target_user_id: targetUserId,
      }),
    ],
  );

  const [rows] = await db.query('SELECT * FROM tutor_reports WHERE id = ? LIMIT 1', [reportId]);
  res.status(201).json(rows[0]);
}));

export default router;
