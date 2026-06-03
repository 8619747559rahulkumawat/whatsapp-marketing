const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { compressImage } = require('../utils/imageCompressor');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    'image': ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    'video': ['video/mp4', 'video/mpeg', 'video/quicktime'],
    'document': ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv'],
    'audio': ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4']
  };
  const allAllowed = Object.values(allowedTypes).flat();
  if (allAllowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800 }
});

const uploadWithCompression = (fieldName) => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, async (err) => {
      if (err) return next(err);
      if (req.file && req.file.mimetype && req.file.mimetype.startsWith('image/')) {
        try {
          await compressImage(req.file.path, req.file.mimetype);
          const fs = require('fs');
          const stat = fs.statSync(req.file.path);
          req.file.size = stat.size;
        } catch (e) {
          console.error('Image compression error:', e.message);
        }
      }
      next();
    });
  };
};

module.exports = { upload, uploadWithCompression };
