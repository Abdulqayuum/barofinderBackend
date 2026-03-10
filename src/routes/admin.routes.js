import { Router } from 'express';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { wrap } from '../middleware/error-handler.js';
import { v4 as uuid } from 'uuid';
import { toPublicUploadDocuments, toPublicUploadUrl, toStoredUploadDocuments, toStoredUploadPath } from '../utils/uploads.js';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/overview', wrap(async (_req, res) => {
  const [[totalUsers]] = await db.query('SELECT COUNT(*) AS total_users FROM profiles');
  const [[totalTutors]] = await db.query('SELECT COUNT(*) AS total_tutors FROM tutor_profiles');
  const [[pendingApprovals]] = await db.query("SELECT COUNT(*) AS pending_approvals FROM tutor_profiles WHERE verification_status = 'pending'");
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
    pending_approvals: pendingApprovals.pending_approvals,
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
  const [rows] = await db.query(
    `SELECT p.*, u.email_verified, u.created_at AS user_created_at
     FROM profiles p JOIN users u ON u.id = p.user_id
     ${q ? 'WHERE p.full_name LIKE ? OR p.email LIKE ?' : ''}
     ORDER BY p.created_at DESC`,
    q ? [q, q] : []
  );

  if (rows.length > 0) {
    const userIds = rows.map(r => r.user_id);
    const [roleRows] = await db.query('SELECT user_id, role FROM user_roles WHERE user_id IN (?)', [userIds]);
    const roleMap = {};
    roleRows.forEach(rr => {
      if (!roleMap[rr.user_id]) roleMap[rr.user_id] = [];
      roleMap[rr.user_id].push(rr.role);
    });
    rows.forEach(r => {
      r.app_roles = roleMap[r.user_id] || [];
    });
  }

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

router.post('/users/:id/roles', wrap(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  await db.query('INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)', [id, role || 'user']);
  res.json({ message: 'Role assigned' });
}));

router.delete('/users/:id/roles', wrap(async (req, res) => {
  const { id } = req.params;
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
    `SELECT tp.*, p.full_name, p.email, p.city, p.status
     FROM tutor_profiles tp JOIN profiles p ON p.user_id = tp.user_id
     ORDER BY tp.created_at DESC`
  );

  const parseJson = (val) => {
    if (!val) return [];
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return []; }
    }
    return Array.isArray(val) ? val : [];
  };

  const tutors = rows.map((t) => ({
    ...t,
    open_to_work: !!t.open_to_work,
    profile_photo_url: toPublicUploadUrl(t.profile_photo_url),
    subjects: parseJson(t.subjects),
    levels: parseJson(t.levels),
    languages: parseJson(t.languages),
    service_areas: parseJson(t.service_areas),
    availability: parseJson(t.availability),
    packages: parseJson(t.packages),
    verification_documents: toPublicUploadDocuments(parseJson(t.verification_documents)),
  }));

  res.json(tutors);
}));

router.patch('/tutors/:id/verify', wrap(async (req, res) => {
  const { id } = req.params;
  const { verification_status, verified_badge } = req.body;

  const [tRows] = await db.query('SELECT user_id, verification_documents FROM tutor_profiles WHERE id = ?', [id]);
  const tutor = tRows[0];
  if (!tutor) return res.status(404).json({ error: 'Tutor not found' });

  const userId = tutor.user_id;

  let grantBadge = false;
  if (verification_status === 'verified') {
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

  if (verification_status === 'rejected') {
    grantBadge = false;
    await db.query(
      'UPDATE tutor_profiles SET verification_status = ?, verified_badge = FALSE, verification_documents = NULL WHERE id = ?',
      [verification_status, id]
    );
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'verification', 'Verification Rejected', 'Your uploaded documents were rejected. Please upload valid verification documents.')`,
      [userId]
    );
  } else if (verification_status === 'suspended') {
    grantBadge = false;
    await db.query(
      'UPDATE tutor_profiles SET verification_status = ?, verified_badge = FALSE WHERE id = ?',
      [verification_status, id]
    );
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'verification', 'Account Suspended', 'Your tutor profile has been suspended by an administrator.')`,
      [userId]
    );
  } else {
    // verified or pending
    await db.query(
      'UPDATE tutor_profiles SET verification_status = ?, verified_badge = ? WHERE id = ?',
      [verification_status, grantBadge, id]
    );
    if (verification_status === 'verified') {
      const msg = grantBadge ? 'Your tutor profile has been verified and you received the Verified Badge!' : 'Your tutor profile has been verified. Upload documents to get the Verified Badge!';
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'verification', 'Profile Verified', ?)`,
        [userId, msg]
      );
    }
  }

  const [rows] = await db.query('SELECT * FROM tutor_profiles WHERE id = ?', [id]);
  res.json({
    ...rows[0],
    open_to_work: !!rows[0]?.open_to_work,
    profile_photo_url: toPublicUploadUrl(rows[0]?.profile_photo_url),
    verification_documents: toPublicUploadDocuments(rows[0]?.verification_documents),
    badge_granted: grantBadge,
  });
}));

router.patch('/tutors/:id', wrap(async (req, res) => {
  const { id } = req.params;
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
  const [rows] = await db.query('SELECT * FROM tutor_profiles WHERE id = ?', [id]);
  res.json({
    ...rows[0],
    open_to_work: !!rows[0]?.open_to_work,
    profile_photo_url: toPublicUploadUrl(rows[0]?.profile_photo_url),
    verification_documents: toPublicUploadDocuments(rows[0]?.verification_documents),
  });
}));

router.delete('/tutors/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query('SELECT user_id FROM tutor_profiles WHERE id = ?', [id]);
  const tutor = rows[0];
  if (!tutor) return res.status(404).json({ error: 'Tutor not found' });

  await db.query('DELETE FROM tutor_profiles WHERE id = ?', [id]);

  // Demote profile role if it was specifically 'tutor'
  await db.query("UPDATE profiles SET role = 'user' WHERE user_id = ? AND role = 'tutor'", [tutor.user_id]);

  // Remove tutor role entry
  await db.query("DELETE FROM user_roles WHERE user_id = ? AND role = 'tutor'", [tutor.user_id]);

  res.json({ message: 'Tutor deleted' });
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
