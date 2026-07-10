const express = require('express');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_CIRCLES = [
  { id: 'c1', name: '\u5e03\u5076\u5708', description: '\u5206\u4eab\u5e03\u5076\u732b\u65e5\u5e38\u3001\u62a4\u7406\u548c\u6210\u957f\u6545\u4e8b', emoji: '\ud83d\udc31', color: '#FF9800' },
  { id: 'c2', name: '\u82f1\u77ed\u5708', description: '\u82f1\u77ed\u7231\u597d\u8005\u4ea4\u6d41\u7a7a\u95f4', emoji: '\ud83d\udc3e', color: '#5AC8FA' },
  { id: 'c3', name: '\u67ef\u57fa\u5708', description: '\u67ef\u57fa\u517b\u62a4\u548c\u8da3\u4e8b\u5206\u4eab', emoji: '\ud83d\udc36', color: '#4CAF50' },
  { id: 'c4', name: '\u91d1\u6bdb\u5708', description: '\u91d1\u6bdb\u6210\u957f\u8bb0\u5f55\u4e0e\u7ecf\u9a8c\u4ea4\u6d41', emoji: '\ud83e\uddae', color: '#FFD700' },
  { id: 'c5', name: '\u65b0\u624b\u94f2\u5c4e\u5b98', description: '\u65b0\u624b\u517b\u5ba0\u95ee\u9898\u96c6\u4e2d\u89e3\u7b54', emoji: '\ud83d\udcd6', color: '#2196F3' },
];

async function ensureDefaultCircles(pool) {
  const [allRows] = await pool.execute('SELECT id FROM circles');
  const existingIds = new Set(allRows.map((row) => row.id));

  for (const circle of DEFAULT_CIRCLES) {
    if (existingIds.has(circle.id)) {
      await pool.execute(
        'UPDATE circles SET name = ?, description = ?, emoji = ?, color = ?, status = ? WHERE id = ?',
        [circle.name, circle.description, circle.emoji, circle.color, 'active', circle.id]
      );
      continue;
    }

    await pool.execute(
      'INSERT INTO circles (id, name, description, emoji, color, creator_id, member_count, post_count, status) VALUES (?, ?, ?, ?, ?, NULL, 0, 0, ?)',
      [circle.id, circle.name, circle.description, circle.emoji, circle.color, 'active']
    );
  }
}

function toCircle(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    emoji: row.emoji || '🐾',
    color: row.color || '#4CAF50',
    memberCount: row.member_count_actual ?? row.member_count ?? 0,
    postCount: row.post_count_actual ?? row.post_count ?? 0,
    isJoined: !!row.is_joined,
    createdAt: row.created_at,
  };
}

router.get('/', optionalAuth, async (req, res) => {
  try {
    await ensureDefaultCircles(req.app.locals.pool);
    const [rows] = await req.app.locals.pool.query(
      `SELECT c.*,
              (
                SELECT COUNT(*)
                FROM circle_members cm_count
                WHERE cm_count.circle_id = c.id
              ) AS member_count_actual,
              (
                SELECT COUNT(*)
                FROM posts p_count
                WHERE p_count.status = 'published'
                  AND JSON_SEARCH(p_count.tags, 'one', c.name) IS NOT NULL
              ) AS post_count_actual,
              EXISTS(
                SELECT 1 FROM circle_members cm
                WHERE cm.circle_id = c.id AND cm.user_id = ?
              ) AS is_joined
       FROM circles c
       WHERE c.status = 'active' AND c.id NOT LIKE 'manual_%'
       ORDER BY c.member_count DESC, c.created_at DESC`,
      [req.user?.id || '']
    );

    return res.json({ code: 0, data: rows.map(toCircle) });
  } catch (error) {
    console.error('Get circles error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.get('/my', authMiddleware, async (req, res) => {
  try {
    await ensureDefaultCircles(req.app.locals.pool);
    const [rows] = await req.app.locals.pool.query(
      `SELECT c.*,
              (
                SELECT COUNT(*)
                FROM circle_members cm_count
                WHERE cm_count.circle_id = c.id
              ) AS member_count_actual,
              (
                SELECT COUNT(*)
                FROM posts p_count
                WHERE p_count.status = 'published'
                  AND JSON_SEARCH(p_count.tags, 'one', c.name) IS NOT NULL
              ) AS post_count_actual,
              TRUE AS is_joined
       FROM circles c
       JOIN circle_members cm ON cm.circle_id = c.id
       WHERE cm.user_id = ? AND c.status = 'active' AND c.id NOT LIKE 'manual_%'
       ORDER BY cm.created_at DESC`,
      [req.user.id]
    );

    return res.json({ code: 0, data: rows.map(toCircle) });
  } catch (error) {
    console.error('Get my circles error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    await ensureDefaultCircles(req.app.locals.pool);
    const [rows] = await req.app.locals.pool.query(
      `SELECT c.*,
              (
                SELECT COUNT(*)
                FROM circle_members cm_count
                WHERE cm_count.circle_id = c.id
              ) AS member_count_actual,
              (
                SELECT COUNT(*)
                FROM posts p_count
                WHERE p_count.status = 'published'
                  AND JSON_SEARCH(p_count.tags, 'one', c.name) IS NOT NULL
              ) AS post_count_actual,
              EXISTS(
                SELECT 1 FROM circle_members cm
                WHERE cm.circle_id = c.id AND cm.user_id = ?
              ) AS is_joined
       FROM circles c
       WHERE c.id = ? AND c.status = 'active' AND c.id NOT LIKE 'manual_%'`,
      [req.user?.id || '', req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ code: 1004, message: '圈子不存在' });
    }

    return res.json({ code: 0, data: toCircle(rows[0]) });
  } catch (error) {
    console.error('Get circle detail error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.post('/:id/join', authMiddleware, async (req, res) => {
  try {
    await ensureDefaultCircles(req.app.locals.pool);
    const [circles] = await req.app.locals.pool.execute(
      'SELECT id FROM circles WHERE id = ? AND status = ?',
      [req.params.id, 'active']
    );
    if (circles.length === 0) {
      return res.status(404).json({ code: 1004, message: '圈子不存在' });
    }

    const [existing] = await req.app.locals.pool.execute(
      'SELECT id FROM circle_members WHERE circle_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (existing.length > 0) {
      await req.app.locals.pool.execute(
        'DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?',
        [req.params.id, req.user.id]
      );
      await req.app.locals.pool.execute(
        'UPDATE circles SET member_count = GREATEST(member_count - 1, 0) WHERE id = ?',
        [req.params.id]
      );
      return res.json({ code: 0, data: { isJoined: false } });
    }

    await req.app.locals.pool.execute(
      'INSERT INTO circle_members (id, circle_id, user_id, role) VALUES (UUID(), ?, ?, ?)',
      [req.params.id, req.user.id, 'member']
    );
    await req.app.locals.pool.execute(
      'UPDATE circles SET member_count = member_count + 1 WHERE id = ?',
      [req.params.id]
    );

    return res.json({ code: 0, data: { isJoined: true } });
  } catch (error) {
    console.error('Toggle circle membership error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.get('/:id/posts', optionalAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const offset = (page - 1) * pageSize;
    const sort = req.query.sort === 'latest' ? 'latest' : 'hot';
    const orderSql = sort === 'latest'
      ? 'ORDER BY p.created_at DESC'
      : 'ORDER BY JSON_EXTRACT(p.stats, "$.likesCount") DESC, p.created_at DESC';

    await ensureDefaultCircles(req.app.locals.pool);
    const [circleRows] = await req.app.locals.pool.execute(
      'SELECT name FROM circles WHERE id = ? AND status = ?',
      [req.params.id, 'active']
    );
    if (circleRows.length === 0) {
      return res.status(404).json({ code: 1004, message: '圈子不存在' });
    }

    const circleName = circleRows[0].name;
    const [rows] = await req.app.locals.pool.query(
      `SELECT p.*, u.id AS author_id, u.nickname, u.avatar_url, u.level,
              (
                SELECT COUNT(*)
                FROM bookmarks b
                WHERE b.post_id = p.id
              ) AS bookmark_count
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.status = 'published'
         AND JSON_SEARCH(p.tags, 'one', ?) IS NOT NULL
       ${orderSql}
       LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`,
      [circleName]
    );

    const data = rows.map((row) => ({
      id: row.id,
      user: {
        id: row.author_id,
        nickname: row.nickname,
        avatarUrl: row.avatar_url,
        level: row.level,
        bio: '',
        postCount: 0,
        followerCount: 0,
        followingCount: 0,
        likeCount: 0,
      },
      content: row.content,
      images: typeof row.images === 'string' ? JSON.parse(row.images) : (row.images || []),
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
      circleId: req.params.id,
      stats: typeof row.stats === 'string' ? JSON.parse(row.stats) : (row.stats || {}),
      likeCount: typeof row.stats === 'string' ? (JSON.parse(row.stats).likesCount || 0) : (row.stats?.likesCount || 0),
      commentCount: typeof row.stats === 'string' ? (JSON.parse(row.stats).commentsCount || 0) : (row.stats?.commentsCount || 0),
      bookmarkCount: row.bookmark_count || 0,
      isLiked: false,
      isBookmarked: false,
      status: row.status,
      createdAt: row.created_at,
    }));

    return res.json({ code: 0, data, total: data.length });
  } catch (error) {
    console.error('Get circle posts error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

module.exports = router;
