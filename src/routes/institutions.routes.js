import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import {
  institutionJobApplicationArchiveSchema,
  institutionJobApplicationCreateSchema,
  institutionJobApplicationUpdateSchema,
  institutionJobSchema,
  upsertInstitutionSchema,
} from '../schemas/institution.schema.js';
import { getPagination } from '../utils/pagination.js';
import { wrap } from '../middleware/error-handler.js';
import { toPublicUploadDocuments, toPublicUploadUrl } from '../utils/uploads.js';
import {
  assertAppSettingVisibilityAllowed,
  assertPlatformWritable,
  getAppSettingValue,
} from '../utils/app-settings.js';
import { createImportantUserNotification } from '../utils/notification-delivery.js';

const router = Router();
const INSTITUTION_APPROVAL_STATUSES = new Set(['pending', 'approved', 'rejected', 'suspended']);
const JOB_APPLICATION_STATUSES = new Set(['pending', 'documents_requested', 'approved', 'rejected']);

async function loadInstitutionAccessByUserId(userId, executor = db) {
  const [rows] = await executor.query(
    `SELECT p.role, ip.id AS institution_id, ip.approval_status
     FROM profiles p
     LEFT JOIN institution_profiles ip ON ip.user_id = p.user_id
     WHERE p.user_id = ?
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function institutionOnly(req, res, next) {
  const access = await loadInstitutionAccessByUserId(req.user.id);
  if (!access || access.role !== 'institution') {
    return res.status(403).json({ error: 'Institution account required', code: 'FORBIDDEN' });
  }
  req.institutionAccess = access;
  next();
}

async function approvedInstitutionOnly(req, res, next) {
  const access = req.institutionAccess || await loadInstitutionAccessByUserId(req.user.id);
  if (!access || access.role !== 'institution') {
    return res.status(403).json({ error: 'Institution account required', code: 'FORBIDDEN' });
  }
  if (!access.institution_id) {
    return res.status(403).json({ error: 'Institution profile required', code: 'FORBIDDEN' });
  }
  if (access.approval_status !== 'approved') {
    return res.status(403).json({ error: 'Institution approval required', code: 'FORBIDDEN' });
  }
  req.institutionAccess = access;
  next();
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function normalizeDateTime(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `${normalized} 23:59:59`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized.replace('T', ' ')}:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(normalized)) {
    return normalized.replace('T', ' ').slice(0, 19);
  }

  return normalized;
}

function normalizeOptionalPositiveInt(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) return null;
  return numeric;
}

function normalizeJobApplicationStatus(status) {
  return JOB_APPLICATION_STATUSES.has(status) ? status : 'pending';
}

function toInstitutionProfileResponse(profile) {
  if (!profile) return null;

  return {
    ...profile,
    approval_status: INSTITUTION_APPROVAL_STATUSES.has(profile.approval_status) ? profile.approval_status : 'pending',
    institution_name: profile.institution_name || profile.full_name,
    city: profile.city || null,
    logo_url: toPublicUploadUrl(profile.logo_url || profile.institution_logo_url || null),
    contact_email: profile.contact_email || profile.email || null,
    contact_phone: profile.contact_phone || profile.phone || null,
  };
}

function toInstitutionJobResponse(job) {
  if (!job) return null;

  return {
    id: job.id,
    institution_id: job.institution_id,
    user_id: job.user_id,
    title: job.title,
    description: job.description,
    subject: job.subject || null,
    level: job.level || null,
    city: job.job_city || job.institution_city || null,
    employment_type: job.employment_type || 'part_time',
    work_mode: job.work_mode || 'on_site',
    salary_amount: job.salary_amount != null ? Number(job.salary_amount) : null,
    salary_currency: job.salary_currency || 'USD',
    salary_period: job.salary_period || 'month',
    requirements: Array.isArray(job.requirements) ? job.requirements : [],
    benefits: Array.isArray(job.benefits) ? job.benefits : [],
    application_email: job.application_email || job.institution_contact_email || null,
    application_phone: job.application_phone || job.institution_contact_phone || null,
    application_url: job.application_url || null,
    max_applications: normalizeOptionalPositiveInt(job.max_applications),
    expires_at: job.expires_at || null,
    is_active: !!job.is_active,
    application_count: Number(job.application_count || 0),
    pending_application_count: Number(job.pending_application_count || 0),
    remaining_application_slots: normalizeOptionalPositiveInt(job.max_applications) == null
      ? null
      : Math.max(normalizeOptionalPositiveInt(job.max_applications) - Number(job.application_count || 0), 0),
    application_limit_reached:
      normalizeOptionalPositiveInt(job.max_applications) != null
      && Number(job.application_count || 0) >= normalizeOptionalPositiveInt(job.max_applications),
    current_user_application_id: job.current_user_application_id || null,
    current_user_application_status: job.current_user_application_status
      ? normalizeJobApplicationStatus(job.current_user_application_status)
      : null,
    current_user_applied_at: job.current_user_applied_at || null,
    created_at: job.created_at,
    updated_at: job.updated_at,
    institution: {
      id: job.institution_id,
      name: job.institution_name,
      type: job.institution_type,
      city: job.institution_city || null,
      logo_url: toPublicUploadUrl(job.institution_logo_url || null),
      website_url: job.website_url || null,
      contact_email: job.institution_contact_email || null,
      contact_phone: job.institution_contact_phone || null,
    },
  };
}

function toInstitutionJobApplicationResponse(application) {
  if (!application) return null;

  return {
    id: application.id,
    job_id: application.job_id,
    institution_id: application.institution_id,
    institution_user_id: application.institution_user_id,
    tutor_user_id: application.tutor_user_id,
    tutor_profile_id: application.tutor_profile_id,
    cover_message: application.cover_message,
    document_url: toPublicUploadUrl(application.document_url || null),
    status: normalizeJobApplicationStatus(application.status),
    institution_notes: application.institution_notes || null,
    reviewed_at: application.reviewed_at || null,
    archived_by_institution: !!application.archived_by_institution,
    archived_at: application.archived_at || null,
    created_at: application.created_at,
    updated_at: application.updated_at,
    job: {
      id: application.job_id,
      title: application.job_title,
      city: application.job_city || null,
      subject: application.job_subject || null,
      level: application.job_level || null,
      work_mode: application.job_work_mode || 'on_site',
      employment_type: application.job_employment_type || 'part_time',
    },
    applicant: {
      user_id: application.applicant_user_id,
      tutor_profile_id: application.applicant_tutor_profile_id,
      full_name: application.applicant_name || 'Tutor',
      email: application.applicant_email || null,
      phone: application.applicant_phone || null,
      city: application.applicant_city || null,
      profile_photo_url: toPublicUploadUrl(application.applicant_profile_photo_url || null),
      verified: !!application.applicant_verified_badge,
      open_to_work: !!application.applicant_open_to_work,
      subjects: Array.isArray(application.applicant_subjects) ? application.applicant_subjects : [],
      levels: Array.isArray(application.applicant_levels) ? application.applicant_levels : [],
      education: application.applicant_education || null,
      experience_years: Number(application.applicant_experience_years || 0),
      bio: application.applicant_bio || null,
      verification_documents: toPublicUploadDocuments(
        Array.isArray(application.applicant_verification_documents) ? application.applicant_verification_documents : [],
      ),
    },
  };
}

async function loadInstitutionProfileByUserId(userId, executor = db) {
  const [rows] = await executor.query(
    `SELECT ip.*, p.full_name, p.email, p.phone
     FROM institution_profiles ip
     JOIN profiles p ON p.user_id = ip.user_id
     WHERE ip.user_id = ?
     LIMIT 1`,
    [userId]
  );

  return toInstitutionProfileResponse(rows[0] || null);
}

async function loadInstitutionJobsByUserId(userId, executor = db) {
  const [rows] = await executor.query(
    `SELECT
      ij.*,
      COALESCE(ij.city, ip.city, p.city) AS job_city,
      COALESCE(ip.city, p.city) AS institution_city,
      ip.institution_name,
      ip.institution_type,
      ip.logo_url AS institution_logo_url,
      ip.website_url,
      ip.contact_email AS institution_contact_email,
      ip.contact_phone AS institution_contact_phone,
      COALESCE(app_counts.application_count, 0) AS application_count,
      COALESCE(app_counts.pending_application_count, 0) AS pending_application_count
     FROM institution_jobs ij
     JOIN institution_profiles ip ON ip.id = ij.institution_id
     JOIN profiles p ON p.user_id = ip.user_id
     LEFT JOIN (
       SELECT
         job_id,
         COUNT(*) AS application_count,
         SUM(CASE WHEN status IN ('pending', 'documents_requested') THEN 1 ELSE 0 END) AS pending_application_count
       FROM institution_job_applications
       WHERE archived_by_institution = FALSE
       GROUP BY job_id
     ) app_counts ON app_counts.job_id = ij.id
     WHERE ij.user_id = ?
     ORDER BY ij.created_at DESC`,
    [userId]
  );

  return rows.map((row) => toInstitutionJobResponse(row));
}

async function loadInstitutionJobApplicationsByUserId(userId, executor = db) {
  const [rows] = await executor.query(
    `SELECT
      ija.*,
      ip.institution_name,
      ij.title AS job_title,
      COALESCE(ij.city, ip.city, p_institution.city) AS job_city,
      ij.subject AS job_subject,
      ij.level AS job_level,
      ij.work_mode AS job_work_mode,
      ij.employment_type AS job_employment_type,
      tutor.user_id AS applicant_user_id,
      tutor.full_name AS applicant_name,
      tutor.email AS applicant_email,
      tutor.phone AS applicant_phone,
      tutor.city AS applicant_city,
      tp.id AS applicant_tutor_profile_id,
      tp.profile_photo_url AS applicant_profile_photo_url,
      tp.verified_badge AS applicant_verified_badge,
      tp.open_to_work AS applicant_open_to_work,
      tp.subjects AS applicant_subjects,
      tp.levels AS applicant_levels,
      tp.education AS applicant_education,
      tp.experience_years AS applicant_experience_years,
      tp.bio AS applicant_bio,
      tp.verification_documents AS applicant_verification_documents
     FROM institution_job_applications ija
     JOIN institution_jobs ij ON ij.id = ija.job_id
     JOIN institution_profiles ip ON ip.id = ija.institution_id
     JOIN profiles p_institution ON p_institution.user_id = ip.user_id
     JOIN tutor_profiles tp ON tp.id = ija.tutor_profile_id
     JOIN profiles tutor ON tutor.user_id = ija.tutor_user_id
     WHERE ija.institution_user_id = ?
     ORDER BY
       ija.archived_by_institution ASC,
       FIELD(ija.status, 'pending', 'documents_requested', 'approved', 'rejected'),
       ija.created_at DESC`,
    [userId]
  );

  return rows.map((row) => toInstitutionJobApplicationResponse(row));
}

async function loadInstitutionJobApplicationByIdForInstitution(applicationId, institutionUserId, executor = db) {
  const [rows] = await executor.query(
    `SELECT
      ija.*,
      ip.institution_name,
      ij.title AS job_title,
      COALESCE(ij.city, ip.city, p_institution.city) AS job_city,
      ij.subject AS job_subject,
      ij.level AS job_level,
      ij.work_mode AS job_work_mode,
      ij.employment_type AS job_employment_type,
      tutor.user_id AS applicant_user_id,
      tutor.full_name AS applicant_name,
      tutor.email AS applicant_email,
      tutor.phone AS applicant_phone,
      tutor.city AS applicant_city,
      tp.id AS applicant_tutor_profile_id,
      tp.profile_photo_url AS applicant_profile_photo_url,
      tp.verified_badge AS applicant_verified_badge,
      tp.open_to_work AS applicant_open_to_work,
      tp.subjects AS applicant_subjects,
      tp.levels AS applicant_levels,
      tp.education AS applicant_education,
      tp.experience_years AS applicant_experience_years,
      tp.bio AS applicant_bio,
      tp.verification_documents AS applicant_verification_documents
     FROM institution_job_applications ija
     JOIN institution_jobs ij ON ij.id = ija.job_id
     JOIN institution_profiles ip ON ip.id = ija.institution_id
     JOIN profiles p_institution ON p_institution.user_id = ip.user_id
     JOIN tutor_profiles tp ON tp.id = ija.tutor_profile_id
     JOIN profiles tutor ON tutor.user_id = ija.tutor_user_id
     WHERE ija.id = ?
       AND ija.institution_user_id = ?
     LIMIT 1`,
    [applicationId, institutionUserId]
  );

  return toInstitutionJobApplicationResponse(rows[0] || null);
}

function buildInstitutionJobFilters(query) {
  const filters = [
    'ij.is_active = TRUE',
    '(ij.expires_at IS NULL OR ij.expires_at >= NOW())',
    "ip.approval_status = 'approved'",
  ];
  const params = [];

  if (query.city) {
    filters.push('COALESCE(ij.city, ip.city, p.city) = ?');
    params.push(query.city);
  }

  if (query.subject) {
    filters.push('ij.subject = ?');
    params.push(query.subject);
  }

  if (query.level) {
    filters.push('ij.level = ?');
    params.push(query.level);
  }

  if (query.workMode) {
    filters.push('ij.work_mode = ?');
    params.push(query.workMode);
  }

  if (query.employmentType) {
    filters.push('ij.employment_type = ?');
    params.push(query.employmentType);
  }

  if (query.institutionType) {
    filters.push('ip.institution_type = ?');
    params.push(query.institutionType);
  }

  if (query.q) {
    const search = `%${query.q}%`;
    filters.push('(ij.title LIKE ? OR ij.description LIKE ? OR ip.institution_name LIKE ? OR COALESCE(ij.subject, "") LIKE ? OR COALESCE(ij.city, ip.city, p.city, "") LIKE ?)');
    params.push(search, search, search, search, search);
  }

  return { filters, params };
}

router.get('/jobs', authMiddleware, wrap(async (req, res) => {
  await assertAppSettingVisibilityAllowed('tutor_jobs_visibility', req.user?.id, {
    fallback: 'public_except_students',
    message: 'Tutor jobs are not available for your account.',
  });

  const { page, limit, offset } = getPagination(req.query);
  const { filters, params } = buildInstitutionJobFilters(req.query);
  const where = filters.join(' AND ');

  const listSql = `
    SELECT
      ij.*,
      COALESCE(ij.city, ip.city, p.city) AS job_city,
      COALESCE(ip.city, p.city) AS institution_city,
      ip.institution_name,
      ip.institution_type,
      ip.logo_url AS institution_logo_url,
      ip.website_url,
      ip.contact_email AS institution_contact_email,
      ip.contact_phone AS institution_contact_phone,
      COALESCE(app_counts.application_count, 0) AS application_count,
      COALESCE(app_counts.pending_application_count, 0) AS pending_application_count,
      current_app.id AS current_user_application_id,
      current_app.status AS current_user_application_status,
      current_app.created_at AS current_user_applied_at
    FROM institution_jobs ij
    JOIN institution_profiles ip ON ip.id = ij.institution_id
    JOIN profiles p ON p.user_id = ip.user_id
    LEFT JOIN (
      SELECT
        job_id,
        COUNT(*) AS application_count,
        SUM(CASE WHEN status IN ('pending', 'documents_requested') THEN 1 ELSE 0 END) AS pending_application_count
      FROM institution_job_applications
      WHERE archived_by_institution = FALSE
      GROUP BY job_id
    ) app_counts ON app_counts.job_id = ij.id
    LEFT JOIN institution_job_applications current_app
      ON current_app.job_id = ij.id
      AND current_app.tutor_user_id = ?
    WHERE ${where}
    ORDER BY COALESCE(ij.expires_at, DATE_ADD(NOW(), INTERVAL 365 DAY)) ASC, ij.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM institution_jobs ij
    JOIN institution_profiles ip ON ip.id = ij.institution_id
    JOIN profiles p ON p.user_id = ip.user_id
    WHERE ${where}
  `;

  const [rows] = await db.query(listSql, [req.user.id, ...params, limit, offset]);
  const [countRows] = await db.query(countSql, params);
  const total = countRows[0]?.total || 0;

  res.json({
    jobs: rows.map((row) => toInstitutionJobResponse(row)),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}));

router.get('/me', authMiddleware, institutionOnly, wrap(async (req, res) => {
  res.json(await loadInstitutionProfileByUserId(req.user.id));
}));

router.post('/me', authMiddleware, institutionOnly, validateBody(upsertInstitutionSchema), wrap(async (req, res) => {
  await assertPlatformWritable();

  const data = req.body;
  const [rows] = await db.query('SELECT id, approval_status FROM institution_profiles WHERE user_id = ? LIMIT 1', [req.user.id]);
  const existing = rows[0];

  const payload = {
    institution_name: data.institution_name.trim(),
    institution_type: data.institution_type,
    description: normalizeOptionalString(data.description),
    website_url: normalizeOptionalString(data.website_url),
    address: normalizeOptionalString(data.address),
    city: normalizeOptionalString(data.city),
    contact_person_name: normalizeOptionalString(data.contact_person_name),
    contact_person_title: normalizeOptionalString(data.contact_person_title),
    contact_email: normalizeOptionalString(data.contact_email),
    contact_phone: normalizeOptionalString(data.contact_phone),
  };

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const nextApprovalStatus = existing?.approval_status === 'rejected'
      ? 'pending'
      : (existing?.approval_status || 'pending');

    await conn.query(
      `UPDATE profiles
       SET full_name = ?, city = ?, phone = ?, role = 'institution', is_parent = FALSE, student_level = NULL
       WHERE user_id = ?`,
      [payload.institution_name, payload.city, payload.contact_phone, req.user.id]
    );

    if (existing) {
      await conn.query(
        `UPDATE institution_profiles SET
          institution_name = ?, institution_type = ?, description = ?, website_url = ?, address = ?, city = ?,
          contact_person_name = ?, contact_person_title = ?, contact_email = ?, contact_phone = ?, approval_status = ?
         WHERE user_id = ?`,
        [
          payload.institution_name,
          payload.institution_type,
          payload.description,
          payload.website_url,
          payload.address,
          payload.city,
          payload.contact_person_name,
          payload.contact_person_title,
          payload.contact_email,
          payload.contact_phone,
          nextApprovalStatus,
          req.user.id,
        ]
      );
    } else {
      await conn.query(
        `INSERT INTO institution_profiles
         (id, user_id, institution_name, institution_type, description, website_url, address, city, contact_person_name, contact_person_title, contact_email, contact_phone, approval_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          req.user.id,
          payload.institution_name,
          payload.institution_type,
          payload.description,
          payload.website_url,
          payload.address,
          payload.city,
          payload.contact_person_name,
          payload.contact_person_title,
          payload.contact_email,
          payload.contact_phone,
          'pending',
        ]
      );
    }

    await conn.query(
      'CALL log_activity(?, ?, ?, ?, ?, ?)',
      [
        req.user.id,
        existing ? 'institution.profile.updated' : 'institution.profile.created',
        'institution',
        req.user.id,
        JSON.stringify({ institution_name: payload.institution_name, institution_type: payload.institution_type }),
        req.ip || null,
      ]
    );

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  res.json(await loadInstitutionProfileByUserId(req.user.id));
}));

router.get('/me/jobs', authMiddleware, institutionOnly, wrap(async (req, res) => {
  res.json(await loadInstitutionJobsByUserId(req.user.id));
}));

router.get('/me/job-applications', authMiddleware, institutionOnly, wrap(async (req, res) => {
  res.json(await loadInstitutionJobApplicationsByUserId(req.user.id));
}));

router.post('/jobs', authMiddleware, institutionOnly, approvedInstitutionOnly, validateBody(institutionJobSchema), wrap(async (req, res) => {
  await assertPlatformWritable();

  const [institutionRows] = await db.query(
    'SELECT id, city, contact_email, contact_phone FROM institution_profiles WHERE user_id = ? LIMIT 1',
    [req.user.id]
  );
  const institution = institutionRows[0];
  if (!institution) {
    return res.status(403).json({ error: 'Institution profile required', code: 'FORBIDDEN' });
  }

  const defaultCurrency = await getAppSettingValue('currency_default', 'USD');
  const data = req.body;
  const jobId = uuid();
  const payload = {
    title: data.title.trim(),
    description: data.description.trim(),
    subject: normalizeOptionalString(data.subject),
    level: normalizeOptionalString(data.level),
    city: normalizeOptionalString(data.city) || institution.city || null,
    employment_type: normalizeOptionalString(data.employment_type) || 'part_time',
    work_mode: normalizeOptionalString(data.work_mode) || 'on_site',
    salary_amount: data.salary_amount ?? null,
    salary_currency: normalizeOptionalString(data.salary_currency)?.toUpperCase() || defaultCurrency,
    salary_period: normalizeOptionalString(data.salary_period) || 'month',
    requirements: JSON.stringify(normalizeStringArray(data.requirements)),
    benefits: JSON.stringify(normalizeStringArray(data.benefits)),
    application_email: normalizeOptionalString(data.application_email),
    application_phone: normalizeOptionalString(data.application_phone),
    application_url: normalizeOptionalString(data.application_url),
    max_applications: normalizeOptionalPositiveInt(data.max_applications),
    expires_at: normalizeDateTime(data.expires_at),
    is_active: data.is_active !== false,
  };

  await db.query(
    `INSERT INTO institution_jobs
     (id, institution_id, user_id, title, description, subject, level, city, employment_type, work_mode, salary_amount, salary_currency, salary_period, requirements, benefits, application_email, application_phone, application_url, max_applications, expires_at, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      jobId,
      institution.id,
      req.user.id,
      payload.title,
      payload.description,
      payload.subject,
      payload.level,
      payload.city,
      payload.employment_type,
      payload.work_mode,
      payload.salary_amount,
      payload.salary_currency,
      payload.salary_period,
      payload.requirements,
      payload.benefits,
      payload.application_email,
      payload.application_phone,
      payload.application_url,
      payload.max_applications,
      payload.expires_at,
      payload.is_active,
    ]
  );

  await db.query(
    'CALL log_activity(?, ?, ?, ?, ?, ?)',
    [
      req.user.id,
      'institution.job.created',
      'institution_job',
      jobId,
      JSON.stringify({ title: payload.title }),
      req.ip || null,
    ]
  );

  const jobs = await loadInstitutionJobsByUserId(req.user.id);
  res.status(201).json(jobs.find((job) => job.id === jobId) || null);
}));

router.post('/jobs/:id/apply', authMiddleware, validateBody(institutionJobApplicationCreateSchema), wrap(async (req, res) => {
  await assertPlatformWritable();

  const { id } = req.params;
  const [jobRows] = await db.query(
    `SELECT
      ij.id,
      ij.title,
      ij.is_active,
      ij.expires_at,
      ij.max_applications,
      ij.institution_id,
      ij.user_id AS institution_user_id,
      ip.approval_status,
      ip.institution_name,
      (
        SELECT COUNT(*)
        FROM institution_job_applications active_applications
        WHERE active_applications.job_id = ij.id
          AND active_applications.archived_by_institution = FALSE
      ) AS active_application_count
     FROM institution_jobs ij
     JOIN institution_profiles ip ON ip.id = ij.institution_id
     WHERE ij.id = ?
     LIMIT 1`,
    [id]
  );
  const job = jobRows[0];
  if (!job) {
    return res.status(404).json({ error: 'Job not found', code: 'NOT_FOUND' });
  }
  if (!job.is_active || (job.expires_at && new Date(job.expires_at).getTime() < Date.now())) {
    return res.status(400).json({ error: 'This job is no longer accepting applications.', code: 'BAD_REQUEST' });
  }
  if (normalizeOptionalPositiveInt(job.max_applications) != null && Number(job.active_application_count || 0) >= normalizeOptionalPositiveInt(job.max_applications)) {
    return res.status(409).json({ error: 'This job has reached its application limit.', code: 'CONFLICT' });
  }
  if (job.approval_status !== 'approved') {
    return res.status(400).json({ error: 'This institution is not currently accepting applications.', code: 'BAD_REQUEST' });
  }
  if (job.institution_user_id === req.user.id) {
    return res.status(400).json({ error: 'You cannot apply to your own institution job.', code: 'BAD_REQUEST' });
  }

  const [applicantRows] = await db.query(
    `SELECT
      p.role,
      p.status,
      tp.id AS tutor_profile_id
     FROM profiles p
     LEFT JOIN tutor_profiles tp ON tp.user_id = p.user_id
     WHERE p.user_id = ?
     LIMIT 1`,
    [req.user.id]
  );
  const applicant = applicantRows[0];
  if (!applicant || applicant.role !== 'tutor' || !applicant.tutor_profile_id) {
    return res.status(403).json({ error: 'Only tutors with a completed tutor profile can apply.', code: 'FORBIDDEN' });
  }
  if (applicant.status && applicant.status !== 'active') {
    return res.status(403).json({ error: 'Your account is not allowed to apply to jobs.', code: 'FORBIDDEN' });
  }

  const [existingRows] = await db.query(
    'SELECT id FROM institution_job_applications WHERE job_id = ? AND tutor_user_id = ? LIMIT 1',
    [id, req.user.id]
  );
  if (existingRows[0]) {
    return res.status(409).json({ error: 'You have already applied to this job.', code: 'CONFLICT' });
  }

  const applicationId = uuid();
  const coverMessage = req.body.cover_message.trim();
  const documentUrl = normalizeOptionalString(req.body.document_url);

  await db.query(
    `INSERT INTO institution_job_applications
     (id, job_id, institution_id, institution_user_id, tutor_user_id, tutor_profile_id, cover_message, document_url, status, institution_notes, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL)`,
    [
      applicationId,
      id,
      job.institution_id,
      job.institution_user_id,
      req.user.id,
      applicant.tutor_profile_id,
      coverMessage,
      documentUrl,
    ]
  );

  const [nameRows] = await db.query(
    'SELECT full_name FROM profiles WHERE user_id = ? LIMIT 1',
    [req.user.id]
  );
  const tutorName = nameRows[0]?.full_name || 'A tutor';

  await createImportantUserNotification({
    serviceKey: 'job_applications',
    userId: job.institution_user_id,
    type: 'job_application_submitted',
    title: 'New job application',
    message: `${tutorName} applied for ${job.title}.`,
    metadata: {
      application_id: applicationId,
      job_id: id,
      path: '/institution-job-applications',
    },
  });

  await createImportantUserNotification({
    serviceKey: 'job_applications',
    userId: req.user.id,
    type: 'job_application_submitted',
    title: 'Application submitted',
    message: `Your application for ${job.title} was sent to ${job.institution_name || 'the institution'}.`,
    metadata: {
      application_id: applicationId,
      job_id: id,
      path: '/tutor-jobs',
    },
  });

  res.status(201).json({ id: applicationId, status: 'pending' });
}));

router.patch('/job-applications/:id', authMiddleware, institutionOnly, validateBody(institutionJobApplicationUpdateSchema), wrap(async (req, res) => {
  await assertPlatformWritable();

  const { id } = req.params;
  const existing = await loadInstitutionJobApplicationByIdForInstitution(id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
  }

  const nextStatus = req.body.status ? normalizeJobApplicationStatus(req.body.status) : existing.status;
  const nextNotes = Object.prototype.hasOwnProperty.call(req.body, 'institution_notes')
    ? normalizeOptionalString(req.body.institution_notes)
    : normalizeOptionalString(existing.institution_notes);

  if (nextStatus === existing.status && nextNotes === normalizeOptionalString(existing.institution_notes)) {
    return res.json(existing);
  }

  await db.query(
    `UPDATE institution_job_applications
     SET status = ?, institution_notes = ?, reviewed_at = NOW()
     WHERE id = ?`,
    [nextStatus, nextNotes, id]
  );

  const statusMessages = {
    pending: `Your application for ${existing.job.title} is under review.`,
    documents_requested: `The institution requested more documents or details for ${existing.job.title}.`,
    approved: `The institution approved your application for ${existing.job.title}.`,
    rejected: `The institution declined your application for ${existing.job.title}.`,
  };

  const noteSuffix = nextNotes ? ` Note: ${nextNotes}` : '';
  await createImportantUserNotification({
    serviceKey: 'job_applications',
    userId: existing.tutor_user_id,
    type: 'job_application_update',
    title: 'Application updated',
    message: `${statusMessages[nextStatus] || statusMessages.pending}${noteSuffix}`,
    metadata: {
      application_id: existing.id,
      job_id: existing.job_id,
      path: '/tutor-jobs',
    },
  });

  res.json(await loadInstitutionJobApplicationByIdForInstitution(id, req.user.id));
}));

router.patch('/job-applications/:id/archive', authMiddleware, institutionOnly, validateBody(institutionJobApplicationArchiveSchema), wrap(async (req, res) => {
  await assertPlatformWritable();

  const { id } = req.params;
  const existing = await loadInstitutionJobApplicationByIdForInstitution(id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
  }

  const archived = req.body.archived !== false;
  await db.query(
    `UPDATE institution_job_applications
     SET archived_by_institution = ?, archived_at = ?
     WHERE id = ?`,
    [archived, archived ? new Date() : null, id]
  );

  res.json(await loadInstitutionJobApplicationByIdForInstitution(id, req.user.id));
}));

router.delete('/job-applications/:id', authMiddleware, institutionOnly, wrap(async (req, res) => {
  await assertPlatformWritable();

  const { id } = req.params;
  const existing = await loadInstitutionJobApplicationByIdForInstitution(id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
  }

  await db.query('DELETE FROM institution_job_applications WHERE id = ? AND institution_user_id = ?', [id, req.user.id]);
  res.json({ message: 'Application deleted' });
}));

router.patch('/jobs/:id', authMiddleware, institutionOnly, approvedInstitutionOnly, validateBody(institutionJobSchema.partial()), wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query('SELECT user_id FROM institution_jobs WHERE id = ? LIMIT 1', [id]);
  const job = rows[0];
  if (!job) {
    return res.status(404).json({ error: 'Job not found', code: 'NOT_FOUND' });
  }
  if (job.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }

  const updates = req.body;
  const fields = [];
  const values = [];
  const jsonFields = new Set(['requirements', 'benefits']);

  for (const key of Object.keys(updates)) {
    let value = updates[key];

    if (key === 'title' || key === 'description') {
      value = typeof value === 'string' ? value.trim() : value;
    }

    if (jsonFields.has(key)) {
      value = JSON.stringify(normalizeStringArray(value));
    } else if (key === 'expires_at') {
      value = normalizeDateTime(value);
    } else if (key === 'salary_currency') {
      value = normalizeOptionalString(value)?.toUpperCase() || null;
    } else if (
      key === 'subject' ||
      key === 'level' ||
      key === 'city' ||
      key === 'employment_type' ||
      key === 'work_mode' ||
      key === 'salary_period' ||
      key === 'application_email' ||
      key === 'application_phone' ||
      key === 'application_url'
    ) {
      value = normalizeOptionalString(value);
    } else if (key === 'max_applications') {
      value = normalizeOptionalPositiveInt(value);
    }

    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) {
    const jobs = await loadInstitutionJobsByUserId(req.user.id);
    return res.json(jobs.find((entry) => entry.id === id) || null);
  }

  values.push(id);
  await db.query(`UPDATE institution_jobs SET ${fields.join(', ')} WHERE id = ?`, values);

  await db.query(
    'CALL log_activity(?, ?, ?, ?, ?, ?)',
    [
      req.user.id,
      'institution.job.updated',
      'institution_job',
      id,
      JSON.stringify({ fields: Object.keys(updates) }),
      req.ip || null,
    ]
  );

  const jobs = await loadInstitutionJobsByUserId(req.user.id);
  res.json(jobs.find((entry) => entry.id === id) || null);
}));

router.delete('/jobs/:id', authMiddleware, institutionOnly, approvedInstitutionOnly, wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query('SELECT user_id FROM institution_jobs WHERE id = ? LIMIT 1', [id]);
  const job = rows[0];
  if (!job) {
    return res.status(404).json({ error: 'Job not found', code: 'NOT_FOUND' });
  }
  if (job.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }

  await db.query('DELETE FROM institution_jobs WHERE id = ?', [id]);
  await db.query(
    'CALL log_activity(?, ?, ?, ?, ?, ?)',
    [
      req.user.id,
      'institution.job.deleted',
      'institution_job',
      id,
      JSON.stringify({ deleted: true }),
      req.ip || null,
    ]
  );

  res.json({ message: 'Job deleted' });
}));

export default router;
