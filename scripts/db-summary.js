const pool = require('../server/db');

async function scalar(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows[0]?.c ?? 0;
}

async function requireColumn(table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (!rows[0]?.c) {
    throw new Error(`Missing required column: ${table}.${column}`);
  }
}

async function run() {
  const [
    totalUsers,
    totalPosts,
    totalComments,
    totalBookmarks,
    totalCircles,
    uiUsers,
    latestUiUsers,
  ] = await Promise.all([
    scalar('SELECT COUNT(*) AS c FROM users'),
    scalar('SELECT COUNT(*) AS c FROM posts'),
    scalar('SELECT COUNT(*) AS c FROM comments'),
    scalar('SELECT COUNT(*) AS c FROM bookmarks'),
    scalar('SELECT COUNT(*) AS c FROM circles'),
    scalar("SELECT COUNT(*) AS c FROM users WHERE username LIKE 'ui%'"),
    pool
      .query("SELECT username, nickname, created_at FROM users WHERE username LIKE 'ui%' ORDER BY created_at DESC LIMIT 5")
      .then(([rows]) => rows),
  ]);

  await Promise.all([
    requireColumn('posts', 'stats'),
    requireColumn('sms_codes', 'is_used'),
    requireColumn('refresh_tokens', 'expires_at'),
    requireColumn('email_reset_tokens', 'token_hash'),
    requireColumn('rate_limit_buckets', 'request_count'),
  ]);

  console.log(
    JSON.stringify(
      {
        totals: {
          users: totalUsers,
          posts: totalPosts,
          comments: totalComments,
          bookmarks: totalBookmarks,
          circles: totalCircles,
        },
        uiSmokeUsers: uiUsers,
        latestUiUsers,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((error) => {
    console.log('[db:summary] Failed to read database summary.');
    console.log(`[db:summary] ${error.code || error.name || 'Error'}: ${error.message}`);
    if (error.sqlMessage) {
      console.log(`[db:summary] SQL: ${error.sqlMessage}`);
    }
    console.log('[db:summary] Check server/.env and make sure MySQL is running with the pet_planet schema loaded.');
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
