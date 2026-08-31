const crypto = require('crypto');

const CODE_TTL_MINUTES = 10;

function createLoginCode() {
  const code = String(crypto.randomInt(100000, 1000000));
  return {
    code,
    codeHash: hashLoginCode(code),
  };
}

function hashLoginCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function isValidLoginCode(code) {
  return /^\d{6}$/.test(String(code || ''));
}

module.exports = {
  CODE_TTL_MINUTES,
  createLoginCode,
  hashLoginCode,
  isValidLoginCode,
};
