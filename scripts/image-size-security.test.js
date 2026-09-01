const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const imageSize = require('image-size');
const { imageSizeFromFile } = require('image-size/fromFile');

const blockedTypes = new Set(['heif', 'icns', 'jxl', 'jxl-stream']);
const blockedSignatures = {
  heif: Uint8Array.from([0, 0, 0, 0, 102, 116, 121, 112, 104, 101, 105, 102]),
  icns: Uint8Array.from([105, 99, 110, 115, 0, 0, 0, 8]),
};

for (const [type, input] of Object.entries(blockedSignatures)) {
  assert.throws(
    () => imageSize.imageSize(input),
    /disabled file type|unsupported file type/,
    `${type} parsing must be disabled by the patched image-size package`,
  );
}

const fixturePath = path.join(os.tmpdir(), 'pet-planet-blocked.icns');
fs.writeFileSync(fixturePath, blockedSignatures.icns);
imageSizeFromFile(fixturePath)
  .then(() => {
    throw new Error('fromFile should reject blocked image types');
  })
  .catch((error) => {
    assert.match(error.message, /disabled file type|unsupported file type/);
    fs.rmSync(fixturePath, { force: true });
    console.log('image-size security checks passed');
  });

assert.ok(
  imageSize.types.some((type) => type === 'png'),
  'safe image formats must remain available to Metro',
);
assert.ok(
  [...blockedTypes].every((type) => imageSize.types.includes(type)),
  'the compatibility surface must still advertise supported format names',
);
