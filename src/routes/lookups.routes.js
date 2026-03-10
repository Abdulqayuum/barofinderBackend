import { Router } from 'express';
import db from '../config/database.js';
import { wrap } from '../middleware/error-handler.js';
import { listPublicAppSettings } from '../utils/app-settings.js';
import { toPublicUploadUrl } from '../utils/uploads.js';

const router = Router();

function toPublicAdResponse(ad) {
  if (!ad) return ad;

  return {
    ...ad,
    image_url: toPublicUploadUrl(ad.image_url),
  };
}

router.get('/cities', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM cities ORDER BY name ASC');
  res.json(rows);
}));

router.get('/subjects', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM subjects ORDER BY name ASC');
  res.json(rows);
}));

router.get('/levels', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM levels ORDER BY name ASC');
  res.json(rows);
}));

router.get('/languages', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM languages ORDER BY name ASC');
  res.json(rows);
}));

router.get('/payment-methods', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM payment_methods WHERE is_active = TRUE ORDER BY sort_order ASC');
  res.json(rows);
}));

router.get('/app-settings', wrap(async (_req, res) => {
  res.json(await listPublicAppSettings());
}));

router.get('/notices', wrap(async (req, res) => {
  const now = new Date();
  const onlyBanner = req.query.banner === 'true';
  const [rows] = await db.query(
    `SELECT *
     FROM notices
     WHERE is_active = TRUE
       AND (? = FALSE OR is_banner = TRUE)
       AND (start_date IS NULL OR start_date <= ?)
       AND (end_date IS NULL OR end_date >= ?)
     ORDER BY sort_order ASC, created_at DESC`,
    [onlyBanner, now, now]
  );
  res.json(rows);
}));

router.get('/ads', wrap(async (req, res) => {
  const now = new Date();
  const placement = req.query.placement || null;

  let query = `
    SELECT *
    FROM ads
    WHERE is_active = TRUE
      AND (start_date IS NULL OR start_date <= ?)
      AND (end_date IS NULL OR end_date >= ?)
  `;
  const params = [now, now];

  if (placement) {
    query += ' AND (placement = ? OR placement = "both")';
    params.push(String(placement));
  }

  query += ' ORDER BY sort_order ASC, created_at DESC';
  const [rows] = await db.query(query, params);
  res.json(rows.map((row) => toPublicAdResponse(row)));
}));

export default router;
