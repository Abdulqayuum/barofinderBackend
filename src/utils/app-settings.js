import { v4 as uuid } from 'uuid';
import db from '../config/database.js';
import { toPublicUploadUrl } from './uploads.js';

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
  { key: 'max_file_upload_mb', defaultValue: '5', isPublic: true },
  { key: 'max_course_asset_size_mb', defaultValue: '100', isPublic: true },
  { key: 'admin_signature_name', defaultValue: 'Platform Administrator', isPublic: true },
  { key: 'certificate_footer_text', defaultValue: 'Issued by BaroFinder Learning Platform', isPublic: true },
];

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
