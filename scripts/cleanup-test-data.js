const pool = require('../server/db');

const USER_PATTERN =
  "^(probe_|flow|compat_|cm|cc|cl|fa|fb|fw|ci|bm|px|ep|cp|st|utf|ga|gb|bk|uf|cy|pf|cfix|debug_|ph|tc|ui_smoke_)";

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function collectTargets() {
  const suspiciousUsers = await query(
    `SELECT DISTINCT u.id, u.username, u.nickname
     FROM users u
     LEFT JOIN posts p ON p.user_id = u.id
     LEFT JOIN comments c ON c.user_id = u.id
     WHERE u.username REGEXP ?
        OR u.nickname LIKE '%?%'
        OR p.content LIKE '%?%'
        OR c.content LIKE '%?%'`,
    [USER_PATTERN],
  );

  const suspiciousPosts = await query(
    `SELECT DISTINCT p.id
     FROM posts p
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.content LIKE '%?%'
        OR u.username REGEXP ?`,
    [USER_PATTERN],
  );

  const suspiciousComments = await query(
    `SELECT DISTINCT c.id
     FROM comments c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.content LIKE '%?%'
        OR u.username REGEXP ?`,
    [USER_PATTERN],
  );

  const suspiciousCircles = await query(
    `SELECT id FROM circles WHERE id LIKE 'manual_%' OR name LIKE '%?%'`,
  );

  return {
    users: suspiciousUsers.map((item) => item.id),
    posts: suspiciousPosts.map((item) => item.id),
    comments: suspiciousComments.map((item) => item.id),
    circles: suspiciousCircles.map((item) => item.id),
    preview: {
      users: suspiciousUsers,
      posts: suspiciousPosts,
      comments: suspiciousComments,
      circles: suspiciousCircles,
    },
  };
}

async function cleanup(apply) {
  const targets = await collectTargets();
  const summary = {
    counts: {
      users: targets.users.length,
      posts: targets.posts.length,
      comments: targets.comments.length,
      circles: targets.circles.length,
    },
    preview: targets.preview,
    applied: apply,
  };

  if (!apply) return summary;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (targets.comments.length > 0) {
      await conn.query(
        `DELETE FROM likes WHERE target_type = 'comment' AND target_id IN (${targets.comments.map(() => '?').join(',')})`,
        targets.comments,
      );
      await conn.query(
        `DELETE FROM comments WHERE id IN (${targets.comments.map(() => '?').join(',')})`,
        targets.comments,
      );
    }

    if (targets.posts.length > 0) {
      await conn.query(
        `DELETE FROM likes WHERE target_type = 'post' AND target_id IN (${targets.posts.map(() => '?').join(',')})`,
        targets.posts,
      );
      await conn.query(
        `DELETE FROM bookmarks WHERE post_id IN (${targets.posts.map(() => '?').join(',')})`,
        targets.posts,
      );
      await conn.query(
        `DELETE FROM posts WHERE id IN (${targets.posts.map(() => '?').join(',')})`,
        targets.posts,
      );
    }

    if (targets.users.length > 0) {
      await conn.query(
        `DELETE FROM notifications WHERE user_id IN (${targets.users.map(() => '?').join(',')}) OR from_user_id IN (${targets.users.map(() => '?').join(',')})`,
        [...targets.users, ...targets.users],
      );
      await conn.query(
        `DELETE FROM messages WHERE sender_id IN (${targets.users.map(() => '?').join(',')})`,
        targets.users,
      );
      await conn.query(
        `DELETE FROM conversations WHERE user1_id IN (${targets.users.map(() => '?').join(',')}) OR user2_id IN (${targets.users.map(() => '?').join(',')})`,
        [...targets.users, ...targets.users],
      );
      await conn.query(
        `DELETE FROM follows WHERE follower_id IN (${targets.users.map(() => '?').join(',')}) OR following_id IN (${targets.users.map(() => '?').join(',')})`,
        [...targets.users, ...targets.users],
      );
      await conn.query(
        `DELETE FROM circle_members WHERE user_id IN (${targets.users.map(() => '?').join(',')})`,
        targets.users,
      );
      await conn.query(
        `DELETE FROM bookmarks WHERE user_id IN (${targets.users.map(() => '?').join(',')})`,
        targets.users,
      );
      await conn.query(
        `DELETE FROM points_history WHERE user_id IN (${targets.users.map(() => '?').join(',')})`,
        targets.users,
      );
      await conn.query(
        `DELETE FROM check_ins WHERE user_id IN (${targets.users.map(() => '?').join(',')})`,
        targets.users,
      );
      await conn.query(
        `DELETE FROM quiz_records WHERE user_id IN (${targets.users.map(() => '?').join(',')})`,
        targets.users,
      );
      await conn.query(
        `DELETE FROM refresh_tokens WHERE user_id IN (${targets.users.map(() => '?').join(',')})`,
        targets.users,
      );
      await conn.query(
        `DELETE FROM virtual_pets WHERE user_id IN (${targets.users.map(() => '?').join(',')})`,
        targets.users,
      );
      await conn.query(
        `DELETE FROM reports WHERE reporter_id IN (${targets.users.map(() => '?').join(',')})`,
        targets.users,
      );
      await conn.query(
        `DELETE FROM users WHERE id IN (${targets.users.map(() => '?').join(',')})`,
        targets.users,
      );
    }

    if (targets.circles.length > 0) {
      await conn.query(
        `DELETE FROM circle_members WHERE circle_id IN (${targets.circles.map(() => '?').join(',')})`,
        targets.circles,
      );
      await conn.query(
        `DELETE FROM circles WHERE id IN (${targets.circles.map(() => '?').join(',')})`,
        targets.circles,
      );
    }

    await conn.commit();
    return summary;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

(async () => {
  const apply = process.argv.includes('--apply');
  try {
    const result = await cleanup(apply);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
})().catch((error) => {
  console.log('[db:cleanup] Failed to inspect or clean test data.');
  console.log(`[db:cleanup] ${error.code || error.name || 'Error'}: ${error.message}`);
  if (error.sqlMessage) {
    console.log(`[db:cleanup] SQL: ${error.sqlMessage}`);
  }
  console.log('[db:cleanup] Check server/.env and make sure MySQL is running with the pet_planet schema loaded.');
  process.exit(1);
});
