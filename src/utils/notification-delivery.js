import { v4 as uuid } from 'uuid';
import db from '../config/database.js';
import { getBooleanAppSetting, getStringArrayAppSetting } from './app-settings.js';
import { getAppBaseUrl } from './app-url.js';
import { sendNotificationEmail } from './mailer.js';

function serializeMetadata(metadata) {
  if (metadata == null) return null;
  return JSON.stringify(metadata);
}

function getNotificationPath(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  return typeof metadata.path === 'string' && metadata.path.trim() ? metadata.path.trim() : null;
}

function buildNotificationActionUrl(metadata) {
  const path = getNotificationPath(metadata);
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;

  const baseUrl = getAppBaseUrl();
  if (!baseUrl) return null;

  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function loadUserEmailRecipient(userId) {
  if (!userId) return null;

  const [rows] = await db.query(
    `SELECT COALESCE(p.full_name, 'User') AS full_name, COALESCE(p.email, u.email) AS email
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [userId],
  );

  const recipient = rows[0] || null;
  if (!recipient?.email) return null;
  return recipient;
}

async function loadAdminEmailRecipients() {
  const [rows] = await db.query(
    `SELECT DISTINCT ur.user_id, COALESCE(p.full_name, 'Admin') AS full_name, COALESCE(p.email, u.email) AS email
     FROM user_roles ur
     JOIN users u ON u.id = ur.user_id
     LEFT JOIN profiles p ON p.user_id = ur.user_id
     WHERE ur.role = 'admin'
       AND COALESCE(p.email, u.email) IS NOT NULL`,
  );

  return rows;
}

function normalizeEmailServiceKey(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function shouldSendImportantNotificationEmails(serviceKey = '') {
  const emailEnabled = await getBooleanAppSetting('email_important_notifications', false);
  if (!emailEnabled) return false;

  const normalizedServiceKey = normalizeEmailServiceKey(serviceKey);
  if (!normalizedServiceKey) return true;

  const allowedServices = await getStringArrayAppSetting('email_notification_services', [
    'reports',
    'verification',
    'institution_approvals',
    'job_applications',
    'enrollments',
  ]);

  return allowedServices.map(normalizeEmailServiceKey).includes(normalizedServiceKey);
}

async function trySendNotificationEmail(recipient, title, message, metadata) {
  if (!recipient?.email) return false;

  try {
    await sendNotificationEmail({
      to: recipient.email,
      recipientName: recipient.full_name,
      title,
      message,
      actionUrl: buildNotificationActionUrl(metadata),
    });
    return true;
  } catch (error) {
    console.error('Failed to send notification email:', error);
    return false;
  }
}

export async function createNotification({
  userId = null,
  type,
  title,
  message,
  metadata = null,
  executor = db,
}) {
  const id = uuid();
  await executor.query(
    'INSERT INTO notifications (id, user_id, type, title, message, metadata) VALUES (?, ?, ?, ?, ?, ?)',
    [id, userId, type, title, message, serializeMetadata(metadata)],
  );

  return { id, user_id: userId, type, title, message, metadata };
}

export async function sendImportantNotificationEmailToUser({
  serviceKey = '',
  userId,
  title,
  message,
  metadata = null,
}) {
  if (!userId) return false;
  if (!await shouldSendImportantNotificationEmails(serviceKey)) return false;

  const recipient = await loadUserEmailRecipient(userId);
  return trySendNotificationEmail(recipient, title, message, metadata);
}

export async function sendImportantNotificationEmailToAdmins({
  serviceKey = '',
  title,
  message,
  metadata = null,
}) {
  if (!await shouldSendImportantNotificationEmails(serviceKey)) return false;

  const recipients = await loadAdminEmailRecipients();
  if (!Array.isArray(recipients) || recipients.length === 0) return false;

  await Promise.all(recipients.map((recipient) =>
    trySendNotificationEmail(recipient, title, message, metadata),
  ));

  return true;
}

export async function createImportantUserNotification({
  serviceKey = '',
  userId,
  type,
  title,
  message,
  metadata = null,
  executor = db,
}) {
  const notification = await createNotification({
    userId,
    type,
    title,
    message,
    metadata,
    executor,
  });

  await sendImportantNotificationEmailToUser({
    serviceKey,
    userId,
    title,
    message,
    metadata,
  });

  return notification;
}

export async function createImportantAdminNotification({
  serviceKey = '',
  type,
  title,
  message,
  metadata = null,
  executor = db,
}) {
  const notification = await createNotification({
    userId: null,
    type,
    title,
    message,
    metadata,
    executor,
  });

  await sendImportantNotificationEmailToAdmins({
    serviceKey,
    title,
    message,
    metadata,
  });

  return notification;
}
