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

export function tutorPhotoUpload() {
  return multer({
    storage: makeStorage('tutor-photos'),
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10) * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files allowed'));
    }
  });
}

export function courseCoverUpload() {
  return multer({
    storage: makeStorage('course-covers'),
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10) * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files allowed'));
    }
  });
}
