import fs from 'fs';
import path from 'path';
import multer from 'multer';

const baseDir = process.env.UPLOAD_DIR || './uploads';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeStorage(subdir) {
  const dest = path.join(baseDir, subdir);
  ensureDir(dest);
  return multer.diskStorage({
    destination: dest,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const userId = (req.user && req.user.id) || 'anonymous';
      cb(null, `${userId}-${Date.now()}${ext}`);
    }
  });
}

export function tutorPhotoUpload(fileSizeMb) {
  return multer({
    storage: makeStorage('tutor-photos'),
    limits: { fileSize: parseInt(String(fileSizeMb ?? process.env.MAX_FILE_SIZE_MB ?? '5'), 10) * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files allowed'));
    }
  });
}

export function institutionLogoUpload(fileSizeMb) {
  return multer({
    storage: makeStorage('institution-logos'),
    limits: { fileSize: parseInt(String(fileSizeMb ?? process.env.MAX_FILE_SIZE_MB ?? '5'), 10) * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files allowed'));
    }
  });
}

export function courseCoverUpload(fileSizeMb) {
  return multer({
    storage: makeStorage('course-covers'),
    limits: { fileSize: parseInt(String(fileSizeMb ?? process.env.MAX_FILE_SIZE_MB ?? '5'), 10) * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files allowed'));
    }
  });
}

export function siteLogoUpload(fileSizeMb) {
  return multer({
    storage: makeStorage('site-branding'),
    limits: { fileSize: parseInt(String(fileSizeMb ?? process.env.MAX_FILE_SIZE_MB ?? '5'), 10) * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files allowed'));
    }
  });
}

export function courseAssetUpload(fileSizeMb) {
  return multer({
    storage: makeStorage('course-assets'),
    limits: { fileSize: parseInt(String(fileSizeMb ?? process.env.MAX_COURSE_ASSET_SIZE_MB ?? '100'), 10) * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('video/')) cb(null, true);
      else cb(new Error('Only video files and PDF documents are allowed'));
    }
  });
}

export function tutorDocumentUpload(fileSizeMb) {
  return multer({
    storage: makeStorage('tutor-documents'),
    limits: { fileSize: parseInt(String(fileSizeMb ?? process.env.MAX_FILE_SIZE_MB ?? '10'), 10) * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error('Only JPEG, PNG and PDF files are allowed'));
    }
  });
}

export function jobApplicationDocumentUpload(fileSizeMb) {
  return multer({
    storage: makeStorage('job-application-documents'),
    limits: { fileSize: parseInt(String(fileSizeMb ?? process.env.MAX_FILE_SIZE_MB ?? '10'), 10) * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
      ];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error('Only PDF, DOC, DOCX, JPEG and PNG files are allowed'));
    }
  });
}
