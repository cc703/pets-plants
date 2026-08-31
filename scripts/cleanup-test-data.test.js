const assert = require('assert');
const fs = require('fs');
const path = require('path');

const cleanupScript = fs.readFileSync(
  path.join(__dirname, 'cleanup-test-data.js'),
  'utf8',
);
const patternMatch = cleanupScript.match(
  /const USER_PATTERN\s*=\s*[\r\n\s]*"([^"]+)"/,
);

assert.ok(patternMatch, 'cleanup script must declare USER_PATTERN');

const usernamePattern = new RegExp(patternMatch[1]);
assert.ok(
  usernamePattern.test('ui12345678'),
  'UI smoke usernames must be selected by the cleanup rule',
);
assert.ok(usernamePattern.test('tu7542441063'), 'API smoke primary users must be selected by the cleanup rule');
assert.ok(usernamePattern.test('b7542441564175'), 'API smoke secondary users must be selected by the cleanup rule');
assert.ok(usernamePattern.test('notify12345678'), 'notification smoke users must be selected by the cleanup rule');

assert.match(
  cleanupScript,
  /FROM circles c\s+LEFT JOIN users u ON u\.id = c\.creator_id\s+WHERE u\.username REGEXP \?/,
  'circles created by UI smoke users must be selected by their creator',
);

assert.match(
  cleanupScript,
  /LEFT JOIN users postAuthor ON postAuthor\.id = p\.user_id[\s\S]*OR postAuthor\.username REGEXP \?/,
  'comments on test posts must be selected before their posts are deleted',
);

console.log('cleanup test-data pattern regression check passed');
