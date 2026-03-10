import { Router } from 'express';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { tutorPhotoUpload, institutionLogoUpload, courseCoverUpload, courseAssetUpload, tutorDocumentUpload, siteLogoUpload } from '../config/storage.js';
import { wrap } from '../middleware/error-handler.js';
import { toPublicUploadDocuments, toPublicUploadUrl, toStoredUploadDocuments, toStoredUploadPath } from '../utils/uploads.js';
import { assertPlatformWritable, getNumberAppSetting, upsertAppSettingValue } from '../utils/app-settings.js';

const router = Router();

function clampUploadLimit(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.min(Math.max(Math.round(numeric), 1), 500);
}

function withDynamicUpload(createUpload, fieldName, settingKey, fallbackMb) {
  return async (req, res, next) => {
    try {
      await assertPlatformWritable();

      const maxMb = clampUploadLimit(await getNumberAppSetting(settingKey, fallbackMb), fallbackMb);
      const upload = createUpload(maxMb).single(fieldName);

      upload(req, res, (err) => {
        if (!err) return next();

        if (err.code === 'LIMIT_FILE_SIZE') {
          err.status = 400;
          err.code = 'VALIDATION_ERROR';
          err.message = `File is too large. Maximum allowed size is ${maxMb} MB.`;
        } else {
          err.status = 400;
          err.code = err.code || 'VALIDATION_ERROR';
        }

        next(err);
      });
    } catch (err) {
      next(err);
    }
  };
}

router.post('/tutor-photo', authMiddleware, withDynamicUpload(tutorPhotoUpload, 'photo', 'max_file_upload_mb', 5), wrap(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded', code: 'VALIDATION_ERROR' });

  const path = toStoredUploadPath(`/uploads/tutor-photos/${file.filename}`);
  await db.query('UPDATE tutor_profiles SET profile_photo_url = ? WHERE user_id = ?', [path, req.user.id]);
  res.json({ url: toPublicUploadUrl(path) });
}));

router.post('/institution-logo', authMiddleware, withDynamicUpload(institutionLogoUpload, 'logo', 'max_file_upload_mb', 5), wrap(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded', code: 'VALIDATION_ERROR' });

  const [profiles] = await db.query('SELECT role FROM profiles WHERE user_id = ? LIMIT 1', [req.user.id]);
  if (profiles[0]?.role !== 'institution') {
    return res.status(403).json({ error: 'Institution account required', code: 'FORBIDDEN' });
  }

  const [institutions] = await db.query('SELECT id FROM institution_profiles WHERE user_id = ? LIMIT 1', [req.user.id]);
  if (!institutions[0]) {
    return res.status(400).json({ error: 'Save institution profile first', code: 'BAD_REQUEST' });
  }

  const path = toStoredUploadPath(`/uploads/institution-logos/${file.filename}`);
  await db.query('UPDATE institution_profiles SET logo_url = ? WHERE user_id = ?', [path, req.user.id]);
  res.json({ url: toPublicUploadUrl(path) });
}));

router.post('/course-cover', authMiddleware, withDynamicUpload(courseCoverUpload, 'cover', 'max_file_upload_mb', 5), wrap(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded', code: 'VALIDATION_ERROR' });

  const path = toStoredUploadPath(`/uploads/course-covers/${file.filename}`);
  res.json({ url: toPublicUploadUrl(path) });
}));

router.post('/site-logo', authMiddleware, requireRole('admin'), withDynamicUpload(siteLogoUpload, 'logo', 'max_file_upload_mb', 5), wrap(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded', code: 'VALIDATION_ERROR' });

  const path = toStoredUploadPath(`/uploads/site-branding/${file.filename}`);
  await upsertAppSettingValue('site_logo_url', path);
  res.json({ url: toPublicUploadUrl(path) });
}));

router.post('/course-asset', authMiddleware, withDynamicUpload(courseAssetUpload, 'file', 'max_course_asset_size_mb', 100), wrap(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded', code: 'VALIDATION_ERROR' });

  const path = toStoredUploadPath(`/uploads/course-assets/${file.filename}`);
  res.json({ url: toPublicUploadUrl(path) });
}));

router.post('/tutor-document', authMiddleware, withDynamicUpload(tutorDocumentUpload, 'document', 'max_file_upload_mb', 10), wrap(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded', code: 'VALIDATION_ERROR' });

  const path = toStoredUploadPath(`/uploads/tutor-documents/${file.filename}`);

  const [rows] = await db.query('SELECT verification_documents FROM tutor_profiles WHERE user_id = ?', [req.user.id]);
  let docs = [];
  if (rows[0] && rows[0].verification_documents) {
    docs = typeof rows[0].verification_documents === 'string'
      ? JSON.parse(rows[0].verification_documents)
      : rows[0].verification_documents;
  }
  docs = toStoredUploadDocuments(docs);
  docs.push({ name: file.originalname, url: path, uploaded_at: new Date() });

  await db.query('UPDATE tutor_profiles SET verification_documents = ? WHERE user_id = ?', [JSON.stringify(docs), req.user.id]);
  res.json({ url: toPublicUploadUrl(path), documents: toPublicUploadDocuments(docs) });
}));

export default router;
