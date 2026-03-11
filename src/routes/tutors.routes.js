import { Router } from 'express';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { upsertTutorSchema } from '../schemas/tutor.schema.js';
import { getPagination } from '../utils/pagination.js';
import { wrap } from '../middleware/error-handler.js';
import { toPublicUploadDocuments, toPublicUploadUrl, toStoredUploadDocuments, toStoredUploadPath } from '../utils/uploads.js';
import { assertAppSettingEnabled, assertPlatformWritable, getAppSettingValue } from '../utils/app-settings.js';

const router = Router();
const TUTOR_PRICING_TYPES = new Set(['hour', 'week', 'month', 'contract']);
const DEFAULT_TUTOR_PRICING_TYPE = 'hour';

function readTutorPricingType(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return TUTOR_PRICING_TYPES.has(normalized) ? normalized : null;
}

function toTutorResponse(tutor) {
  if (!tutor) return tutor;

  return {
    ...tutor,
    open_to_work: !!tutor.open_to_work,
    profile_photo_url: toPublicUploadUrl(tutor.profile_photo_url),
    photo: toPublicUploadUrl(tutor.photo),
    verification_documents: toPublicUploadDocuments(tutor.verification_documents),
  };
}

function buildTutorFilters(query) {
  const filters = [];
  const params = [];

  if (query.subject) {
    filters.push('JSON_CONTAINS(tp.subjects, JSON_QUOTE(?))');
    params.push(query.subject);
  }
  if (query.city) {
    filters.push('p.city = ?');
    params.push(query.city);
  }
  if (query.level) {
    filters.push('JSON_CONTAINS(tp.levels, JSON_QUOTE(?))');
    params.push(query.level);
  }
  if (query.language) {
    filters.push('JSON_CONTAINS(tp.languages, JSON_QUOTE(?))');
    params.push(query.language);
  }
  if (query.gender) {
    filters.push('tp.gender = ?');
    params.push(query.gender);
  }
  if (query.online === 'true') {
    filters.push('tp.online_available = TRUE');
  }
  if (query.openToWork === 'true') {
    filters.push('tp.open_to_work = TRUE');
  }
  const pricingType = readTutorPricingType(query.pricingType || query.pricing_type);
  if (pricingType) {
    filters.push('COALESCE(tp.pricing_type, ?) = ?');
    params.push(DEFAULT_TUTOR_PRICING_TYPE, pricingType);
  }
  if (query.minPrice) {
    filters.push('tp.online_hourly >= ?');
    params.push(Number(query.minPrice));
  }
  if (query.maxPrice) {
    filters.push('tp.online_hourly <= ?');
    params.push(Number(query.maxPrice));
  }
  if (query.q) {
    filters.push('(p.full_name LIKE ? OR p.city LIKE ? OR JSON_SEARCH(tp.subjects, "one", ?) IS NOT NULL)');
    const q = `%${query.q}%`;
    params.push(q, q, query.q);
  }

  return { filters, params };
}

router.get('/stats', wrap(async (_req, res) => {
  const [[verifiedTutorRow]] = await db.query(
    `SELECT COUNT(*) AS verified_tutors
     FROM tutor_profiles tp
     JOIN profiles p ON p.user_id = tp.user_id
     WHERE tp.verification_status = 'verified'
       AND p.status = 'active'`
  );

  const [[averageRatingRow]] = await db.query(
    `SELECT COALESCE(AVG(r.rating), 0) AS average_rating
     FROM reviews r
     JOIN tutor_profiles tp ON tp.id = r.tutor_id
     JOIN profiles p ON p.user_id = tp.user_id
     WHERE tp.verification_status = 'verified'
       AND p.status = 'active'`
  );

  const [[lessonCompletionRow]] = await db.query(
    `SELECT COUNT(*) AS completed_lessons
     FROM lesson_progress
     WHERE completed = TRUE`
  );

  res.json({
    verified_tutors: Number(verifiedTutorRow?.verified_tutors || 0),
    average_rating: Number(parseFloat(averageRatingRow?.average_rating || 0).toFixed(1)),
    completed_lessons: Number(lessonCompletionRow?.completed_lessons || 0),
  });
}));

router.get('/', wrap(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { filters, params } = buildTutorFilters(req.query);

  const where = [
    "tp.verification_status = 'verified'",
    "p.status = 'active'",
    ...filters
  ].join(' AND ');

  const listSql = `
    SELECT
      tp.id,
      tp.user_id,
      p.full_name AS name,
      tp.profile_photo_url AS photo,
      tp.subjects,
      COALESCE(p.city, JSON_UNQUOTE(JSON_EXTRACT(tp.service_areas, '$[0]')), 'Online') AS city,
      tp.online_available AS online,
      tp.offline_available AS offline,
      COALESCE(tp.pricing_type, '${DEFAULT_TUTOR_PRICING_TYPE}') AS pricing_type,
      tp.online_hourly AS price_per_hour,
      tp.offline_hourly AS offline_price,
      tp.currency,
      tp.verified_badge AS verified,
      tp.bio,
      tp.education,
      tp.experience_years,
      tp.languages,
      tp.gender,
      tp.levels,
      tp.availability,
      tp.teaching_style,
      tp.service_areas,
      tp.open_to_work,
      tp.packages,
      COALESCE(AVG(r.rating), 0) AS rating,
      COUNT(r.id) AS review_count
    FROM tutor_profiles tp
    JOIN profiles p ON p.user_id = tp.user_id
    LEFT JOIN reviews r ON r.tutor_id = tp.id
    WHERE ${where}
    GROUP BY tp.id
    ORDER BY tp.verified_badge DESC, rating DESC
    LIMIT ? OFFSET ?
  `;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM tutor_profiles tp
    JOIN profiles p ON p.user_id = tp.user_id
    WHERE ${where}
  `;

  const [rows] = await db.query(listSql, [...params, limit, offset]);
  const [countRows] = await db.query(countSql, params);
  const total = countRows[0]?.total || 0;

  const tutors = rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    name: r.name || 'Tutor',
    photo: toPublicUploadUrl(r.photo),
    subjects: r.subjects || [],
    city: r.city,
    online: !!r.online,
    offline: !!r.offline,
    pricingType: r.pricing_type || DEFAULT_TUTOR_PRICING_TYPE,
    pricePerHour: Number(r.price_per_hour || 0),
    offlinePrice: r.offline_price != null ? Number(r.offline_price) : null,
    currency: r.currency || 'USD',
    rating: Number(parseFloat(r.rating || 0).toFixed(1)),
    reviewCount: Number(r.review_count || 0),
    verified: !!r.verified,
    bio: r.bio,
    education: r.education,
    experienceYears: r.experience_years || 0,
    languages: r.languages || [],
    gender: r.gender,
    levels: r.levels || [],
    availability: r.availability || [],
    teachingStyle: r.teaching_style,
    serviceAreas: r.service_areas || [],
    openToWork: !!r.open_to_work,
    packages: r.packages || []
  }));

  res.json({
    tutors,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  });
}));

router.get('/me', authMiddleware, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM tutor_profiles WHERE user_id = ?', [req.user.id]);
  const tutor = rows[0];
  if (!tutor) return res.json(null);
  res.json(toTutorResponse(tutor));
}));

router.get('/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query(
    `SELECT
      tp.id,
      tp.user_id,
      p.full_name AS name,
      tp.profile_photo_url AS photo,
      tp.subjects,
      COALESCE(p.city, JSON_UNQUOTE(JSON_EXTRACT(tp.service_areas, '$[0]')), 'Online') AS city,
      tp.online_available AS online,
      tp.offline_available AS offline,
      COALESCE(tp.pricing_type, '${DEFAULT_TUTOR_PRICING_TYPE}') AS pricing_type,
      tp.online_hourly AS price_per_hour,
      tp.offline_hourly AS offline_price,
      tp.currency,
      tp.verified_badge AS verified,
      tp.bio,
      tp.education,
      tp.experience_years,
      tp.languages,
      tp.gender,
      tp.levels,
      tp.availability,
      tp.teaching_style,
      tp.service_areas,
      tp.open_to_work,
      tp.packages,
      COALESCE(AVG(r.rating), 0) AS rating,
      COUNT(r.id) AS review_count
    FROM tutor_profiles tp
    JOIN profiles p ON p.user_id = tp.user_id
    LEFT JOIN reviews r ON r.tutor_id = tp.id
    WHERE tp.id = ?
    GROUP BY tp.id`,
    [id]
  );

  const r = rows[0];
  if (!r) return res.status(404).json({ error: 'Tutor not found', code: 'NOT_FOUND' });

  res.json({
    id: r.id,
    userId: r.user_id,
    name: r.name || 'Tutor',
    photo: toPublicUploadUrl(r.photo),
    subjects: r.subjects || [],
    city: r.city,
    online: !!r.online,
    offline: !!r.offline,
    pricingType: r.pricing_type || DEFAULT_TUTOR_PRICING_TYPE,
    pricePerHour: Number(r.price_per_hour || 0),
    offlinePrice: r.offline_price != null ? Number(r.offline_price) : null,
    currency: r.currency || 'USD',
    rating: Number(parseFloat(r.rating || 0).toFixed(1)),
    reviewCount: Number(r.review_count || 0),
    verified: !!r.verified,
    bio: r.bio,
    education: r.education,
    experienceYears: r.experience_years || 0,
    languages: r.languages || [],
    gender: r.gender,
    levels: r.levels || [],
    availability: r.availability || [],
    teachingStyle: r.teaching_style,
    serviceAreas: r.service_areas || [],
    openToWork: !!r.open_to_work,
    packages: r.packages || []
  });
}));

router.post('/', authMiddleware, validateBody(upsertTutorSchema), wrap(async (req, res) => {
  await assertPlatformWritable();
  await assertAppSettingEnabled('allow_tutor_registration', 'Tutor registration is currently disabled.');

  const data = req.body;
  const [rows] = await db.query('SELECT id FROM tutor_profiles WHERE user_id = ?', [req.user.id]);
  const existing = rows[0];
  const defaultCurrency = await getAppSettingValue('currency_default', 'USD');

  const payload = {
    pricing_type: readTutorPricingType(data.pricing_type) || DEFAULT_TUTOR_PRICING_TYPE,
    bio: data.bio,
    education: data.education || null,
    teaching_style: data.teaching_style || null,
    experience_years: data.experience_years || 0,
    gender: data.gender || null,
    subjects: JSON.stringify(data.subjects || []),
    levels: JSON.stringify(data.levels || []),
    languages: JSON.stringify(data.languages || []),
    service_areas: JSON.stringify(data.service_areas || []),
    online_available: data.online_available !== undefined ? data.online_available : true,
    offline_available: data.offline_available !== undefined ? data.offline_available : false,
    online_hourly: (readTutorPricingType(data.pricing_type) || DEFAULT_TUTOR_PRICING_TYPE) === 'contract' ? 0 : (data.online_hourly || 0),
    offline_hourly: (readTutorPricingType(data.pricing_type) || DEFAULT_TUTOR_PRICING_TYPE) === 'contract' ? null : (data.offline_hourly ?? null),
    currency: data.currency || defaultCurrency,
    availability: JSON.stringify(data.availability || []),
    packages: JSON.stringify(data.packages || []),
    profile_photo_url: toStoredUploadPath(data.profile_photo_url),
    open_to_work: data.open_to_work === true,
    verification_documents: data.verification_documents ? JSON.stringify(toStoredUploadDocuments(data.verification_documents)) : null
  };

  if (existing) {
    await db.query(
      `UPDATE tutor_profiles SET
        bio = ?, education = ?, teaching_style = ?, experience_years = ?, gender = ?, subjects = ?,
        levels = ?, languages = ?, service_areas = ?, online_available = ?, offline_available = ?,
        pricing_type = ?, online_hourly = ?, offline_hourly = ?, currency = ?, availability = ?, packages = ?, profile_photo_url = ?, open_to_work = ?, verification_documents = ?
       WHERE user_id = ?`,
      [
        payload.bio, payload.education, payload.teaching_style, payload.experience_years, payload.gender, payload.subjects,
        payload.levels, payload.languages, payload.service_areas, payload.online_available, payload.offline_available,
        payload.pricing_type, payload.online_hourly, payload.offline_hourly, payload.currency, payload.availability, payload.packages, payload.profile_photo_url, payload.open_to_work, payload.verification_documents,
        req.user.id
      ]
    );
  } else {
    await db.query(
      `INSERT INTO tutor_profiles
       (user_id, bio, education, teaching_style, experience_years, gender, subjects, levels, languages, service_areas,
        online_available, offline_available, pricing_type, online_hourly, offline_hourly, currency, availability, packages, profile_photo_url, open_to_work, verification_documents, verification_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        req.user.id,
        payload.bio,
        payload.education,
        payload.teaching_style,
        payload.experience_years,
        payload.gender,
        payload.subjects,
        payload.levels,
        payload.languages,
        payload.service_areas,
        payload.online_available,
        payload.offline_available,
        payload.pricing_type,
        payload.online_hourly,
        payload.offline_hourly,
        payload.currency,
        payload.availability,
        payload.packages,
        payload.profile_photo_url,
        payload.open_to_work,
        payload.verification_documents
      ]
    );
  }

  const [updated] = await db.query('SELECT * FROM tutor_profiles WHERE user_id = ?', [req.user.id]);
  res.json(toTutorResponse(updated[0]));
}));

router.patch('/:id', authMiddleware, validateBody(upsertTutorSchema.partial()), wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query('SELECT user_id FROM tutor_profiles WHERE id = ?', [id]);
  const tutor = rows[0];
  if (!tutor) return res.status(404).json({ error: 'Tutor not found', code: 'NOT_FOUND' });
  if (tutor.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  const updates = req.body;
  const fields = [];
  const values = [];

  const jsonFields = new Set(['subjects', 'levels', 'languages', 'service_areas', 'availability', 'packages']);

  for (const key of Object.keys(updates)) {
    fields.push(`${key} = ?`);
    let val = updates[key];
    if (jsonFields.has(key)) {
      val = JSON.stringify(updates[key]);
    } else if (key === 'profile_photo_url') {
      val = toStoredUploadPath(updates[key]);
    } else if (key === 'verification_documents') {
      val = JSON.stringify(toStoredUploadDocuments(updates[key]));
    }
    values.push(val);
  }

  if (fields.length === 0) return res.json({ message: 'No changes' });

  values.push(id);
  await db.query(`UPDATE tutor_profiles SET ${fields.join(', ')} WHERE id = ?`, values);
  const [updated] = await db.query('SELECT * FROM tutor_profiles WHERE id = ?', [id]);
  res.json(toTutorResponse(updated[0]));
}));

export default router;
