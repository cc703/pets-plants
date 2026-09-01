const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
  path.join(__dirname, '..', 'server', 'migrations', '008_backfill_post_circle_ids.sql'),
  'utf8',
);
const statsMigration = fs.readFileSync(
  path.join(__dirname, '..', 'server', 'migrations', '004_posts_stats_schema.sql'),
  'utf8',
);
const authMigration = fs.readFileSync(
  path.join(__dirname, '..', 'server', 'migrations', '002_auth_tables.sql'),
  'utf8',
);
const communityMigration = fs.readFileSync(
  path.join(__dirname, '..', 'server', 'migrations', '003_community_tables.sql'),
  'utf8',
);
const emailIdentityMigration = fs.readFileSync(
  path.join(__dirname, '..', 'server', 'migrations', '007_email_identity.sql'),
  'utf8',
);
const fullSchema = fs.readFileSync(
  path.join(__dirname, '..', 'server', 'full_schema.sql'),
  'utf8',
);
const emailVerificationMigration = fs.readFileSync(
  path.join(__dirname, '..', 'server', 'migrations', '009_email_verification.sql'),
  'utf8',
);
const emailLoginMigration = fs.readFileSync(
  path.join(__dirname, '..', 'server', 'migrations', '010_email_login_codes.sql'),
  'utf8',
);
const migrationReadme = fs.readFileSync(
  path.join(__dirname, '..', 'server', 'migrations', 'README.md'),
  'utf8',
);

assert.match(
  statsMigration,
  /INFORMATION_SCHEMA\.COLUMNS[\s\S]*COLUMN_NAME = 'stats'[\s\S]*PREPARE add_posts_stats/i,
  'migration 004 must conditionally create posts.stats for legacy databases',
);

assert.match(
  statsMigration,
  /posts_likes_count_exists[\s\S]*posts_comments_count_exists[\s\S]*posts_views_count_exists[\s\S]*PREPARE backfill_posts_stats/i,
  'migration 004 must backfill stats using only counter columns present in the legacy schema',
);

assert.match(
  migration,
  /INFORMATION_SCHEMA\.COLUMNS[\s\S]*COLUMN_NAME = 'circle_id'[\s\S]*PREPARE add_posts_circle/i,
  'migration 008 must conditionally create posts.circle_id for legacy databases',
);

assert.match(
  migration,
  /INFORMATION_SCHEMA\.TABLES[\s\S]*TABLE_NAME = 'circles'[\s\S]*PREPARE backfill_posts_circle/i,
  'migration 008 must skip circle backfill when the historical schema has no circles table',
);

const ddlPosition = migration.search(/PREPARE add_posts_circle/i);
const backfillPosition = migration.search(/UPDATE posts(?:\s+\w+)?\s+JOIN circles/i);
assert.ok(ddlPosition >= 0 && ddlPosition < backfillPosition, 'circle_id DDL must run before backfill');

for (const column of [
  'password_hash',
  'gender',
  'birthday',
  'city',
  'followers_count',
  'following_count',
  'posts_count',
]) {
  assert.match(
    authMigration,
    new RegExp(`COLUMN_NAME\\s*=\\s*'${column}'`, 'i'),
    `migration 002 must check whether users.${column} already exists`,
  );
}
assert.match(
  authMigration,
  /PREPARE\s+add_users_/i,
  'migration 002 must use conditional PREPARE statements for user columns',
);
assert.match(
  authMigration,
  /ADD COLUMN password_hash VARCHAR\(255\) NULL/i,
  'migration 002 must preserve an explicit empty-password state for legacy users',
);
assert.match(
  authMigration,
  /IS_NULLABLE\s*=\s*'YES'[\s\S]*MODIFY COLUMN password_hash VARCHAR\(255\) NULL/i,
  'migration 002 must relax an existing NOT NULL password_hash column for legacy users',
);
assert.match(
  communityMigration,
  /INFORMATION_SCHEMA\.COLUMNS[\s\S]*COLUMN_NAME\s*=\s*'reply_to_user_id'[\s\S]*PREPARE/i,
  'migration 003 must conditionally create comments.reply_to_user_id',
);
assert.match(
  communityMigration,
  /INFORMATION_SCHEMA\.STATISTICS[\s\S]*COLUMN_NAME\s*=\s*'parent_id'[\s\S]*PREPARE/i,
  'migration 003 must conditionally create the comments parent index',
);
assert.match(
  emailIdentityMigration,
  /INFORMATION_SCHEMA\.STATISTICS[\s\S]*NON_UNIQUE\s*=\s*0[\s\S]*HAVING COUNT\(\*\) = 1 AND MAX\(COLUMN_NAME = 'email'\) = 1[\s\S]*PREPARE/i,
  'migration 007 must accept only a single-column unique users.email index',
);

assert.match(fullSchema, /email_verified_at\s+TIMESTAMP\s+NULL/i, 'full schema must include email_verified_at');
assert.match(fullSchema, /CREATE TABLE IF NOT EXISTS email_verification_tokens/i, 'full schema must include email verification tokens');
assert.match(fullSchema, /CREATE TABLE IF NOT EXISTS email_login_codes/i, 'full schema must include email login codes');
assert.match(emailVerificationMigration, /CREATE TABLE IF NOT EXISTS email_verification_tokens/i);
assert.match(emailLoginMigration, /CREATE TABLE IF NOT EXISTS email_login_codes/i);
assert.match(migrationReadme, /009_email_verification\.sql[\s\S]*010_email_login_codes\.sql/i, 'migration README must include email migrations');
assert.match(
  migration,
  /posts_circle_index_exists[\s\S]*COLUMN_NAME = 'circle_id'[\s\S]*PREPARE add_posts_circle_index/i,
  'migration 008 must conditionally create the posts.circle_id index',
);

console.log('migration contract check passed');
