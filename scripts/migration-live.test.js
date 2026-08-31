const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mysql = require(path.join(__dirname, '..', 'server', 'node_modules', 'mysql2', 'promise'));
require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({
  path: path.join(__dirname, '..', 'server', '.env'),
});

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
  charset: 'utf8mb4',
};
const testPrefix = 'pet_planet_migration_test_';
const suffix = `${process.pid}_${Date.now()}`;
const legacyDatabase = `${testPrefix}legacy_${suffix}`;
const freshDatabase = `${testPrefix}fresh_${suffix}`;
const migrationFiles = [
  '002_auth_tables.sql',
  '003_community_tables.sql',
  '004_posts_stats_schema.sql',
  '005_email_reset_and_rate_limit.sql',
  '006_user_pets.sql',
  '007_email_identity.sql',
  '008_backfill_post_circle_ids.sql',
  '009_email_verification.sql',
  '010_email_login_codes.sql',
];

function quoteIdentifier(identifier) {
  assert.match(identifier, /^pet_planet_migration_test_[a-z0-9_]+$/i);
  return `\`${identifier}\``;
}

function quoteSchemaName(schemaName) {
  assert.match(schemaName, /^pet_planet_migration_test_[a-z0-9_]+$/i);
  return `'${schemaName}'`;
}

function readSql(fileName, databaseName) {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'server', fileName), 'utf8');
  const escapedDatabase = quoteIdentifier(databaseName);
  return sql
    .replace(/^\s*CREATE\s+DATABASE\s+IF\s+NOT\s+EXISTS\s+`?pet_planet`?[^;]*;\s*/gim, '')
    .replace(/^\s*USE\s+`?pet_planet`?\s*;/gim, `USE ${escapedDatabase};`);
}

async function createDatabase(connection, databaseName) {
  const database = quoteIdentifier(databaseName);
  await connection.query(`DROP DATABASE IF EXISTS ${database}`);
  await connection.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
}

async function executeSqlFile(connection, fileName, databaseName) {
  await connection.query(readSql(fileName, databaseName));
}

async function migrationSnapshot(connection, databaseName) {
  const database = quoteSchemaName(databaseName);
  const [columns] = await connection.query(
    `SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ${database}
       AND ((TABLE_NAME = 'users' AND COLUMN_NAME IN ('password_hash', 'gender', 'birthday', 'city', 'followers_count', 'following_count', 'posts_count', 'email_verified_at'))
         OR (TABLE_NAME = 'comments' AND COLUMN_NAME = 'reply_to_user_id')
         OR (TABLE_NAME = 'posts' AND COLUMN_NAME IN ('stats', 'circle_id')))
     ORDER BY TABLE_NAME, COLUMN_NAME`,
  );
  const [indexes] = await connection.query(
    `SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ${database}
       AND ((TABLE_NAME = 'comments' AND COLUMN_NAME = 'parent_id')
         OR (TABLE_NAME = 'posts' AND COLUMN_NAME = 'circle_id')
         OR (TABLE_NAME = 'users' AND COLUMN_NAME = 'email'))
     ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
  );
  const [tables] = await connection.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ${database}
       AND TABLE_NAME IN ('user_pets', 'email_reset_tokens', 'rate_limit_buckets', 'email_verification_tokens', 'email_login_codes')
     ORDER BY TABLE_NAME`,
  );
  return { columns, indexes, tables };
}

function assertEmailAuthSchema(snapshot) {
  assert.ok(
    snapshot.columns.some((column) => column.TABLE_NAME === 'users' && column.COLUMN_NAME === 'email_verified_at'),
    'users.email_verified_at must exist',
  );
  for (const tableName of ['email_verification_tokens', 'email_login_codes']) {
    assert.ok(snapshot.tables.some((table) => table.TABLE_NAME === tableName), `${tableName} must exist`);
  }
}

function assertPasswordNullability(snapshot, expected) {
  const column = snapshot.columns.find((item) => item.TABLE_NAME === 'users' && item.COLUMN_NAME === 'password_hash');
  assert.ok(column, 'users.password_hash must exist');
  assert.strictEqual(column.IS_NULLABLE, expected, `users.password_hash must be ${expected}`);
}

async function runLegacyMigrationTest(connection) {
  await createDatabase(connection, legacyDatabase);
  await executeSqlFile(connection, 'schema.sql', legacyDatabase);

  for (const migrationFile of migrationFiles) {
    await executeSqlFile(connection, path.join('migrations', migrationFile), legacyDatabase);
  }
  const afterFirstRun = await migrationSnapshot(connection, legacyDatabase);
  for (const migrationFile of migrationFiles) {
    await executeSqlFile(connection, path.join('migrations', migrationFile), legacyDatabase);
  }
  const afterSecondRun = await migrationSnapshot(connection, legacyDatabase);

  assert.deepStrictEqual(afterSecondRun, afterFirstRun, 'migrations 002-010 changed schema on the second run');
  assertEmailAuthSchema(afterSecondRun);
  assertPasswordNullability(afterSecondRun, 'YES');
  assert.ok(
    afterSecondRun.indexes.some((index) => index.TABLE_NAME === 'posts' && index.COLUMN_NAME === 'circle_id' && index.SEQ_IN_INDEX === 1),
    'posts.circle_id must be indexed after legacy migration',
  );
  return afterSecondRun;
}

async function runFreshSchemaTest(connection) {
  await createDatabase(connection, freshDatabase);
  await executeSqlFile(connection, 'full_schema.sql', freshDatabase);
  const snapshot = await migrationSnapshot(connection, freshDatabase);
  assertEmailAuthSchema(snapshot);
  assertPasswordNullability(snapshot, 'NO');
  return snapshot;
}

(async () => {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const legacy = await runLegacyMigrationTest(connection);
    const fresh = await runFreshSchemaTest(connection);
    console.log(JSON.stringify({ legacy, fresh }));
  }
  finally {
    await connection.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(legacyDatabase)}`);
    await connection.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(freshDatabase)}`);
    await connection.end();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
