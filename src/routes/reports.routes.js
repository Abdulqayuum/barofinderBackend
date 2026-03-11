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

function getAccountType(profile) {
  if (!profile) return 'student';
  const role = typeof profile.role === 'string' ? profile.role.toLowerCase() : '';
  if (role === 'tutor' || profile.tutor_profile_id) return 'tutor';
  if (role === 'parent' || profile.is_parent) return 'parent';
  if (role === 'institution') return 'institution';
  if (role === 'admin') return 'admin';
  return 'student';
}

function isLearnerAccountType(accountType) {
  return accountType === 'student' || accountType === 'parent';
}

async function loadProfileWithTutorContext(userId) {
  const [rows] = await db.query(
    `SELECT p.user_id, p.full_name, p.role, p.is_parent, tp.id AS tutor_profile_id
     FROM profiles p
     LEFT JOIN tutor_profiles tp ON tp.user_id = p.user_id
     WHERE p.user_id = ?
     LIMIT 1`,
    [userId],
  );

  return rows[0] || null;
}

async function loadCourseContext({ learnerUserId, tutorUserId, enrollmentId = null, courseId = null }) {
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
      courseId ? [enrollmentId, learnerUserId, tutorUserId, courseId] : [enrollmentId, learnerUserId, tutorUserId],
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
      [courseId, learnerUserId, tutorUserId],
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
    [learnerUserId, tutorUserId],
  );
  return rows[0] || null;
}

async function loadConversationContext({ learnerUserId, tutorUserId, conversationId = null }) {
  if (conversationId) {
    const [rows] = await db.query(
      `SELECT id
       FROM conversations
       WHERE id = ?
         AND tutor_id = ?
         AND student_id = ?
       LIMIT 1`,
      [conversationId, tutorUserId, learnerUserId],
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
    [tutorUserId, learnerUserId],
  );
  return rows[0] || null;
}

router.post('/', authMiddleware, validateBody(tutorReportCreateSchema), wrap(async (req, res) => {
  await assertPlatformWritable();

  const reporterProfile = await loadProfileWithTutorContext(req.user.id);
  if (!reporterProfile) {
    return res.status(404).json({ error: 'Reporter account not found.', code: 'NOT_FOUND' });
  }

  const reporterAccountType = getAccountType(reporterProfile);
  if (reporterAccountType !== 'tutor' && !isLearnerAccountType(reporterAccountType)) {
    return res.status(403).json({ error: 'Only tutors, students, and parents can submit reports.', code: 'FORBIDDEN' });
  }

  const targetUserId = req.body.target_user_id;
  if (targetUserId === req.user.id) {
    return res.status(400).json({ error: 'You cannot report your own account.', code: 'VALIDATION_ERROR' });
  }

  const targetProfile = await loadProfileWithTutorContext(targetUserId);
  if (!targetProfile) {
    return res.status(404).json({ error: 'Reported account not found.', code: 'NOT_FOUND' });
  }

  const reportedAccountType = getAccountType(targetProfile);

  const courseId = normalizeOptionalId(req.body.course_id);
  const enrollmentId = normalizeOptionalId(req.body.enrollment_id);
  const conversationId = normalizeOptionalId(req.body.conversation_id);

  let learnerUserId = null;
  let tutorUserId = null;

  if (reporterAccountType === 'tutor') {
    await assertAppSettingEnabled('show_tutor_report_button', 'Tutor reporting is currently disabled.');
    if (!isLearnerAccountType(reportedAccountType)) {
      return res.status(400).json({ error: 'Tutors can only report student or parent accounts.', code: 'VALIDATION_ERROR' });
    }
    learnerUserId = targetUserId;
    tutorUserId = req.user.id;
  } else {
    await assertAppSettingEnabled(
      'show_learner_report_tutor_button',
      'Student and parent reporting is currently disabled.',
    );
    if (reportedAccountType !== 'tutor') {
      return res.status(400).json({ error: 'Students and parents can only report tutor accounts.', code: 'VALIDATION_ERROR' });
    }
    learnerUserId = req.user.id;
    tutorUserId = targetUserId;
  }

  let courseContext = null;
  if (courseId || enrollmentId) {
    courseContext = await loadCourseContext({
      learnerUserId,
      tutorUserId,
      courseId,
      enrollmentId,
    });
    if (!courseContext) {
      return res.status(403).json({
        error: reporterAccountType === 'tutor'
          ? 'You can only report learners attached to your approved course enrollments.'
          : 'You can only report tutors attached to your approved course enrollments.',
        code: 'FORBIDDEN',
      });
    }
  }

  let conversationContext = null;
  if (conversationId) {
    conversationContext = await loadConversationContext({
      learnerUserId,
      tutorUserId,
      conversationId,
    });
    if (!conversationContext) {
      return res.status(403).json({
        error: reporterAccountType === 'tutor'
          ? 'You can only report learners who have an existing conversation with you.'
          : 'You can only report tutors who have an existing conversation with you.',
        code: 'FORBIDDEN',
      });
    }
  }

  if (!courseContext && !conversationContext) {
    courseContext = await loadCourseContext({ learnerUserId, tutorUserId });
    conversationContext = await loadConversationContext({ learnerUserId, tutorUserId });
  }

  if (reporterAccountType === 'tutor' && !courseContext && !conversationContext) {
    return res.status(403).json({
      error: 'You can only report students or parents who are enrolled with you or messaging you.',
      code: 'FORBIDDEN',
    });
  }

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
      'New Report Submitted',
      `${reporterProfile.full_name || 'A user'} reported ${targetProfile.full_name || 'another account'}.`,
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
