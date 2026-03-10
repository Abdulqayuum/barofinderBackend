import { Router } from 'express';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { tutorPhotoUpload, courseCoverUpload, courseAssetUpload, tutorDocumentUpload } from '../config/storage.js';
import { wrap } from '../middleware/error-handler.js';
import { toPublicUploadDocuments, toPublicUploadUrl, toStoredUploadDocuments, toStoredUploadPath } from '../utils/uploads.js';

const router = Router();

router.post('/tutor-photo', authMiddleware, tutorPhotoUpload().single('photo'), wrap(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded', code: 'VALIDATION_ERROR' });

  const path = toStoredUploadPath(`/uploads/tutor-photos/${file.filename}`);
  await db.query('UPDATE tutor_profiles SET profile_photo_url = ? WHERE user_id = ?', [path, req.user.id]);
  res.json({ url: toPublicUploadUrl(path) });
}));

router.post('/course-cover', authMiddleware, courseCoverUpload().single('cover'), wrap(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded', code: 'VALIDATION_ERROR' });

  const path = toStoredUploadPath(`/uploads/course-covers/${file.filename}`);
  res.json({ url: toPublicUploadUrl(path) });
}));

router.post('/course-asset', authMiddleware, courseAssetUpload().single('file'), wrap(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded', code: 'VALIDATION_ERROR' });

  const path = toStoredUploadPath(`/uploads/course-assets/${file.filename}`);
  res.json({ url: toPublicUploadUrl(path) });
}));

router.post('/tutor-document', authMiddleware, tutorDocumentUpload().single('document'), wrap(async (req, res) => {
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
