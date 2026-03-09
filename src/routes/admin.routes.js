import { Router } from 'express';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { wrap } from '../middleware/error-handler.js';
import { v4 as uuid } from 'uuid';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/overview', wrap(async (_req, res) => {
  const [[totalUsers]] = await db.query('SELECT COUNT(*) AS total_users FROM profiles');
  const [[totalTutors]] = await db.query('SELECT COUNT(*) AS total_tutors FROM tutor_profiles');
  const [[pendingApprovals]] = await db.query("SELECT COUNT(*) AS pending_approvals FROM tutor_profiles WHERE verification_status = 'pending'");
  const [[activeSubs]] = await db.query("SELECT COUNT(*) AS active_subs, COALESCE(SUM(amount), 0) AS total_revenue FROM subscriptions WHERE status = 'active'");
  const [[totalCourses]] = await db.query('SELECT COUNT(*) AS total_courses FROM courses');
  const [[totalEnrollments]] = await db.query('SELECT COUNT(*) AS total_enrollments FROM course_enrollments');

  res.json({
    total_users: totalUsers.total_users,
    total_tutors: totalTutors.total_tutors,
    pending_approvals: pendingApprovals.pending_approvals,
    active_subs: activeSubs.active_subs,
    total_revenue: activeSubs.total_revenue,
    total_courses: totalCourses.total_courses,
    total_enrollments: totalEnrollments.total_enrollments
  });
}));

router.get('/users', wrap(async (req, res) => {
  const q = req.query.q ? `%${req.query.q}%` : null;
  const [rows] = await db.query(
    `SELECT p.*, u.email_verified, u.created_at AS user_created_at
     FROM profiles p JOIN users u ON u.id = p.user_id
     ${q ? 'WHERE p.full_name LIKE ? OR p.email LIKE ?' : ''}
     ORDER BY p.created_at DESC`,
    q ? [q, q] : []
  );
  res.json(rows);
}));

router.patch('/users/:id', wrap(async (req, res) => {
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
  await db.query(`UPDATE profiles SET ${fields.join(', ')} WHERE user_id = ?`, values);
  const [rows] = await db.query('SELECT * FROM profiles WHERE user_id = ?', [id]);
  res.json(rows[0]);
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

router.get('/tutors', wrap(async (_req, res) => {
  const [rows] = await db.query(
    `SELECT tp.*, p.full_name, p.email, p.city, p.status
     FROM tutor_profiles tp JOIN profiles p ON p.user_id = tp.user_id
     ORDER BY tp.created_at DESC`
  );
  res.json(rows);
}));

router.patch('/tutors/:id/verify', wrap(async (req, res) => {
  const { id } = req.params;
  const { verification_status, verified_badge } = req.body;
  await db.query(
    'UPDATE tutor_profiles SET verification_status = ?, verified_badge = ? WHERE id = ?',
    [verification_status, !!verified_badge, id]
  );
  const [rows] = await db.query('SELECT * FROM tutor_profiles WHERE id = ?', [id]);
  res.json(rows[0]);
}));

router.get('/subscriptions', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM subscriptions ORDER BY created_at DESC');
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

router.get('/courses', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM courses ORDER BY created_at DESC');
  res.json(rows);
}));

router.get('/enrollments', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM course_enrollments ORDER BY created_at DESC');
  res.json(rows);
}));

router.patch('/enrollments/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  await db.query('UPDATE course_enrollments SET status = ? WHERE id = ?', [status, id]);
  const [rows] = await db.query('SELECT * FROM course_enrollments WHERE id = ?', [id]);
  res.json(rows[0]);
}));

router.get('/reviews', wrap(async (_req, res) => {
  const [tutorReviews] = await db.query('SELECT * FROM reviews ORDER BY created_at DESC');
  const [courseReviews] = await db.query('SELECT * FROM course_reviews ORDER BY created_at DESC');
  res.json({ tutor_reviews: tutorReviews, course_reviews: courseReviews });
}));

router.delete('/reviews/:id', wrap(async (req, res) => {
  const { id } = req.params;
  await db.query('DELETE FROM reviews WHERE id = ?', [id]);
  await db.query('DELETE FROM course_reviews WHERE id = ?', [id]);
  res.json({ message: 'Review deleted' });
}));

router.get('/messages', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM conversations ORDER BY updated_at DESC');
  res.json(rows);
}));

router.delete('/messages/:id', wrap(async (req, res) => {
  const { id } = req.params;
  await db.query('DELETE FROM conversations WHERE id = ?', [id]);
  res.json({ message: 'Conversation deleted' });
}));

router.get('/activity-logs', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM activity_logs ORDER BY created_at DESC');
  res.json(rows);
}));

router.get('/notifications', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM notifications ORDER BY created_at DESC');
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
  res.json(rows);
}));

router.post('/ads', wrap(async (req, res) => {
  const id = uuid();
  const data = req.body;
  await db.query(
    `INSERT INTO ads (id, company_name, description, image_url, image_width, image_height, link_url, placement, is_active, sort_order, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.company_name, data.description || null, data.image_url || null, data.image_width || null, data.image_height || null, data.link_url || null, data.placement || 'card', data.is_active ?? true, data.sort_order ?? 0, data.start_date || null, data.end_date || null]
  );
  const [rows] = await db.query('SELECT * FROM ads WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
}));

router.patch('/ads/:id', wrap(async (req, res) => {
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
  await db.query(`UPDATE ads SET ${fields.join(', ')} WHERE id = ?`, values);
  const [rows] = await db.query('SELECT * FROM ads WHERE id = ?', [id]);
  res.json(rows[0]);
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
  const [rows] = await db.query('SELECT * FROM app_settings');
  res.json(rows);
}));

router.post('/settings', wrap(async (req, res) => {
  const id = uuid();
  const data = req.body;
  await db.query('INSERT INTO app_settings (id, `key`, value) VALUES (?, ?, ?)', [id, data.key, data.value || null]);
  const [rows] = await db.query('SELECT * FROM app_settings WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
}));

router.patch('/settings/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    fields.push(`\`${key}\` = ?`);
    values.push(updates[key]);
  }
  if (fields.length === 0) return res.json({ message: 'No changes' });
  values.push(id);
  await db.query(`UPDATE app_settings SET ${fields.join(', ')} WHERE id = ?`, values);
  const [rows] = await db.query('SELECT * FROM app_settings WHERE id = ?', [id]);
  res.json(rows[0]);
}));

router.delete('/settings/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM app_settings WHERE id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
}));

export default router;
