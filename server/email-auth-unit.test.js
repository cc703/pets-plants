const assert = require('assert');
const {
  createVerificationToken,
  hashVerificationToken,
} = require('./utils/emailVerification');
const {
  createLoginCode,
  hashLoginCode,
  isValidLoginCode,
} = require('./utils/emailLoginCode');
const {
  EMAIL_NOT_CONFIGURED,
  isConfigured,
  sendEmail,
} = require('./services/emailService');

const verification = createVerificationToken();
assert.strictEqual(hashVerificationToken(verification.token), verification.tokenHash);
assert.notStrictEqual(verification.token, verification.tokenHash);

const loginCode = createLoginCode();
assert.strictEqual(loginCode.code.length, 6);
assert.strictEqual(isValidLoginCode(loginCode.code), true);
assert.strictEqual(hashLoginCode(loginCode.code), loginCode.codeHash);
assert.strictEqual(isValidLoginCode('bad'), false);

const emptyEnv = {};
assert.strictEqual(isConfigured(emptyEnv), false);
sendEmail({ to: 'user@example.test', subject: 'test', text: 'test', html: '<p>test</p>' }, emptyEnv)
  .then(() => {
    throw new Error('unconfigured email service must fail');
  })
  .catch((error) => {
    assert.strictEqual(error.code, EMAIL_NOT_CONFIGURED);
    console.log('email auth unit checks passed');
  });
