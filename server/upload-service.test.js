const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const {
  hasImageSignature,
  persistImage,
  removeImage,
} = require('./services/uploadService');

async function run() {
  assert.strictEqual(hasImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg'), true);
  assert.strictEqual(hasImageSignature(Buffer.from('not an image'), 'image/png'), false);
  assert.strictEqual(hasImageSignature(Buffer.from('RIFFxxxxWEBPdata'), 'image/webp'), true);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pet-planet-upload-'));
  try {
    const saved = await persistImage({
      mimetype: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    }, tempDir, 'test');
    assert.match(saved.filename, /^test_[a-f0-9]{32}\.png$/);
    assert.strictEqual(saved.url.startsWith('/uploads/'), true);
    await fs.access(saved.path);
    await removeImage(saved.path);

    await assert.rejects(
      () => persistImage({ mimetype: 'image/png', buffer: Buffer.from('fake') }, tempDir, 'test'),
      (error) => error.code === 'INVALID_IMAGE_CONTENT' && error.status === 422,
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
  console.log('upload service checks passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
