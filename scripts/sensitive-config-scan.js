const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const trackedFiles = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
const trackedEnvFiles = trackedFiles.filter((file) =>
  /(^|[\\/])\.env(?:\.[^\\/]*)?$/.test(file) && !/\.env\.example$/.test(file),
);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/,
  /\bnpm_[A-Za-z0-9]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
];
const privatePathPatterns = [
  /\b[A-Za-z]:\\Users\\[^\\\r\n]+/,
  /\b[A-Za-z]:\\\u684c\u9762\\[^\r\n]+/,
];
const secretMatches = [];
const privatePathMatches = [];

for (const relativePath of trackedFiles) {
  const absolutePath = path.join(root, relativePath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  for (const pattern of secretPatterns) {
    if (pattern.test(content)) secretMatches.push({ file: relativePath, pattern: pattern.source });
  }
  for (const pattern of privatePathPatterns) {
    if (pattern.test(content)) privatePathMatches.push({ file: relativePath, pattern: pattern.source });
  }
}

assert.strictEqual(trackedEnvFiles.length, 0, `tracked environment files found: ${trackedEnvFiles.join(', ')}`);
assert.strictEqual(secretMatches.length, 0, `possible credential material found: ${JSON.stringify(secretMatches)}`);
assert.strictEqual(privatePathMatches.length, 0, `private local paths found: ${JSON.stringify(privatePathMatches)}`);
console.log(JSON.stringify({
  trackedFiles: trackedFiles.length,
  trackedEnvFiles: 0,
  secretMatches: 0,
  privatePathMatches: 0,
}));
