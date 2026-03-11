import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import multer from 'multer';

const baseDir = path.resolve(process.env.UPLOAD_DIR || './uploads');

const IMAGE_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

const COURSE_ASSET_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
  'video/x-matroska': ['.mkv'],
  'video/x-ms-wmv': ['.wmv'],
  'video/ogg': ['.ogv'],
  'video/mp2t': ['.ts'],
  'video/3gpp': ['.3gp'],
};

const TUTOR_DOCUMENT_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
};

const JOB_APPLICATION_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getSafeExtension(originalname) {
  return path.extname(originalname || '').toLowerCase();
}

function createFileFilter(allowedFileTypes, errorMessage) {
  return (req, file, cb) => {
    const ext = getSafeExtension(file.originalname);
    const allowedExtensions = allowedFileTypes[file.mimetype];

    if (allowedExtensions && allowedExtensions.includes(ext)) {
      cb(null, true);
      return;
    }

    const err = new Error(errorMessage);
    err.code = 'VALIDATION_ERROR';
    cb(err);
  };
}

function makeStorage(subdir) {
  const dest = path.join(baseDir, subdir);
  ensureDir(dest);
  return multer.diskStorage({
    destination: dest,
    filename: (req, file, cb) => {
      const ext = getSafeExtension(file.originalname);
      const userId = (req.user && req.user.id) || 'anonymous';
      cb(null, `${userId}-${Date.now()}-${crypto.randomUUID()}${ext}`);
    }
  });
}

export function tutorPhotoUpload(fileSizeMb) {
  return multer({
    storage: makeStorage('tutor-photos'),
    limits: { fileSize: parseInt(String(fileSizeMb ?? process.env.MAX_FILE_SIZE_MB ?? '5'), 10) * 1024 * 1024 },
    fileFilter: createFileFilter(IMAGE_FILE_TYPES, 'Only JPG, PNG, WEBP and GIF images are allowed'),
  });
}

export function institutionLogoUpload(fileSizeMb) {
  return multer({
    storage: makeStorage('institution-logos'),
    limits: { fileSize: parseInt(String(fileSizeMb ?? process.env.MAX_FILE_SIZE_MB ?? '5'), 10) * 1024 * 1024 },
    fileFilter: createFileFilter(IMAGE_FILE_TYPES, 'Only JPG, PNG, WEBP and GIF images are allowed'),
  });
}

export function courseCoverUpload(fileSizeMb) {
  return multer({
    storage: makeStorage('course-covers'),
    limits: { fileSize: parseInt(String(fileSizeMb ?? process.env.MAX_FILE_SIZE_MB ?? '5'), 10) * 1024 * 1024 },
    fileFilter: createFileFilter(IMAGE_FILE_TYPES, 'Only JPG, PNG, WEBP and GIF images are allowed'),
  });
}

export function siteLogoUpload(fileSizeMb) {
  return multer({
    storage: makeStorage('site-branding'),
    limits: { fileSize: parseInt(String(fileSizeMb ?? process.env.MAX_FILE_SIZE_MB ?? '5'), 10) * 1024 * 1024 },
    fileFilter: createFileFilter(IMAGE_FILE_TYPES, 'Only JPG, PNG, WEBP and GIF images are allowed'),
  });
}

export function courseAssetUpload(fileSizeMb) {
  return multer({
    storage: makeStorage('course-assets'),
    limits: { fileSize: parseInt(String(fileSizeMb ?? process.env.MAX_COURSE_ASSET_SIZE_MB ?? '100'), 10) * 1024 * 1024 },
    fileFilter: createFileFilter(COURSE_ASSET_FILE_TYPES, 'Only PDF, MP4, WEBM, MOV, AVI, MKV, WMV, OGV and TS files are allowed'),
  });
}

export function tutorDocumentUpload(fileSizeMb) {
  return multer({
    storage: makeStorage('tutor-documents'),
    limits: { fileSize: parseInt(String(fileSizeMb ?? process.env.MAX_FILE_SIZE_MB ?? '10'), 10) * 1024 * 1024 },
    fileFilter: createFileFilter(TUTOR_DOCUMENT_FILE_TYPES, 'Only JPEG, PNG and PDF files are allowed'),
  });
}

export function jobApplicationDocumentUpload(fileSizeMb) {
  return multer({
    storage: makeStorage('job-application-documents'),
    limits: { fileSize: parseInt(String(fileSizeMb ?? process.env.MAX_FILE_SIZE_MB ?? '10'), 10) * 1024 * 1024 },
    fileFilter: createFileFilter(JOB_APPLICATION_FILE_TYPES, 'Only PDF, DOC, DOCX, JPEG and PNG files are allowed'),
  });
}
