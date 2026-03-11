import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { validateBody } from '../middleware/validation.js';
import { wrap } from '../middleware/error-handler.js';
import { v4 as uuid } from 'uuid';
import { toPublicUploadDocuments, toPublicUploadUrl, toStoredUploadDocuments, toStoredUploadPath } from '../utils/uploads.js';
import { getAppSettingValue, listAppSettings, serializeAppSettingValue } from '../utils/app-settings.js';
import { adminTutorReportUpdateSchema } from '../schemas/report.schema.js';

const router = Router();
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
const PROFILE_ROLES = new Set(['student', 'parent', 'tutor', 'institution']);
const PROFILE_STATUSES = new Set(['active', 'suspended']);
const TUTOR_VERIFICATION_STATUSES = new Set(['pending', 'verified', 'rejected', 'suspended']);
const INSTITUTION_APPROVAL_STATUSES = new Set(['pending', 'approved', 'rejected', 'suspended']);
const INSTITUTION_TYPES = new Set(['school', 'university', 'college', 'academy', 'training_center', 'other']);
const REPORT_STATUSES = new Set(['pending', 'reviewing', 'resolved', 'dismissed']);
const REPORT_ACTIONS = new Set(['none', 'warning_sent', 'account_suspended', 'no_action']);

router.use(authMiddleware);
router.use(requireRole('admin'));

function normalizeTrimmedString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeOptionalString(value) {
  const normalized = normalizeTrimmedString(value);
  return normalized || null;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return fallback;

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  return fallback;
}

function normalizeNumber(value, fallback = 0, { nullable = false } = {}) {
  if (value == null || value === '') return nullable ? null : fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return nullable ? null : fallback;
  return numeric;
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => normalizeTrimmedString(String(item))).filter(Boolean))];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      return normalizeStringArray(parsed);
    } catch {
      return [...new Set(trimmed.split(',').map((item) => item.trim()).filter(Boolean))];
    }
  }

  return [];
}

function normalizeJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeEmail(value) {
  const normalized = normalizeTrimmedString(value).toLowerCase();
  return normalized || null;
}

function normalizePassword(value) {
  return typeof value === 'string' ? value : '';
}

function toAdminTutorResponse(tutor) {
  if (!tutor) return null;

  return {
    ...tutor,
    email_verified: !!tutor.email_verified,
    open_to_work: !!tutor.open_to_work,
    online_available: !!tutor.online_available,
    offline_available: !!tutor.offline_available,
    verified_badge: !!tutor.verified_badge,
    profile_photo_url: toPublicUploadUrl(tutor.profile_photo_url),
    subjects: normalizeJsonArray(tutor.subjects),
    levels: normalizeJsonArray(tutor.levels),
    languages: normalizeJsonArray(tutor.languages),
    service_areas: normalizeJsonArray(tutor.service_areas),
    availability: normalizeJsonArray(tutor.availability),
    packages: normalizeJsonArray(tutor.packages),
    verification_documents: toPublicUploadDocuments(normalizeJsonArray(tutor.verification_documents)),
    profile: {
      full_name: tutor.full_name,
      email: tutor.email,
      phone: tutor.phone || null,
      city: tutor.city || null,
    },
  };
}

function toAdminInstitutionResponse(institution) {
  if (!institution) return null;

  return {
    ...institution,
    email_verified: !!institution.email_verified,
    job_count: Number(institution.job_count || 0),
    profile: {
      full_name: institution.full_name,
      email: institution.email,
      phone: institution.phone || null,
      city: institution.city || null,
    },
  };
}

function toAdminAdResponse(ad) {
  if (!ad) return null;

  return {
    ...ad,
    image_url: toPublicUploadUrl(ad.image_url),
  };
}

function toAdminTutorReportResponse(report) {
  if (!report) return null;

  return {
    ...report,
    reporter_is_parent: !!report.reporter_is_parent,
    reported_user_is_parent: !!report.reported_user_is_parent,
  };
}

async function loadAdminTutorReportById(reportId, executor = db) {
  const [rows] = await executor.query(
    `SELECT
      tr.*,
      reporter.full_name AS reporter_name,
      reporter.email AS reporter_email,
      reporter.role AS reporter_role,
      reporter.is_parent AS reporter_is_parent,
      target.full_name AS target_name,
      target.email AS target_email,
      target.status AS target_status,
      c.title AS course_title,
      reviewer.full_name AS reviewed_by_name
     FROM tutor_reports tr
     JOIN profiles reporter ON reporter.user_id = tr.reporter_user_id
     JOIN profiles target ON target.user_id = tr.target_user_id
     LEFT JOIN courses c ON c.id = tr.course_id
     LEFT JOIN profiles reviewer ON reviewer.user_id = tr.reviewed_by
     WHERE tr.id = ?
     LIMIT 1`,
    [reportId],
  );

  return toAdminTutorReportResponse(rows[0] || null);
}

async function loadAdminUserById(userId, executor = db) {
  const [rows] = await executor.query(
    `SELECT p.*, u.email_verified, u.created_at AS user_created_at
     FROM profiles p
     JOIN users u ON u.id = p.user_id
     WHERE p.user_id = ?
     LIMIT 1`,
    [userId]
  );

  const profile = rows[0];
  if (!profile) return null;

  const [roleRows] = await executor.query('SELECT role FROM user_roles WHERE user_id = ?', [userId]);

  return {
    ...profile,
    email_verified: !!profile.email_verified,
    is_parent: !!profile.is_parent,
    subjects_interested: normalizeStringArray(profile.subjects_interested),
    app_roles: roleRows.map((row) => row.role),
  };
}

async function loadAdminTutorById(tutorId, executor = db) {
  const [rows] = await executor.query(
    `SELECT tp.*, p.full_name, p.email, p.phone, p.city, p.status, u.email_verified
     FROM tutor_profiles tp
     JOIN profiles p ON p.user_id = tp.user_id
     JOIN users u ON u.id = tp.user_id
     WHERE tp.id = ?
     LIMIT 1`,
    [tutorId]
  );

  return toAdminTutorResponse(rows[0] || null);
}

async function loadAdminInstitutionById(institutionId, executor = db) {
  const [rows] = await executor.query(
    `SELECT
      ip.*,
      p.full_name,
      p.email,
      p.phone,
      p.city,
      p.status,
      u.email_verified,
      (
        SELECT COUNT(*)
        FROM institution_jobs ij
        WHERE ij.institution_id = ip.id
      ) AS job_count
     FROM institution_profiles ip
     JOIN profiles p ON p.user_id = ip.user_id
     JOIN users u ON u.id = ip.user_id
     WHERE ip.id = ?
     LIMIT 1`,
    [institutionId]
  );

  return toAdminInstitutionResponse(rows[0] || null);
}

function getInstitutionApprovalNotification(status) {
  switch (status) {
    case 'approved':
      return {
        title: 'Institution Approved',
        message: 'Your institution profile has been approved. You can now publish tutor jobs.',
      };
    case 'rejected':
      return {
        title: 'Institution Review Update',
        message: 'Your institution profile was rejected. Please update your details and resubmit for approval.',
      };
    case 'suspended':
      return {
        title: 'Institution Suspended',
        message: 'Your institution profile has been suspended by an administrator.',
      };
    default:
      return {
        title: 'Institution Review Pending',
        message: 'Your institution profile is pending admin review.',
      };
  }
}

router.get('/overview', wrap(async (_req, res) => {
  const [[totalUsers]] = await db.query('SELECT COUNT(*) AS total_users FROM profiles');
  const [[totalTutors]] = await db.query('SELECT COUNT(*) AS total_tutors FROM tutor_profiles');
  const [[totalInstitutions]] = await db.query('SELECT COUNT(*) AS total_institutions FROM institution_profiles');
  const [[pendingTutorApprovals]] = await db.query("SELECT COUNT(*) AS pending_approvals FROM tutor_profiles WHERE verification_status = 'pending'");
  const [[pendingInstitutionApprovals]] = await db.query("SELECT COUNT(*) AS pending_approvals FROM institution_profiles WHERE approval_status = 'pending'");
  const [[activeSubs]] = await db.query("SELECT COUNT(*) AS active_subs, COALESCE(SUM(amount), 0) AS total_revenue FROM subscriptions WHERE status = 'active'");
  const [[totalCourses]] = await db.query('SELECT COUNT(*) AS total_courses FROM courses');
  const [[publishedCourses]] = await db.query('SELECT COUNT(*) AS published_courses FROM courses WHERE is_published = 1 AND status != "suspended"');
  const [[totalEnrollments]] = await db.query('SELECT COUNT(*) AS total_enrollments FROM course_enrollments');
  const [[pendingEnrollments]] = await db.query('SELECT COUNT(*) AS pending_enrollments FROM course_enrollments WHERE status = "pending"');

  const [recentUsers] = await db.query(
    'SELECT p.full_name, p.email, p.role, p.created_at FROM profiles p ORDER BY p.created_at DESC LIMIT 5'
  );

  const [recentTutors] = await db.query(
    `SELECT p.full_name AS name, tp.verification_status AS status, tp.created_at 
     FROM tutor_profiles tp JOIN profiles p ON p.user_id = tp.user_id 
     ORDER BY tp.created_at DESC LIMIT 5`
  );

  const [revenueData] = await db.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(amount) AS revenue 
     FROM subscriptions WHERE status = 'active'
     GROUP BY month ORDER BY month DESC LIMIT 6`
  );

  const [enrollmentStatusData] = await db.query(
    'SELECT status, COUNT(*) AS count FROM course_enrollments GROUP BY status'
  );

  res.json({
    total_users: totalUsers.total_users,
    total_tutors: totalTutors.total_tutors,
    total_institutions: totalInstitutions.total_institutions,
    pending_approvals: pendingTutorApprovals.pending_approvals + pendingInstitutionApprovals.pending_approvals,
    active_subs: activeSubs.active_subs,
    total_revenue: activeSubs.total_revenue,
    total_courses: totalCourses.total_courses,
    published_courses: publishedCourses.published_courses,
    total_enrollments: totalEnrollments.total_enrollments,
    pending_enrollments: pendingEnrollments.pending_enrollments,
    recent_users: recentUsers,
    recent_tutors: recentTutors,
    revenue_data: revenueData.reverse(),
    enrollment_status: enrollmentStatusData
  });
}));

router.get('/users', wrap(async (req, res) => {
  const q = req.query.q ? `%${req.query.q}%` : null;
  const roleMap = {};
  const [rows] = await db.query(
    `SELECT p.*, u.email_verified, u.created_at AS user_created_at
     FROM profiles p JOIN users u ON u.id = p.user_id
     ${q ? 'WHERE p.full_name LIKE ? OR p.email LIKE ? OR p.phone LIKE ?' : ''}
     ORDER BY p.created_at DESC`,
    q ? [q, q, q] : []
  );

  if (rows.length > 0) {
    const userIds = rows.map((row) => row.user_id);
    const [roleRows] = await db.query('SELECT user_id, role FROM user_roles WHERE user_id IN (?)', [userIds]);
    roleRows.forEach((roleRow) => {
      if (!roleMap[roleRow.user_id]) roleMap[roleRow.user_id] = [];
      roleMap[roleRow.user_id].push(roleRow.role);
    });
  }

  res.json(rows.map((row) => ({
    ...row,
    email_verified: !!row.email_verified,
    is_parent: !!row.is_parent,
    subjects_interested: normalizeStringArray(row.subjects_interested),
    app_roles: roleMap?.[row.user_id] || [],
  })));
}));

router.post('/users', wrap(async (req, res) => {
  const fullName = normalizeTrimmedString(req.body.full_name);
  const email = normalizeEmail(req.body.email);
  const password = normalizePassword(req.body.password);
  const role = normalizeTrimmedString(req.body.role || 'student').toLowerCase();
  const status = normalizeTrimmedString(req.body.status || 'active').toLowerCase();
  const phone = normalizeOptionalString(req.body.phone);
  const city = normalizeOptionalString(req.body.city);
  const studentLevel = normalizeOptionalString(req.body.student_level);
  const subjectsInterested = normalizeStringArray(req.body.subjects_interested);
  const emailVerified = normalizeBoolean(req.body.email_verified, true);
  const grantAdmin = normalizeBoolean(req.body.grant_admin, false);

  if (!fullName) {
    return res.status(400).json({ error: 'Full name is required', code: 'BAD_REQUEST' });
  }
  if (!email) {
    return res.status(400).json({ error: 'Email is required', code: 'BAD_REQUEST' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters', code: 'BAD_REQUEST' });
  }
  if (!PROFILE_ROLES.has(role)) {
    return res.status(400).json({ error: 'Invalid role', code: 'BAD_REQUEST' });
  }
  if (role === 'tutor') {
    return res.status(400).json({ error: 'Create tutor accounts from the Tutors page', code: 'BAD_REQUEST' });
  }
  if (role === 'institution') {
    return res.status(400).json({ error: 'Create institution accounts from the Institutions page', code: 'BAD_REQUEST' });
  }
  if (!PROFILE_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid status', code: 'BAD_REQUEST' });
  }

  const [existing] = await db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Email already registered', code: 'CONFLICT' });
  }

  const userId = uuid();
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const isParent = role === 'parent';

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      'INSERT INTO users (id, email, password_hash, email_verified) VALUES (?, ?, ?, ?)',
      [userId, email, passwordHash, emailVerified]
    );

    await conn.query(
      `INSERT INTO profiles (user_id, full_name, email, phone, city, role, status, is_parent, student_level, subjects_interested)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        fullName,
        email,
        phone,
        city,
        role,
        status,
        isParent,
        studentLevel,
        JSON.stringify(subjectsInterested),
      ]
    );

    await conn.query('INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)', [userId, 'user']);
    if (grantAdmin) {
      await conn.query('INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)', [userId, 'admin']);
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  const created = await loadAdminUserById(userId);
  res.status(201).json(created);
}));

router.patch('/users/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query(
    `SELECT
      p.user_id,
      p.full_name,
      p.email,
      p.phone,
      p.city,
      p.role,
      p.is_parent,
      tp.id AS tutor_profile_id,
      ip.id AS institution_profile_id
     FROM profiles p
     LEFT JOIN tutor_profiles tp ON tp.user_id = p.user_id
     LEFT JOIN institution_profiles ip ON ip.user_id = p.user_id
     WHERE p.user_id = ?
     LIMIT 1`,
    [id]
  );

  const existing = rows[0];
  if (!existing) {
    return res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' });
  }

  const profileFields = [];
  const profileValues = [];
  const userFields = [];
  const userValues = [];
  let nextFullName = existing.full_name;
  let nextEmail = existing.email;
  let nextPhone = existing.phone || null;
  let nextCity = existing.city || null;
  let createTutorProfile = false;
  let createInstitutionProfile = false;

  let requestedRole = existing.role;
  if (req.body.role !== undefined) {
    requestedRole = normalizeTrimmedString(req.body.role).toLowerCase();
    if (!PROFILE_ROLES.has(requestedRole)) {
      return res.status(400).json({ error: 'Invalid role', code: 'BAD_REQUEST' });
    }
    if (existing.tutor_profile_id && requestedRole !== 'tutor') {
      return res.status(400).json({ error: 'Tutor accounts must be managed from the Tutors page', code: 'BAD_REQUEST' });
    }
    if (existing.institution_profile_id && requestedRole !== 'institution') {
      return res.status(400).json({ error: 'Institution accounts must be managed from the Institutions page', code: 'BAD_REQUEST' });
    }
    if (requestedRole === 'tutor' && !existing.tutor_profile_id) {
      createTutorProfile = true;
    }
    if (requestedRole === 'institution' && !existing.institution_profile_id) {
      createInstitutionProfile = true;
    }
    profileFields.push('role = ?');
    profileValues.push(existing.tutor_profile_id ? 'tutor' : existing.institution_profile_id ? 'institution' : requestedRole);
  }

  if (req.body.full_name !== undefined) {
    const fullName = normalizeTrimmedString(req.body.full_name);
    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required', code: 'BAD_REQUEST' });
    }
    nextFullName = fullName;
    profileFields.push('full_name = ?');
    profileValues.push(fullName);
  }

  if (req.body.email !== undefined) {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ error: 'Email is required', code: 'BAD_REQUEST' });
    }

    const [emailRows] = await db.query('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [email, id]);
    if (emailRows.length > 0) {
      return res.status(409).json({ error: 'Email already registered', code: 'CONFLICT' });
    }

    userFields.push('email = ?');
    userValues.push(email);
    profileFields.push('email = ?');
    profileValues.push(email);
    nextEmail = email;
  }

  if (req.body.password !== undefined) {
    const password = normalizePassword(req.body.password);
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters', code: 'BAD_REQUEST' });
      }
      userFields.push('password_hash = ?');
      userValues.push(await bcrypt.hash(password, BCRYPT_SALT_ROUNDS));
    }
  }

  if (req.body.email_verified !== undefined) {
    userFields.push('email_verified = ?');
    userValues.push(normalizeBoolean(req.body.email_verified, false));
  }

  if (req.body.phone !== undefined) {
    nextPhone = normalizeOptionalString(req.body.phone);
    profileFields.push('phone = ?');
    profileValues.push(nextPhone);
  }

  if (req.body.city !== undefined) {
    nextCity = normalizeOptionalString(req.body.city);
    profileFields.push('city = ?');
    profileValues.push(nextCity);
  }

  if (req.body.status !== undefined) {
    const status = normalizeTrimmedString(req.body.status).toLowerCase();
    if (!PROFILE_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Invalid status', code: 'BAD_REQUEST' });
    }
    profileFields.push('status = ?');
    profileValues.push(status);
  }

  if (req.body.is_parent !== undefined || req.body.role !== undefined) {
    const effectiveRole = existing.tutor_profile_id ? 'tutor' : existing.institution_profile_id ? 'institution' : requestedRole;
    const isParent = effectiveRole === 'parent'
      ? true
      : normalizeBoolean(req.body.is_parent, !!existing.is_parent);
    profileFields.push('is_parent = ?');
    profileValues.push(isParent);
  }

  if (req.body.student_level !== undefined) {
    profileFields.push('student_level = ?');
    profileValues.push(normalizeOptionalString(req.body.student_level));
  }

  if (req.body.subjects_interested !== undefined) {
    profileFields.push('subjects_interested = ?');
    profileValues.push(JSON.stringify(normalizeStringArray(req.body.subjects_interested)));
  }

  if (profileFields.length === 0 && userFields.length === 0) {
    return res.json(await loadAdminUserById(id));
  }

  const defaultCurrency = createTutorProfile
    ? normalizeTrimmedString(String(await getAppSettingValue('currency_default', 'USD'))).toUpperCase() || 'USD'
    : null;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (userFields.length > 0) {
      await conn.query(`UPDATE users SET ${userFields.join(', ')} WHERE id = ?`, [...userValues, id]);
    }

    if (profileFields.length > 0) {
      await conn.query(`UPDATE profiles SET ${profileFields.join(', ')} WHERE user_id = ?`, [...profileValues, id]);
    }

    if (createTutorProfile) {
      await conn.query(
        `INSERT INTO tutor_profiles (
          id,
          user_id,
          bio,
          education,
          experience_years,
          subjects,
          levels,
          languages,
          online_available,
          offline_available,
          service_areas,
          open_to_work,
          verification_status,
          verified_badge,
          profile_photo_url,
          online_hourly,
          offline_hourly,
          currency,
          teaching_style,
          gender,
          packages,
          availability,
          verification_documents
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          id,
          null,
          null,
          0,
          JSON.stringify([]),
          JSON.stringify([]),
          JSON.stringify([]),
          true,
          false,
          JSON.stringify([]),
          false,
          'pending',
          false,
          null,
          0,
          null,
          defaultCurrency,
          null,
          null,
          JSON.stringify([]),
          JSON.stringify([]),
          JSON.stringify([]),
        ]
      );
    }

    if (createInstitutionProfile) {
      await conn.query(
        `INSERT INTO institution_profiles (
          id,
          user_id,
          institution_name,
          institution_type,
          description,
          website_url,
          address,
          city,
          contact_person_name,
          contact_person_title,
          contact_email,
          contact_phone,
          approval_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          id,
          nextFullName || 'Institution',
          'other',
          null,
          null,
          null,
          nextCity,
          nextFullName || null,
          null,
          nextEmail,
          nextPhone,
          'pending',
        ]
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  res.json(await loadAdminUserById(id));
}));

router.patch('/users/:id/suspend', wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query('SELECT status FROM profiles WHERE user_id = ?', [id]);
  const profile = rows[0];
  if (!profile) return res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' });
  const newStatus = profile.status === 'suspended' ? 'active' : 'suspended';
  await db.query('UPDATE profiles SET status = ? WHERE user_id = ?', [newStatus, id]);
  res.json({ status: newStatus });
}));

router.post('/users/:id/roles', wrap(async (req, res) => {
  const { id } = req.params;
  const role = normalizeTrimmedString(req.body.role || 'user').toLowerCase();
  if (!['admin', 'moderator', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Invalid app role', code: 'BAD_REQUEST' });
  }
  await db.query('INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)', [id, role]);
  res.json({ message: 'Role assigned' });
}));

router.delete('/users/:id/roles', wrap(async (req, res) => {
  const { id } = req.params;
  const role = normalizeTrimmedString(req.query.role).toLowerCase();

  if (role) {
    await db.query('DELETE FROM user_roles WHERE user_id = ? AND role = ?', [id, role]);
    return res.json({ message: 'Role removed' });
  }

  await db.query('DELETE FROM user_roles WHERE user_id = ?', [id]);
  res.json({ message: 'Roles removed' });
}));

router.delete('/users/:id', wrap(async (req, res) => {
  const { id } = req.params;

  // Transaction for complete cleanup
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Delete tutor profile if any
    await conn.query('DELETE FROM tutor_profiles WHERE user_id = ?', [id]);

    // 2. Delete app roles
    await conn.query('DELETE FROM user_roles WHERE user_id = ?', [id]);

    // 3. Delete profile
    await conn.query('DELETE FROM profiles WHERE user_id = ?', [id]);

    // 4. Delete auth user
    await conn.query('DELETE FROM users WHERE id = ?', [id]);

    await conn.commit();
    res.json({ message: 'User and all related data deleted successfully' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

router.get('/tutors', wrap(async (_req, res) => {
  const [rows] = await db.query(
    `SELECT tp.*, p.full_name, p.email, p.phone, p.city, p.status, u.email_verified
     FROM tutor_profiles tp
     JOIN profiles p ON p.user_id = tp.user_id
     JOIN users u ON u.id = tp.user_id
     ORDER BY tp.created_at DESC`
  );

  res.json(rows.map((row) => toAdminTutorResponse(row)));
}));

router.post('/tutors', wrap(async (req, res) => {
  const fullName = normalizeTrimmedString(req.body.full_name);
  const email = normalizeEmail(req.body.email);
  const password = normalizePassword(req.body.password);
  const status = normalizeTrimmedString(req.body.status || 'active').toLowerCase();
  const verificationStatus = normalizeTrimmedString(req.body.verification_status || 'pending').toLowerCase();
  const phone = normalizeOptionalString(req.body.phone);
  const city = normalizeOptionalString(req.body.city);
  const bio = normalizeOptionalString(req.body.bio);
  const education = normalizeOptionalString(req.body.education);
  const experienceYears = normalizeNumber(req.body.experience_years, 0);
  const onlineHourly = normalizeNumber(req.body.online_hourly, 0);
  const offlineHourly = normalizeNumber(req.body.offline_hourly, 0, { nullable: true });
  const teachingStyle = normalizeOptionalString(req.body.teaching_style);
  const gender = normalizeOptionalString(req.body.gender);
  const currency = normalizeTrimmedString(req.body.currency || String(await getAppSettingValue('currency_default', 'USD'))).toUpperCase() || 'USD';
  const subjects = normalizeStringArray(req.body.subjects);
  const levels = normalizeStringArray(req.body.levels);
  const languages = normalizeStringArray(req.body.languages);
  const serviceAreas = normalizeStringArray(req.body.service_areas);
  const availability = normalizeJsonArray(req.body.availability);
  const packages = normalizeJsonArray(req.body.packages);
  const emailVerified = normalizeBoolean(req.body.email_verified, true);
  const onlineAvailable = normalizeBoolean(req.body.online_available, true);
  const offlineAvailable = normalizeBoolean(req.body.offline_available, false);
  const openToWork = normalizeBoolean(req.body.open_to_work, false);
  const verificationDocuments = toStoredUploadDocuments(normalizeJsonArray(req.body.verification_documents));
  const profilePhotoUrl = req.body.profile_photo_url !== undefined ? toStoredUploadPath(req.body.profile_photo_url) : null;
  const verifiedBadge = verificationStatus === 'verified'
    ? normalizeBoolean(req.body.verified_badge, verificationDocuments.length > 0)
    : false;

  if (!fullName) {
    return res.status(400).json({ error: 'Full name is required', code: 'BAD_REQUEST' });
  }
  if (!email) {
    return res.status(400).json({ error: 'Email is required', code: 'BAD_REQUEST' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters', code: 'BAD_REQUEST' });
  }
  if (!PROFILE_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid status', code: 'BAD_REQUEST' });
  }
  if (!TUTOR_VERIFICATION_STATUSES.has(verificationStatus)) {
    return res.status(400).json({ error: 'Invalid verification status', code: 'BAD_REQUEST' });
  }

  const [existing] = await db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Email already registered', code: 'CONFLICT' });
  }

  const userId = uuid();
  const tutorId = uuid();
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      'INSERT INTO users (id, email, password_hash, email_verified) VALUES (?, ?, ?, ?)',
      [userId, email, passwordHash, emailVerified]
    );

    await conn.query(
      `INSERT INTO profiles (user_id, full_name, email, phone, city, role, status, is_parent)
       VALUES (?, ?, ?, ?, ?, 'tutor', ?, FALSE)`,
      [userId, fullName, email, phone, city, status]
    );

    await conn.query('INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)', [userId, 'user']);

    await conn.query(
      `INSERT INTO tutor_profiles (
        id, user_id, bio, education, experience_years, subjects, levels, languages,
        online_available, offline_available, service_areas, open_to_work, verification_status,
        verified_badge, profile_photo_url, online_hourly, offline_hourly, currency,
        teaching_style, gender, packages, availability, verification_documents
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tutorId,
        userId,
        bio,
        education,
        experienceYears,
        JSON.stringify(subjects),
        JSON.stringify(levels),
        JSON.stringify(languages),
        onlineAvailable,
        offlineAvailable,
        JSON.stringify(serviceAreas),
        openToWork,
        verificationStatus,
        verifiedBadge,
        profilePhotoUrl,
        onlineHourly,
        offlineHourly,
        currency,
        teachingStyle,
        gender,
        JSON.stringify(packages),
        JSON.stringify(availability),
        JSON.stringify(verificationDocuments),
      ]
    );

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  res.status(201).json(await loadAdminTutorById(tutorId));
}));

router.patch('/tutors/:id/verify', wrap(async (req, res) => {
  const { id } = req.params;
  const verificationStatus = normalizeTrimmedString(req.body.verification_status).toLowerCase();
  const { verified_badge } = req.body;

  if (!TUTOR_VERIFICATION_STATUSES.has(verificationStatus)) {
    return res.status(400).json({ error: 'Invalid verification status', code: 'BAD_REQUEST' });
  }

  const [tRows] = await db.query('SELECT user_id, verification_documents FROM tutor_profiles WHERE id = ?', [id]);
  const tutor = tRows[0];
  if (!tutor) return res.status(404).json({ error: 'Tutor not found' });

  const userId = tutor.user_id;

  let grantBadge = false;
  if (verificationStatus === 'verified') {
    const raw = tutor.verification_documents;
    let docs = [];
    if (raw) {
      try { docs = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { docs = []; }
    }

    if (verified_badge !== undefined) {
      grantBadge = verified_badge === true && Array.isArray(docs) && docs.length > 0;
    } else {
      grantBadge = Array.isArray(docs) && docs.length > 0;
    }
  }

  if (verificationStatus === 'rejected') {
    grantBadge = false;
    await db.query(
      'UPDATE tutor_profiles SET verification_status = ?, verified_badge = FALSE, verification_documents = NULL WHERE id = ?',
      [verificationStatus, id]
    );
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'verification', 'Verification Rejected', 'Your uploaded documents were rejected. Please upload valid verification documents.')`,
      [userId]
    );
  } else if (verificationStatus === 'suspended') {
    grantBadge = false;
    await db.query(
      'UPDATE tutor_profiles SET verification_status = ?, verified_badge = FALSE WHERE id = ?',
      [verificationStatus, id]
    );
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'verification', 'Account Suspended', 'Your tutor profile has been suspended by an administrator.')`,
      [userId]
    );
  } else {
    // verified or pending
    await db.query(
      'UPDATE tutor_profiles SET verification_status = ?, verified_badge = ? WHERE id = ?',
      [verificationStatus, grantBadge, id]
    );
    if (verificationStatus === 'verified') {
      const msg = grantBadge ? 'Your tutor profile has been verified and you received the Verified Badge!' : 'Your tutor profile has been verified. Upload documents to get the Verified Badge!';
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'verification', 'Profile Verified', ?)`,
        [userId, msg]
      );
    }
  }

  const updated = await loadAdminTutorById(id);
  res.json({ ...updated, badge_granted: grantBadge });
}));

router.patch('/tutors/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query(
    `SELECT tp.id, tp.user_id
     FROM tutor_profiles tp
     WHERE tp.id = ?
     LIMIT 1`,
    [id]
  );

  const existing = rows[0];
  if (!existing) {
    return res.status(404).json({ error: 'Tutor not found', code: 'NOT_FOUND' });
  }

  const profileFields = [];
  const profileValues = [];
  const userFields = [];
  const userValues = [];
  const tutorFields = [];
  const tutorValues = [];
  let nextVerificationStatus = null;

  if (req.body.full_name !== undefined) {
    const fullName = normalizeTrimmedString(req.body.full_name);
    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required', code: 'BAD_REQUEST' });
    }
    profileFields.push('full_name = ?');
    profileValues.push(fullName);
  }

  if (req.body.email !== undefined) {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ error: 'Email is required', code: 'BAD_REQUEST' });
    }

    const [emailRows] = await db.query('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [email, existing.user_id]);
    if (emailRows.length > 0) {
      return res.status(409).json({ error: 'Email already registered', code: 'CONFLICT' });
    }

    userFields.push('email = ?');
    userValues.push(email);
    profileFields.push('email = ?');
    profileValues.push(email);
  }

  if (req.body.password !== undefined) {
    const password = normalizePassword(req.body.password);
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters', code: 'BAD_REQUEST' });
      }
      userFields.push('password_hash = ?');
      userValues.push(await bcrypt.hash(password, BCRYPT_SALT_ROUNDS));
    }
  }

  if (req.body.email_verified !== undefined) {
    userFields.push('email_verified = ?');
    userValues.push(normalizeBoolean(req.body.email_verified, false));
  }

  if (req.body.phone !== undefined) {
    profileFields.push('phone = ?');
    profileValues.push(normalizeOptionalString(req.body.phone));
  }

  if (req.body.city !== undefined) {
    profileFields.push('city = ?');
    profileValues.push(normalizeOptionalString(req.body.city));
  }

  if (req.body.status !== undefined) {
    const status = normalizeTrimmedString(req.body.status).toLowerCase();
    if (!PROFILE_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Invalid status', code: 'BAD_REQUEST' });
    }
    profileFields.push('status = ?');
    profileValues.push(status);
  }

  if (req.body.bio !== undefined) {
    tutorFields.push('bio = ?');
    tutorValues.push(normalizeOptionalString(req.body.bio));
  }
  if (req.body.education !== undefined) {
    tutorFields.push('education = ?');
    tutorValues.push(normalizeOptionalString(req.body.education));
  }
  if (req.body.experience_years !== undefined) {
    tutorFields.push('experience_years = ?');
    tutorValues.push(normalizeNumber(req.body.experience_years, 0));
  }
  if (req.body.online_hourly !== undefined) {
    tutorFields.push('online_hourly = ?');
    tutorValues.push(normalizeNumber(req.body.online_hourly, 0));
  }
  if (req.body.offline_hourly !== undefined) {
    tutorFields.push('offline_hourly = ?');
    tutorValues.push(normalizeNumber(req.body.offline_hourly, 0, { nullable: true }));
  }
  if (req.body.currency !== undefined) {
    tutorFields.push('currency = ?');
    tutorValues.push(normalizeTrimmedString(req.body.currency).toUpperCase() || 'USD');
  }
  if (req.body.teaching_style !== undefined) {
    tutorFields.push('teaching_style = ?');
    tutorValues.push(normalizeOptionalString(req.body.teaching_style));
  }
  if (req.body.gender !== undefined) {
    tutorFields.push('gender = ?');
    tutorValues.push(normalizeOptionalString(req.body.gender));
  }
  if (req.body.subjects !== undefined) {
    tutorFields.push('subjects = ?');
    tutorValues.push(JSON.stringify(normalizeStringArray(req.body.subjects)));
  }
  if (req.body.levels !== undefined) {
    tutorFields.push('levels = ?');
    tutorValues.push(JSON.stringify(normalizeStringArray(req.body.levels)));
  }
  if (req.body.languages !== undefined) {
    tutorFields.push('languages = ?');
    tutorValues.push(JSON.stringify(normalizeStringArray(req.body.languages)));
  }
  if (req.body.service_areas !== undefined) {
    tutorFields.push('service_areas = ?');
    tutorValues.push(JSON.stringify(normalizeStringArray(req.body.service_areas)));
  }
  if (req.body.availability !== undefined) {
    tutorFields.push('availability = ?');
    tutorValues.push(JSON.stringify(normalizeJsonArray(req.body.availability)));
  }
  if (req.body.packages !== undefined) {
    tutorFields.push('packages = ?');
    tutorValues.push(JSON.stringify(normalizeJsonArray(req.body.packages)));
  }
  if (req.body.online_available !== undefined) {
    tutorFields.push('online_available = ?');
    tutorValues.push(normalizeBoolean(req.body.online_available, true));
  }
  if (req.body.offline_available !== undefined) {
    tutorFields.push('offline_available = ?');
    tutorValues.push(normalizeBoolean(req.body.offline_available, false));
  }
  if (req.body.open_to_work !== undefined) {
    tutorFields.push('open_to_work = ?');
    tutorValues.push(normalizeBoolean(req.body.open_to_work, false));
  }
  if (req.body.profile_photo_url !== undefined) {
    tutorFields.push('profile_photo_url = ?');
    tutorValues.push(toStoredUploadPath(req.body.profile_photo_url));
  }
  if (req.body.verification_documents !== undefined) {
    tutorFields.push('verification_documents = ?');
    tutorValues.push(JSON.stringify(toStoredUploadDocuments(normalizeJsonArray(req.body.verification_documents))));
  }
  if (req.body.verification_status !== undefined) {
    const verificationStatus = normalizeTrimmedString(req.body.verification_status).toLowerCase();
    if (!TUTOR_VERIFICATION_STATUSES.has(verificationStatus)) {
      return res.status(400).json({ error: 'Invalid verification status', code: 'BAD_REQUEST' });
    }
    nextVerificationStatus = verificationStatus;
    tutorFields.push('verification_status = ?');
    tutorValues.push(verificationStatus);
  }
  if (nextVerificationStatus && nextVerificationStatus !== 'verified') {
    tutorFields.push('verified_badge = ?');
    tutorValues.push(false);
  } else if (req.body.verified_badge !== undefined) {
    tutorFields.push('verified_badge = ?');
    tutorValues.push(normalizeBoolean(req.body.verified_badge, false));
  }

  if (profileFields.length === 0 && userFields.length === 0 && tutorFields.length === 0) {
    return res.json(await loadAdminTutorById(id));
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (userFields.length > 0) {
      await conn.query(`UPDATE users SET ${userFields.join(', ')} WHERE id = ?`, [...userValues, existing.user_id]);
    }

    if (profileFields.length > 0) {
      await conn.query(`UPDATE profiles SET ${profileFields.join(', ')} WHERE user_id = ?`, [...profileValues, existing.user_id]);
    }

    if (tutorFields.length > 0) {
      await conn.query(`UPDATE tutor_profiles SET ${tutorFields.join(', ')} WHERE id = ?`, [...tutorValues, id]);
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  res.json(await loadAdminTutorById(id));
}));

router.delete('/tutors/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query('SELECT user_id FROM tutor_profiles WHERE id = ?', [id]);
  const tutor = rows[0];
  if (!tutor) return res.status(404).json({ error: 'Tutor not found' });

  await db.query('DELETE FROM tutor_profiles WHERE id = ?', [id]);

  // Demote profile role if it was specifically 'tutor'
  await db.query("UPDATE profiles SET role = 'student', is_parent = FALSE WHERE user_id = ? AND role = 'tutor'", [tutor.user_id]);

  res.json({ message: 'Tutor deleted' });
}));

router.get('/institutions', wrap(async (req, res) => {
  const searchQuery = normalizeOptionalString(req.query.q);
  const approvalStatus = normalizeTrimmedString(req.query.approval_status).toLowerCase();
  const accountStatus = normalizeTrimmedString(req.query.status).toLowerCase();
  const filters = [];
  const params = [];

  if (searchQuery) {
    const search = `%${searchQuery}%`;
    filters.push('(ip.institution_name LIKE ? OR p.email LIKE ? OR COALESCE(ip.city, p.city, "") LIKE ? OR COALESCE(ip.contact_person_name, "") LIKE ?)');
    params.push(search, search, search, search);
  }

  if (approvalStatus) {
    if (!INSTITUTION_APPROVAL_STATUSES.has(approvalStatus)) {
      return res.status(400).json({ error: 'Invalid approval status', code: 'BAD_REQUEST' });
    }
    filters.push('ip.approval_status = ?');
    params.push(approvalStatus);
  }

  if (accountStatus) {
    if (!PROFILE_STATUSES.has(accountStatus)) {
      return res.status(400).json({ error: 'Invalid account status', code: 'BAD_REQUEST' });
    }
    filters.push('p.status = ?');
    params.push(accountStatus);
  }

  const [rows] = await db.query(
    `SELECT
      ip.*,
      p.full_name,
      p.email,
      p.phone,
      p.city,
      p.status,
      u.email_verified,
      (
        SELECT COUNT(*)
        FROM institution_jobs ij
        WHERE ij.institution_id = ip.id
      ) AS job_count
     FROM institution_profiles ip
     JOIN profiles p ON p.user_id = ip.user_id
     JOIN users u ON u.id = ip.user_id
     ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
     ORDER BY
       CASE ip.approval_status
         WHEN 'pending' THEN 0
         WHEN 'rejected' THEN 1
         WHEN 'suspended' THEN 2
         WHEN 'approved' THEN 3
         ELSE 4
       END,
       ip.created_at DESC`,
    params
  );

  res.json(rows.map((row) => toAdminInstitutionResponse(row)));
}));

router.post('/institutions', wrap(async (req, res) => {
  const institutionName = normalizeTrimmedString(req.body.institution_name || req.body.full_name);
  const institutionType = normalizeTrimmedString(req.body.institution_type || 'school').toLowerCase();
  const email = normalizeEmail(req.body.email);
  const password = normalizePassword(req.body.password);
  const phone = normalizeOptionalString(req.body.phone);
  const city = normalizeOptionalString(req.body.city);
  const status = normalizeTrimmedString(req.body.status || 'active').toLowerCase();
  const emailVerified = normalizeBoolean(req.body.email_verified, true);
  const approvalStatus = normalizeTrimmedString(req.body.approval_status || 'pending').toLowerCase();
  const description = normalizeOptionalString(req.body.description);
  const websiteUrl = normalizeOptionalString(req.body.website_url);
  const address = normalizeOptionalString(req.body.address);
  const contactPersonName = normalizeOptionalString(req.body.contact_person_name);
  const contactPersonTitle = normalizeOptionalString(req.body.contact_person_title);
  const rawContactEmail = normalizeOptionalString(req.body.contact_email);
  const parsedContactEmail = rawContactEmail ? normalizeEmail(rawContactEmail) : null;
  const contactEmail = parsedContactEmail || email;
  const contactPhone = normalizeOptionalString(req.body.contact_phone) || phone;

  if (!institutionName) {
    return res.status(400).json({ error: 'Institution name is required', code: 'BAD_REQUEST' });
  }
  if (!email) {
    return res.status(400).json({ error: 'Email is required', code: 'BAD_REQUEST' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters', code: 'BAD_REQUEST' });
  }
  if (rawContactEmail && !parsedContactEmail) {
    return res.status(400).json({ error: 'Invalid contact email', code: 'BAD_REQUEST' });
  }
  if (!INSTITUTION_TYPES.has(institutionType)) {
    return res.status(400).json({ error: 'Invalid institution type', code: 'BAD_REQUEST' });
  }
  if (!PROFILE_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid account status', code: 'BAD_REQUEST' });
  }
  if (!INSTITUTION_APPROVAL_STATUSES.has(approvalStatus)) {
    return res.status(400).json({ error: 'Invalid approval status', code: 'BAD_REQUEST' });
  }

  const [existingRows] = await db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existingRows[0]) {
    return res.status(409).json({ error: 'Email already registered', code: 'CONFLICT' });
  }

  const userId = uuid();
  const institutionId = uuid();
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const notification = getInstitutionApprovalNotification(approvalStatus);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      'INSERT INTO users (id, email, password_hash, email_verified) VALUES (?, ?, ?, ?)',
      [userId, email, passwordHash, emailVerified]
    );

    await conn.query(
      `INSERT INTO profiles (user_id, full_name, email, phone, city, role, status, is_parent, student_level, subjects_interested)
       VALUES (?, ?, ?, ?, ?, 'institution', ?, FALSE, NULL, ?)`,
      [userId, institutionName, email, contactPhone, city, status, JSON.stringify([])]
    );

    await conn.query('INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)', [userId, 'user']);

    await conn.query(
      `INSERT INTO institution_profiles (
        id,
        user_id,
        institution_name,
        institution_type,
        description,
        website_url,
        address,
        city,
        contact_person_name,
        contact_person_title,
        contact_email,
        contact_phone,
        approval_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        institutionId,
        userId,
        institutionName,
        institutionType,
        description,
        websiteUrl,
        address,
        city,
        contactPersonName,
        contactPersonTitle,
        contactEmail,
        contactPhone,
        approvalStatus,
      ]
    );

    await conn.query(
      'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
      [userId, 'system', notification.title, notification.message]
    );

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  res.status(201).json(await loadAdminInstitutionById(institutionId));
}));

router.patch('/institutions/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query(
    `SELECT ip.id, ip.user_id, ip.approval_status, p.email
     FROM institution_profiles ip
     JOIN profiles p ON p.user_id = ip.user_id
     WHERE ip.id = ?
     LIMIT 1`,
    [id]
  );

  const existing = rows[0];
  if (!existing) {
    return res.status(404).json({ error: 'Institution not found', code: 'NOT_FOUND' });
  }

  const institutionFields = [];
  const institutionValues = [];
  const profileFields = [];
  const profileValues = [];
  const userFields = [];
  const userValues = [];
  let nextApprovalStatus = existing.approval_status;

  if (req.body.institution_name !== undefined || req.body.full_name !== undefined) {
    const institutionName = normalizeTrimmedString(req.body.institution_name || req.body.full_name);
    if (!institutionName) {
      return res.status(400).json({ error: 'Institution name is required', code: 'BAD_REQUEST' });
    }
    institutionFields.push('institution_name = ?');
    institutionValues.push(institutionName);
    profileFields.push('full_name = ?');
    profileValues.push(institutionName);
  }

  if (req.body.institution_type !== undefined) {
    const institutionType = normalizeTrimmedString(req.body.institution_type).toLowerCase();
    if (!INSTITUTION_TYPES.has(institutionType)) {
      return res.status(400).json({ error: 'Invalid institution type', code: 'BAD_REQUEST' });
    }
    institutionFields.push('institution_type = ?');
    institutionValues.push(institutionType);
  }

  if (req.body.description !== undefined) {
    institutionFields.push('description = ?');
    institutionValues.push(normalizeOptionalString(req.body.description));
  }

  if (req.body.website_url !== undefined) {
    institutionFields.push('website_url = ?');
    institutionValues.push(normalizeOptionalString(req.body.website_url));
  }

  if (req.body.address !== undefined) {
    institutionFields.push('address = ?');
    institutionValues.push(normalizeOptionalString(req.body.address));
  }

  if (req.body.city !== undefined) {
    const city = normalizeOptionalString(req.body.city);
    institutionFields.push('city = ?');
    institutionValues.push(city);
    profileFields.push('city = ?');
    profileValues.push(city);
  }

  if (req.body.contact_person_name !== undefined) {
    institutionFields.push('contact_person_name = ?');
    institutionValues.push(normalizeOptionalString(req.body.contact_person_name));
  }

  if (req.body.contact_person_title !== undefined) {
    institutionFields.push('contact_person_title = ?');
    institutionValues.push(normalizeOptionalString(req.body.contact_person_title));
  }

  if (req.body.contact_email !== undefined) {
    const contactEmail = normalizeEmail(req.body.contact_email);
    if (req.body.contact_email && !contactEmail) {
      return res.status(400).json({ error: 'Invalid contact email', code: 'BAD_REQUEST' });
    }
    institutionFields.push('contact_email = ?');
    institutionValues.push(contactEmail);
  }

  if (req.body.contact_phone !== undefined) {
    const contactPhone = normalizeOptionalString(req.body.contact_phone);
    institutionFields.push('contact_phone = ?');
    institutionValues.push(contactPhone);
    profileFields.push('phone = ?');
    profileValues.push(contactPhone);
  }

  if (req.body.approval_status !== undefined) {
    const approvalStatus = normalizeTrimmedString(req.body.approval_status).toLowerCase();
    if (!INSTITUTION_APPROVAL_STATUSES.has(approvalStatus)) {
      return res.status(400).json({ error: 'Invalid approval status', code: 'BAD_REQUEST' });
    }
    nextApprovalStatus = approvalStatus;
    institutionFields.push('approval_status = ?');
    institutionValues.push(approvalStatus);
  }

  if (req.body.status !== undefined) {
    const status = normalizeTrimmedString(req.body.status).toLowerCase();
    if (!PROFILE_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Invalid account status', code: 'BAD_REQUEST' });
    }
    profileFields.push('status = ?');
    profileValues.push(status);
  }

  if (req.body.email !== undefined) {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ error: 'Email is required', code: 'BAD_REQUEST' });
    }

    if (email !== existing.email) {
      const [emailRows] = await db.query('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [email, existing.user_id]);
      if (emailRows[0]) {
        return res.status(409).json({ error: 'Email already registered', code: 'CONFLICT' });
      }
    }

    userFields.push('email = ?');
    userValues.push(email);
    profileFields.push('email = ?');
    profileValues.push(email);
  }

  if (req.body.email_verified !== undefined) {
    userFields.push('email_verified = ?');
    userValues.push(normalizeBoolean(req.body.email_verified, false));
  }

  if (req.body.password !== undefined) {
    const password = normalizePassword(req.body.password);
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters', code: 'BAD_REQUEST' });
    }
    userFields.push('password_hash = ?');
    userValues.push(await bcrypt.hash(password, BCRYPT_SALT_ROUNDS));
  }

  if (institutionFields.length === 0 && profileFields.length === 0 && userFields.length === 0) {
    return res.json(await loadAdminInstitutionById(id));
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (userFields.length > 0) {
      await conn.query(`UPDATE users SET ${userFields.join(', ')} WHERE id = ?`, [...userValues, existing.user_id]);
    }

    if (profileFields.length > 0) {
      await conn.query(`UPDATE profiles SET ${profileFields.join(', ')} WHERE user_id = ?`, [...profileValues, existing.user_id]);
    }

    if (institutionFields.length > 0) {
      await conn.query(`UPDATE institution_profiles SET ${institutionFields.join(', ')} WHERE id = ?`, [...institutionValues, id]);
    }

    if (nextApprovalStatus !== existing.approval_status) {
      const notification = getInstitutionApprovalNotification(nextApprovalStatus);
      await conn.query(
        'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
        [existing.user_id, 'system', notification.title, notification.message]
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  res.json(await loadAdminInstitutionById(id));
}));

router.delete('/institutions/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query('SELECT user_id FROM institution_profiles WHERE id = ? LIMIT 1', [id]);
  const institution = rows[0];
  if (!institution) {
    return res.status(404).json({ error: 'Institution not found', code: 'NOT_FOUND' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM institution_profiles WHERE id = ?', [id]);
    await conn.query("UPDATE profiles SET role = 'student', is_parent = FALSE WHERE user_id = ? AND role = 'institution'", [institution.user_id]);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  res.json({ message: 'Institution deleted' });
}));

router.get('/subscriptions', wrap(async (_req, res) => {
  const [rows] = await db.query(
    `SELECT s.*, p.full_name AS tutor_name, p.email AS tutor_email
     FROM subscriptions s
     LEFT JOIN profiles p ON p.user_id = s.user_id
     ORDER BY s.created_at DESC`
  );
  res.json(rows);
}));

router.patch('/subscriptions/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    fields.push(`${key} = ?`);
    values.push(updates[key]);
  }
  if (fields.length === 0) return res.json({ message: 'No changes' });

  values.push(id);
  await db.query(`UPDATE subscriptions SET ${fields.join(', ')} WHERE id = ?`, values);
  const [rows] = await db.query('SELECT * FROM subscriptions WHERE id = ?', [id]);
  res.json(rows[0]);
}));

router.delete('/subscriptions/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM subscriptions WHERE id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
}));

router.get('/courses', wrap(async (_req, res) => {
  const [rows] = await db.query(
    `SELECT c.*, p.full_name AS tutor_name
     FROM courses c
     JOIN profiles p ON p.user_id = c.user_id
     ORDER BY c.created_at DESC`
  );
  res.json(rows.map((row) => ({
    ...row,
    cover_image_url: toPublicUploadUrl(row.cover_image_url),
  })));
}));

router.get('/enrollments', wrap(async (_req, res) => {
  const [rows] = await db.query(
    `SELECT e.*, p.full_name AS student_name, c.title AS course_title, tp_p.full_name AS tutor_name
     FROM course_enrollments e
     JOIN profiles p ON p.user_id = e.student_id
     JOIN courses c ON c.id = e.course_id
     JOIN profiles tp_p ON tp_p.user_id = c.user_id
     ORDER BY e.created_at DESC`
  );
  res.json(rows);
}));

router.patch('/enrollments/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  await db.query('UPDATE course_enrollments SET status = ? WHERE id = ?', [status, id]);
  const [rows] = await db.query('SELECT * FROM course_enrollments WHERE id = ?', [id]);
  res.json(rows[0]);
}));

router.delete('/enrollments/:id', wrap(async (req, res) => {
  const { id } = req.params;
  await db.query('DELETE FROM course_enrollments WHERE id = ?', [id]);
  res.json({ message: 'Enrollment deleted' });
}));

router.get('/reviews', wrap(async (_req, res) => {
  const [tutorReviews] = await db.query(
    `SELECT r.*, p.full_name AS student_name, tp_p.full_name AS tutor_name
     FROM reviews r
     JOIN profiles p ON p.user_id = r.student_id
     JOIN tutor_profiles tp ON tp.id = r.tutor_id
     JOIN profiles tp_p ON tp_p.user_id = tp.user_id
     ORDER BY r.created_at DESC`
  );
  const [courseReviews] = await db.query(
    `SELECT cr.*, p.full_name AS student_name, c.title AS course_title
     FROM course_reviews cr
     JOIN profiles p ON p.user_id = cr.student_id
     JOIN courses c ON c.id = cr.course_id
     ORDER BY cr.created_at DESC`
  );
  res.json({ tutor_reviews: tutorReviews, course_reviews: courseReviews });
}));

router.delete('/reviews/:id', wrap(async (req, res) => {
  const { id } = req.params;
  await db.query('DELETE FROM reviews WHERE id = ?', [id]);
  await db.query('DELETE FROM course_reviews WHERE id = ?', [id]);
  res.json({ message: 'Review deleted' });
}));

router.get('/reports', wrap(async (_req, res) => {
  const [rows] = await db.query(
    `SELECT
      tr.*,
      reporter.full_name AS reporter_name,
      reporter.email AS reporter_email,
      reporter.role AS reporter_role,
      reporter.is_parent AS reporter_is_parent,
      target.full_name AS target_name,
      target.email AS target_email,
      target.status AS target_status,
      c.title AS course_title,
      reviewer.full_name AS reviewed_by_name
     FROM tutor_reports tr
     JOIN profiles reporter ON reporter.user_id = tr.reporter_user_id
     JOIN profiles target ON target.user_id = tr.target_user_id
     LEFT JOIN courses c ON c.id = tr.course_id
     LEFT JOIN profiles reviewer ON reviewer.user_id = tr.reviewed_by
     ORDER BY FIELD(tr.status, 'pending', 'reviewing', 'resolved', 'dismissed'), tr.created_at DESC`,
  );

  res.json(rows.map((row) => toAdminTutorReportResponse(row)));
}));

router.patch('/reports/:id', validateBody(adminTutorReportUpdateSchema), wrap(async (req, res) => {
  const { id } = req.params;
  const existing = await loadAdminTutorReportById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Report not found', code: 'NOT_FOUND' });
  }

  let nextStatus = req.body.status ?? existing.status;
  let nextAction = req.body.action_taken ?? existing.action_taken;
  const nextAdminNotes = Object.prototype.hasOwnProperty.call(req.body, 'admin_notes')
    ? normalizeOptionalString(req.body.admin_notes)
    : normalizeOptionalString(existing.admin_notes);

  if (!REPORT_STATUSES.has(nextStatus)) {
    return res.status(400).json({ error: 'Invalid report status', code: 'BAD_REQUEST' });
  }

  if (!REPORT_ACTIONS.has(nextAction)) {
    return res.status(400).json({ error: 'Invalid report action', code: 'BAD_REQUEST' });
  }

  if (nextStatus === 'pending' && nextAction !== 'none') {
    nextStatus = 'resolved';
  }

  const notesChanged = nextAdminNotes !== normalizeOptionalString(existing.admin_notes);
  const statusChanged = nextStatus !== existing.status;
  const actionChanged = nextAction !== existing.action_taken;

  if (!notesChanged && !statusChanged && !actionChanged) {
    return res.json(existing);
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE tutor_reports
       SET status = ?, action_taken = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [nextStatus, nextAction, nextAdminNotes, req.user.id, id],
    );

    if (actionChanged && nextAction === 'warning_sent') {
      await conn.query(
        `INSERT INTO notifications (user_id, type, title, message, metadata)
         VALUES (?, ?, ?, ?, ?)`,
        [
          existing.target_user_id,
          'report_update',
          'Account Warning',
          'An administrator issued a warning on your account after reviewing a report.',
          JSON.stringify({ report_id: id }),
        ],
      );
    }

    if (actionChanged && nextAction === 'account_suspended') {
      await conn.query(
        "UPDATE profiles SET status = 'suspended' WHERE user_id = ?",
        [existing.target_user_id],
      );
      await conn.query(
        `INSERT INTO notifications (user_id, type, title, message, metadata)
         VALUES (?, ?, ?, ?, ?)`,
        [
          existing.target_user_id,
          'report_update',
          'Account Suspended',
          'Your account was suspended after an administrator reviewed a report.',
          JSON.stringify({ report_id: id }),
        ],
      );
    }

    const reporterUpdateParts = [`Status: ${nextStatus}.`];
    if (nextAction === 'warning_sent') {
      reporterUpdateParts.push('A warning was sent to the reported account.');
    } else if (nextAction === 'account_suspended') {
      reporterUpdateParts.push('The reported account was suspended.');
    } else if (nextAction === 'no_action') {
      reporterUpdateParts.push('No direct action was taken.');
    }

    await conn.query(
      `INSERT INTO notifications (user_id, type, title, message, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [
        existing.reporter_user_id,
        'report_update',
        'Report Updated',
        `Admin reviewed your report about ${existing.target_name || 'the reported account'}. ${reporterUpdateParts.join(' ')}`,
        JSON.stringify({ report_id: id }),
      ],
    );

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  res.json(await loadAdminTutorReportById(id));
}));

router.get('/messages', wrap(async (_req, res) => {
  const [rows] = await db.query(
    `SELECT c.*, p1.full_name AS student_name, p2.full_name AS tutor_name,
     (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
     (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) AS message_count
     FROM conversations c
     JOIN profiles p1 ON p1.user_id = c.student_id
     JOIN profiles p2 ON p2.user_id = c.tutor_id
     ORDER BY c.updated_at DESC`
  );
  res.json(rows);
}));

router.get('/messages/:id/messages', wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT m.*, p.full_name AS sender_name
     FROM messages m
     JOIN profiles p ON p.user_id = m.sender_id
     WHERE m.conversation_id = ?
     ORDER BY m.created_at ASC`,
    [req.params.id]
  );
  res.json(rows);
}));

router.delete('/messages/message/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM messages WHERE id = ?', [req.params.id]);
  res.json({ message: 'Message deleted' });
}));

router.delete('/messages/:id', wrap(async (req, res) => {
  const { id } = req.params;
  await db.query('DELETE FROM messages WHERE conversation_id = ?', [id]);
  await db.query('DELETE FROM conversations WHERE id = ?', [id]);
  res.json({ message: 'Conversation deleted' });
}));

router.get('/activity-logs', wrap(async (_req, res) => {
  const [rows] = await db.query(
    `SELECT al.*, p.full_name, p.role
     FROM activity_logs al
     LEFT JOIN profiles p ON p.user_id = al.user_id
     ORDER BY al.created_at DESC`
  );
  res.json(rows);
}));

router.get('/notifications', wrap(async (_req, res) => {
  const [rows] = await db.query(
    `SELECT n.*, p.full_name
     FROM notifications n
     LEFT JOIN profiles p ON p.user_id = n.user_id
     ORDER BY n.created_at DESC`
  );
  res.json(rows);
}));

router.post('/notifications', wrap(async (req, res) => {
  const data = req.body;
  const id = uuid();
  await db.query(
    'INSERT INTO notifications (id, user_id, type, title, message, metadata) VALUES (?, ?, ?, ?, ?, ?)',
    [id, data.user_id || null, data.type, data.title, data.message, JSON.stringify(data.metadata || {})]
  );
  const [rows] = await db.query('SELECT * FROM notifications WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
}));

async function createSimple(table, name) {
  const id = uuid();
  await db.query(`INSERT INTO ${table} (id, name) VALUES (?, ?)`, [id, name]);
  const [rows] = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return rows[0];
}

async function updateSimple(table, id, name) {
  await db.query(`UPDATE ${table} SET name = ? WHERE id = ?`, [name, id]);
  const [rows] = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return rows[0];
}

async function deleteSimple(table, id) {
  await db.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

function simpleCrud(path, table) {
  router.get(path, wrap(async (_req, res) => {
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY name ASC`);
    res.json(rows);
  }));

  router.post(path, wrap(async (req, res) => {
    const item = await createSimple(table, req.body.name);
    res.status(201).json(item);
  }));

  router.patch(`${path}/:id`, wrap(async (req, res) => {
    const item = await updateSimple(table, req.params.id, req.body.name);
    res.json(item);
  }));

  router.delete(`${path}/:id`, wrap(async (req, res) => {
    await deleteSimple(table, req.params.id);
    res.json({ message: 'Deleted' });
  }));
}

simpleCrud('/cities', 'cities');
simpleCrud('/subjects', 'subjects');
simpleCrud('/levels', 'levels');
simpleCrud('/languages', 'languages');

router.get('/payment-methods', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM payment_methods ORDER BY sort_order ASC');
  res.json(rows);
}));

router.post('/payment-methods', wrap(async (req, res) => {
  const id = uuid();
  const data = req.body;
  await db.query(
    `INSERT INTO payment_methods (id, name, payment_type, merchant_number, ussd_prefix, icon_name, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.payment_type || 'mobile_money', data.merchant_number, data.ussd_prefix, data.icon_name || 'smartphone', data.is_active ?? true, data.sort_order ?? 0]
  );
  const [rows] = await db.query('SELECT * FROM payment_methods WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
}));

router.patch('/payment-methods/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    fields.push(`${key} = ?`);
    values.push(updates[key]);
  }
  if (fields.length === 0) return res.json({ message: 'No changes' });
  values.push(id);
  await db.query(`UPDATE payment_methods SET ${fields.join(', ')} WHERE id = ?`, values);
  const [rows] = await db.query('SELECT * FROM payment_methods WHERE id = ?', [id]);
  res.json(rows[0]);
}));

router.delete('/payment-methods/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM payment_methods WHERE id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
}));

router.get('/notices', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM notices ORDER BY sort_order ASC');
  res.json(rows);
}));

router.post('/notices', wrap(async (req, res) => {
  const id = uuid();
  const data = req.body;
  await db.query(
    `INSERT INTO notices (id, title, message, type, is_active, is_banner, sort_order, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.title, data.message, data.type || 'info', data.is_active ?? true, data.is_banner ?? false, data.sort_order ?? 0, data.start_date || null, data.end_date || null]
  );
  const [rows] = await db.query('SELECT * FROM notices WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
}));

router.patch('/notices/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    fields.push(`${key} = ?`);
    values.push(updates[key]);
  }
  if (fields.length === 0) return res.json({ message: 'No changes' });
  values.push(id);
  await db.query(`UPDATE notices SET ${fields.join(', ')} WHERE id = ?`, values);
  const [rows] = await db.query('SELECT * FROM notices WHERE id = ?', [id]);
  res.json(rows[0]);
}));

router.delete('/notices/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM notices WHERE id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
}));

router.get('/ads', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM ads ORDER BY sort_order ASC');
  res.json(rows.map((row) => toAdminAdResponse(row)));
}));

router.post('/ads', wrap(async (req, res) => {
  const id = uuid();
  const data = req.body;
  await db.query(
    `INSERT INTO ads (id, company_name, description, image_url, image_width, image_height, link_url, placement, is_active, sort_order, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.company_name, data.description || null, toStoredUploadPath(data.image_url), data.image_width || null, data.image_height || null, data.link_url || null, data.placement || 'card', data.is_active ?? true, data.sort_order ?? 0, data.start_date || null, data.end_date || null]
  );
  const [rows] = await db.query('SELECT * FROM ads WHERE id = ?', [id]);
  res.status(201).json(toAdminAdResponse(rows[0]));
}));

router.patch('/ads/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    fields.push(`${key} = ?`);
    values.push(key === 'image_url' ? toStoredUploadPath(updates[key]) : updates[key]);
  }
  if (fields.length === 0) return res.json({ message: 'No changes' });
  values.push(id);
  await db.query(`UPDATE ads SET ${fields.join(', ')} WHERE id = ?`, values);
  const [rows] = await db.query('SELECT * FROM ads WHERE id = ?', [id]);
  res.json(toAdminAdResponse(rows[0]));
}));

router.delete('/ads/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM ads WHERE id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
}));

router.get('/subscription-plans', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM subscription_plans ORDER BY sort_order ASC');
  res.json(rows);
}));

router.post('/subscription-plans', wrap(async (req, res) => {
  const id = uuid();
  const data = req.body;
  await db.query(
    `INSERT INTO subscription_plans (id, name, description, price, currency, period, features, is_active, is_popular, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.description || '', data.price || 0, data.currency || 'USD', data.period || 'month', JSON.stringify(data.features || []), data.is_active ?? true, data.is_popular ?? false, data.sort_order ?? 0]
  );
  const [rows] = await db.query('SELECT * FROM subscription_plans WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
}));

router.patch('/subscription-plans/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    fields.push(`${key} = ?`);
    const val = key === 'features' ? JSON.stringify(updates[key]) : updates[key];
    values.push(val);
  }
  if (fields.length === 0) return res.json({ message: 'No changes' });
  values.push(id);
  await db.query(`UPDATE subscription_plans SET ${fields.join(', ')} WHERE id = ?`, values);
  const [rows] = await db.query('SELECT * FROM subscription_plans WHERE id = ?', [id]);
  res.json(rows[0]);
}));

router.delete('/subscription-plans/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM subscription_plans WHERE id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
}));

router.get('/settings', wrap(async (_req, res) => {
  res.json(await listAppSettings());
}));

router.post('/settings', wrap(async (req, res) => {
  const id = uuid();
  const key = String(req.body?.key || '').trim().toLowerCase();
  if (!/^[a-z0-9_]+$/.test(key)) {
    return res.status(400).json({ error: 'Setting key must use lowercase letters, numbers, and underscores only', code: 'VALIDATION_ERROR' });
  }

  const [existingRows] = await db.query('SELECT id FROM app_settings WHERE `key` = ? LIMIT 1', [key]);
  if (existingRows[0]) {
    return res.status(409).json({ error: 'A setting with this key already exists', code: 'CONFLICT' });
  }

  await db.query('INSERT INTO app_settings (id, `key`, value) VALUES (?, ?, ?)', [
    id,
    key,
    serializeAppSettingValue(req.body?.value),
  ]);
  const [rows] = await db.query('SELECT * FROM app_settings WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
}));

router.patch('/settings/:id', wrap(async (req, res) => {
  const { id } = req.params;
  if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'value')) {
    return res.status(400).json({ error: 'A value is required', code: 'VALIDATION_ERROR' });
  }

  await db.query('UPDATE app_settings SET value = ? WHERE id = ?', [
    serializeAppSettingValue(req.body?.value),
    id,
  ]);
  const [rows] = await db.query('SELECT * FROM app_settings WHERE id = ?', [id]);
  if (!rows[0]) {
    return res.status(404).json({ error: 'Setting not found', code: 'NOT_FOUND' });
  }
  res.json(rows[0]);
}));

router.delete('/settings/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM app_settings WHERE id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
}));

/* ─── Activity Logs ────────────────────────────────────────── */
router.get('/activity-logs', wrap(async (_req, res) => {
  const [logs] = await db.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100');
  res.json(logs);
}));

/* ─── Notifications ────────────────────────────────────────── */
router.get('/notifications', wrap(async (_req, res) => {
  // Fix: some DBs use user_id IS NULL for admin notifications
  const [notifs] = await db.query('SELECT * FROM notifications WHERE user_id IS NULL ORDER BY created_at DESC LIMIT 50');
  res.json(notifs);
}));

router.patch('/notifications/mark-all-read', wrap(async (_req, res) => {
  await db.query('UPDATE notifications SET is_read = 1 WHERE user_id IS NULL AND is_read = 0');
  res.json({ success: true });
}));

router.patch('/notifications/:id', wrap(async (req, res) => {
  const { is_read } = req.body;
  await db.query('UPDATE notifications SET is_read = ? WHERE id = ?', [is_read ? 1 : 0, req.params.id]);
  res.json({ success: true });
}));

router.delete('/notifications', wrap(async (_req, res) => {
  await db.query('DELETE FROM notifications WHERE user_id IS NULL');
  res.json({ success: true });
}));

export default router;
