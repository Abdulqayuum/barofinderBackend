import { v4 as uuid } from 'uuid';
import db from '../config/database.js';
import { toPublicUploadUrl } from './uploads.js';

const IMPORTANT_NOTIFICATION_EMAIL_SERVICE_DEFAULTS = [
  'reports',
  'verification',
  'institution_approvals',
  'job_applications',
  'enrollments',
];

export const APP_SETTINGS_CATALOG = [
  { key: 'site_name', defaultValue: 'BaroFinder', isPublic: true },
  { key: 'site_logo_url', defaultValue: '', isPublic: true },
  { key: 'platform_tagline', defaultValue: 'Find verified tutors and practical courses.', isPublic: true },
  { key: 'support_email', defaultValue: 'support@barofinder.com', isPublic: true },
  { key: 'support_phone', defaultValue: '', isPublic: true },
  { key: 'support_whatsapp', defaultValue: '', isPublic: true },
  { key: 'currency_default', defaultValue: 'USD', isPublic: true },
  { key: 'maintenance_mode', defaultValue: 'false', isPublic: true },
  {
    key: 'maintenance_message',
    defaultValue: 'BaroFinder is temporarily unavailable for maintenance. Please try again shortly.',
    isPublic: true,
  },
  { key: 'allow_new_registrations', defaultValue: 'true', isPublic: true },
  { key: 'allow_tutor_registration', defaultValue: 'true', isPublic: true },
  { key: 'allow_course_creation', defaultValue: 'true', isPublic: true },
  { key: 'allow_course_enrollment', defaultValue: 'true', isPublic: true },
  { key: 'show_tutor_report_button', defaultValue: 'true', isPublic: true },
  { key: 'show_learner_report_tutor_button', defaultValue: 'true', isPublic: true },
  { key: 'email_important_notifications', defaultValue: 'false', isPublic: false },
  { key: 'email_notification_services', defaultValue: IMPORTANT_NOTIFICATION_EMAIL_SERVICE_DEFAULTS, isPublic: false },
  { key: 'courses_visibility', defaultValue: 'public', isPublic: true },
  { key: 'tutor_jobs_visibility', defaultValue: 'public_except_students', isPublic: true },
  { key: 'max_file_upload_mb', defaultValue: '5', isPublic: true },
  { key: 'max_course_asset_size_mb', defaultValue: '100', isPublic: true },
  { key: 'admin_signature_name', defaultValue: 'Platform Administrator', isPublic: true },
  { key: 'certificate_footer_text', defaultValue: 'Issued by BaroFinder Learning Platform', isPublic: true },
];

const CONTENT_VISIBILITY_VALUES = new Set([
  'public',
  'signed_in',
  'public_except_students',
  'signed_in_except_students',
  'students',
  'parents',
  'tutors',
  'institutions',
  'admins',
  'students_parents',
  'tutors_institutions',
  'hidden',
]);

const APP_SETTINGS_BY_KEY = new Map(APP_SETTINGS_CATALOG.map((setting) => [setting.key, setting]));
const PUBLIC_APP_SETTING_KEYS = new Set(
  APP_SETTINGS_CATALOG.filter((setting) => setting.isPublic).map((setting) => setting.key),
);

function toPublicAppSettingRow(row) {
  if (!row) return row;

  if (row.key === 'site_logo_url') {
    return {
      ...row,
      value: toPublicUploadUrl(row.value),
    };
  }

  return row;
}

export function serializeAppSettingValue(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join(',');
  if (value == null) return '';
  return String(value);
}

export function parseBooleanAppSettingValue(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  return fallback;
}

export function parseNumberAppSettingValue(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function parseStringArrayAppSettingValue(value, fallback = []) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  }

  if (typeof value !== 'string') return [...fallback];

  const trimmed = value.trim();
  if (!trimmed) return [...fallback];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parseStringArrayAppSettingValue(parsed, fallback);
    }
  } catch {
    // fall back to comma-separated parsing
  }

  return [...new Set(trimmed.split(',').map((item) => item.trim()).filter(Boolean))];
}

export function normalizeContentVisibilityValue(value, fallback = 'public') {
  const normalized = String(value ?? '').trim().toLowerCase();
  return CONTENT_VISIBILITY_VALUES.has(normalized) ? normalized : fallback;
}

export function contentVisibilityRequiresAuth(value) {
  const visibility = normalizeContentVisibilityValue(value);

  return !['public', 'public_except_students', 'hidden'].includes(visibility);
}

export function canAccessContentVisibility(value, viewer = {}) {
  const visibility = normalizeContentVisibilityValue(value);
  const role = typeof viewer.role === 'string' ? viewer.role.trim().toLowerCase() : null;
  const isAuthenticated = Boolean(viewer.isAuthenticated || role);
  const isAdmin = role === 'admin';
  const isParent = role === 'parent' || viewer.is_parent === true;
  const isStudent = role === 'student' && !isParent;
  const isTutor = role === 'tutor';
  const isInstitution = role === 'institution';

  if (isAdmin) {
    return true;
  }

  switch (visibility) {
    case 'public':
      return true;
    case 'signed_in':
      return isAuthenticated;
    case 'public_except_students':
      return !isStudent;
    case 'signed_in_except_students':
      return isAuthenticated && !isStudent;
    case 'students':
      return isStudent;
    case 'parents':
      return isParent;
    case 'tutors':
      return isTutor;
    case 'institutions':
      return isInstitution;
    case 'admins':
      return false;
    case 'students_parents':
      return isStudent || isParent;
    case 'tutors_institutions':
      return isTutor || isInstitution;
    case 'hidden':
      return false;
    default:
      return true;
  }
}

export async function loadAppSettingViewerAccess(userId) {
  if (!userId) {
    return {
      isAuthenticated: false,
      role: null,
      is_parent: false,
    };
  }

  const [rows] = await db.query(
    'SELECT role, is_parent FROM profiles WHERE user_id = ? LIMIT 1',
    [userId],
  );
  const profile = rows[0] || null;

  return {
    isAuthenticated: true,
    role: typeof profile?.role === 'string' ? profile.role.toLowerCase() : null,
    is_parent: Boolean(profile?.is_parent),
  };
}

export async function ensureDefaultAppSettings() {
  if (APP_SETTINGS_CATALOG.length === 0) return;

  const placeholders = APP_SETTINGS_CATALOG.map(() => '(?, ?, ?)').join(', ');
  const values = APP_SETTINGS_CATALOG.flatMap((setting) => [
    uuid(),
    setting.key,
    serializeAppSettingValue(setting.defaultValue),
  ]);

  await db.query(
    `INSERT IGNORE INTO app_settings (id, \`key\`, value) VALUES ${placeholders}`,
    values,
  );
}

export async function listAppSettings() {
  await ensureDefaultAppSettings();
  const [rows] = await db.query('SELECT * FROM app_settings ORDER BY `key` ASC');
  return rows.map((row) => toPublicAppSettingRow(row));
}

export async function listPublicAppSettings() {
  const rows = await listAppSettings();
  return rows
    .filter((row) => PUBLIC_APP_SETTING_KEYS.has(row.key))
    .map((row) => {
      const normalized = toPublicAppSettingRow(row);
      return { key: normalized.key, value: normalized.value };
    });
}

export async function getAppSettingValue(key, fallback = '') {
  await ensureDefaultAppSettings();
  const [rows] = await db.query('SELECT value FROM app_settings WHERE `key` = ? LIMIT 1', [key]);
  const row = rows[0];
  if (row && row.value !== null && row.value !== undefined && row.value !== '') {
    return row.value;
  }

  if (APP_SETTINGS_BY_KEY.has(key)) {
    return serializeAppSettingValue(APP_SETTINGS_BY_KEY.get(key).defaultValue);
  }

  return serializeAppSettingValue(fallback);
}

export async function getBooleanAppSetting(key, fallback = false) {
  const defaultValue = APP_SETTINGS_BY_KEY.has(key)
    ? parseBooleanAppSettingValue(APP_SETTINGS_BY_KEY.get(key).defaultValue, fallback)
    : fallback;

  return parseBooleanAppSettingValue(await getAppSettingValue(key, defaultValue), defaultValue);
}

export async function getNumberAppSetting(key, fallback = 0) {
  const defaultValue = APP_SETTINGS_BY_KEY.has(key)
    ? parseNumberAppSettingValue(APP_SETTINGS_BY_KEY.get(key).defaultValue, fallback)
    : fallback;

  return parseNumberAppSettingValue(await getAppSettingValue(key, defaultValue), defaultValue);
}

export async function getStringArrayAppSetting(key, fallback = []) {
  const defaultValue = APP_SETTINGS_BY_KEY.has(key)
    ? parseStringArrayAppSettingValue(APP_SETTINGS_BY_KEY.get(key).defaultValue, fallback)
    : fallback;

  return parseStringArrayAppSettingValue(await getAppSettingValue(key, defaultValue), defaultValue);
}

export async function upsertAppSettingValue(key, value) {
  await ensureDefaultAppSettings();
  const serializedValue = serializeAppSettingValue(value);
  const [rows] = await db.query('SELECT id FROM app_settings WHERE `key` = ? LIMIT 1', [key]);
  const existing = rows[0];

  if (existing) {
    await db.query('UPDATE app_settings SET value = ? WHERE id = ?', [serializedValue, existing.id]);
  } else {
    await db.query('INSERT INTO app_settings (id, `key`, value) VALUES (?, ?, ?)', [uuid(), key, serializedValue]);
  }

  const [updatedRows] = await db.query('SELECT * FROM app_settings WHERE `key` = ? LIMIT 1', [key]);
  return updatedRows[0] || null;
}

export async function assertPlatformWritable() {
  const maintenanceMode = await getBooleanAppSetting('maintenance_mode', false);
  if (!maintenanceMode) return;

  const err = new Error(await getAppSettingValue('maintenance_message'));
  err.status = 503;
  err.code = 'MAINTENANCE_MODE';
  throw err;
}

export async function assertAppSettingEnabled(key, message) {
  const enabled = await getBooleanAppSetting(key, true);
  if (enabled) return;

  const err = new Error(message || 'This feature is currently disabled.');
  err.status = 403;
  err.code = 'FORBIDDEN';
  throw err;
}

export async function assertAppSettingVisibilityAllowed(key, userId, options = {}) {
  const fallback = normalizeContentVisibilityValue(options.fallback, 'public');
  const visibility = normalizeContentVisibilityValue(await getAppSettingValue(key, fallback), fallback);
  const viewer = await loadAppSettingViewerAccess(userId);

  if (canAccessContentVisibility(visibility, viewer)) {
    return { visibility, viewer };
  }

  const requiresAuth = contentVisibilityRequiresAuth(visibility);
  const err = new Error(options.message || 'This content is not available for your account.');
  err.status = !viewer.isAuthenticated && requiresAuth ? 401 : 403;
  err.code = !viewer.isAuthenticated && requiresAuth ? 'UNAUTHORIZED' : 'FORBIDDEN';
  err.meta = { key, visibility };
  throw err;
}
