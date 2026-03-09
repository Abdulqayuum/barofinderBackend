import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { subscriptionCreateSchema } from '../schemas/subscription.schema.js';
import { generateInvoiceNumber } from '../utils/invoice.js';
import { wrap } from '../middleware/error-handler.js';

const router = Router();

router.get('/subscription-plans', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM subscription_plans WHERE is_active = TRUE ORDER BY sort_order ASC');
  res.json(rows);
}));

router.get('/subscriptions/me', authMiddleware, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json(rows);
}));

router.post('/subscriptions', authMiddleware, validateBody(subscriptionCreateSchema), wrap(async (req, res) => {
  const data = req.body;

  const [tutorRows] = await db.query('SELECT id FROM tutor_profiles WHERE user_id = ?', [req.user.id]);
  let tutor = tutorRows[0];

  if (!tutor) {
    const tutorId = uuid();
    await db.query('INSERT INTO tutor_profiles (id, user_id) VALUES (?, ?)', [tutorId, req.user.id]);
    tutor = { id: tutorId };
    await db.query('UPDATE profiles SET role = ? WHERE user_id = ?', ['tutor', req.user.id]);
  }

  const [countRows] = await db.query(
    'SELECT COUNT(*) AS count FROM subscriptions WHERE DATE(created_at) = CURDATE()'
  );
  const seq = (countRows[0]?.count || 0) + 1;
  const invoiceNumber = generateInvoiceNumber(seq);

  const subId = uuid();
  await db.query(
    `INSERT INTO subscriptions
     (id, tutor_id, user_id, plan, status, amount, currency, payment_method, transaction_ref, invoice_number)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)` ,
    [
      subId,
      tutor.id,
      req.user.id,
      data.plan,
      data.amount,
      data.currency || 'USD',
      data.payment_method || null,
      data.transaction_ref || null,
      invoiceNumber
    ]
  );

  const [rows] = await db.query('SELECT * FROM subscriptions WHERE id = ?', [subId]);
  res.status(201).json(rows[0]);
}));

export default router;
