const crypto = require('crypto');
const fsp = require('fs/promises');
const path = require('path');
const multer = require('multer');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function createImageUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    fileFilter: (req, file, callback) => {
      if (!MIME_EXTENSIONS[file.mimetype]) {
        const error = new Error('仅支持 jpg/png/webp 格式');
        error.code = 'INVALID_UPLOAD_TYPE';
        error.status = 422;
        callback(error);
        return;
      }
      callback(null, true);
    },
  });
}

function hasImageSignature(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  }
  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

async function persistImage(file, uploadDir, prefix = 'upload') {
  if (!file || !MIME_EXTENSIONS[file.mimetype] || !hasImageSignature(file.buffer, file.mimetype)) {
    const error = new Error('图片内容与声明格式不匹配');
    error.code = 'INVALID_IMAGE_CONTENT';
    error.status = 422;
    throw error;
  }

  await fsp.mkdir(uploadDir, { recursive: true });
  const filename = `${prefix}_${crypto.randomBytes(16).toString('hex')}${MIME_EXTENSIONS[file.mimetype]}`;
  const targetPath = path.join(uploadDir, filename);
  await fsp.writeFile(targetPath, file.buffer, { flag: 'wx' });
  return { filename, url: `/uploads/${filename}`, path: targetPath };
}

function removeImage(filePath) {
  if (!filePath) return Promise.resolve();
  return fsp.unlink(filePath).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
}

module.exports = {
  MAX_IMAGE_BYTES,
  createImageUpload,
  hasImageSignature,
  persistImage,
  removeImage,
};
