const sharp = require('sharp');
const fs = require('fs');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const compressImage = async (filePath, mimetype) => {
  if (!ALLOWED_IMAGE_TYPES.includes(mimetype)) return;

  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
  if (ext === '.gif') return;

  const image = sharp(filePath);
  const metadata = await image.metadata();

  const resizeOpts = {};
  if (metadata.width > 1200) resizeOpts.width = 1200;
  if (metadata.height > 1200) resizeOpts.height = 1200;
  resizeOpts.withoutEnlargement = true;
  resizeOpts.fit = 'inside';

  const hasResize = resizeOpts.width || resizeOpts.height;

  if (!hasResize && (mimetype === 'image/jpeg' || mimetype === 'image/webp')) {
    const stat = fs.statSync(filePath);
    if (stat.size < 1024 * 100) return;
  }

  const tmpPath = filePath + '.tmp';
  let pipeline = image.resize(resizeOpts);
  if (mimetype === 'image/jpeg') pipeline = pipeline.jpeg({ quality: 75, mozjpeg: true });
  else if (mimetype === 'image/png') pipeline = pipeline.png({ quality: 75, compressionLevel: 9 });
  else if (mimetype === 'image/webp') pipeline = pipeline.webp({ quality: 70 });
  await pipeline.toFile(tmpPath);
  fs.unlinkSync(filePath);
  fs.renameSync(tmpPath, filePath);
};

module.exports = { compressImage };
