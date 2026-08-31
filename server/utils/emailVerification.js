const crypto = require('crypto');

const TOKEN_TTL_MINUTES = 24 * 60;

function createVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: hashVerificationToken(token),
  };
}

function hashVerificationToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = {
  TOKEN_TTL_MINUTES,
  createVerificationToken,
  hashVerificationToken,
  isValidEmail,
};
