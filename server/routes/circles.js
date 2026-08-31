const express = require('express');
const { v4: uuidv4 } = require('uuid');
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
                  AND p_count.circle_id = c.id
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
                  AND p_count.circle_id = c.id
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
                  AND p_count.circle_id = c.id
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

router.post('/', authMiddleware, async (req, res) => {
  const { name, description = '', emoji = '🐾', color = '#4CAF50' } = req.body || {};
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (trimmedName.length < 2 || trimmedName.length > 30) {
    return res.status(400).json({ code: 1001, message: '圈子名称需为2-30个字符' });
  }
  if (typeof description !== 'string' || description.length > 200) {
    return res.status(400).json({ code: 1001, message: '圈子简介最多200个字符' });
  }

  let connection;
  try {
    connection = await req.app.locals.pool.getConnection();
    await connection.beginTransaction();
    await ensureDefaultCircles(req.app.locals.pool);

    const [existing] = await connection.execute(
      'SELECT id FROM circles WHERE name = ? AND status = ?',
      [trimmedName, 'active']
    );
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({ code: 1002, message: '圈子名称已存在' });
    }

    const circleId = uuidv4();
    await connection.execute(
      `INSERT INTO circles
       (id, name, description, emoji, color, creator_id, member_count, post_count, status)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0, 'active')`,
      [circleId, trimmedName, description.trim(), emoji, color, req.user.id]
    );
    await connection.execute(
      'INSERT INTO circle_members (id, circle_id, user_id, role) VALUES (?, ?, ?, ?)',
      [uuidv4(), circleId, req.user.id, 'owner']
    );
    await connection.commit();

    return res.status(201).json({
      code: 0,
      data: {
        id: circleId,
        name: trimmedName,
        description: description.trim(),
        emoji,
        color,
        memberCount: 1,
        postCount: 0,
        isJoined: true,
        createdAt: new Date().toISOString(),
        currentUserRole: 'owner',
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Create circle error:', error);
    return res.status(500).json({ code: 5000, message: '创建圈子失败' });
  } finally {
    connection?.release();
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  const body = req.body || {};
  const updates = {};
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2 || name.length > 30) {
      return res.status(400).json({ code: 1001, message: '圈子名称需为2-30个字符' });
    }
    updates.name = name;
  }
  if (body.description !== undefined) {
    if (typeof body.description !== 'string' || body.description.length > 200) {
      return res.status(400).json({ code: 1001, message: '圈子简介最多200个字符' });
    }
    updates.description = body.description.trim();
  }
  if (body.emoji !== undefined) {
    if (typeof body.emoji !== 'string' || body.emoji.trim().length === 0 || body.emoji.length > 10) {
      return res.status(400).json({ code: 1001, message: '圈子图标格式不正确' });
    }
    updates.emoji = body.emoji.trim();
  }
  if (body.color !== undefined) {
    if (typeof body.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
      return res.status(400).json({ code: 1001, message: '圈子主题色格式不正确' });
    }
    updates.color = body.color;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ code: 1001, message: '至少提供一个可编辑字段' });
  }

  try {
    await ensureDefaultCircles(req.app.locals.pool);
    const [circleRows] = await req.app.locals.pool.execute(
      `SELECT c.id, cm.role
       FROM circles c
       LEFT JOIN circle_members cm ON cm.circle_id = c.id AND cm.user_id = ?
       WHERE c.id = ? AND c.status = 'active'`,
      [req.user.id, req.params.id]
    );
    if (circleRows.length === 0) {
      return res.status(404).json({ code: 1004, message: '圈子不存在' });
    }
    if (circleRows[0].role !== 'owner') {
      return res.status(403).json({ code: 1003, message: '仅圈主可以编辑圈子' });
    }

    if (updates.name) {
      const [duplicates] = await req.app.locals.pool.execute(
        'SELECT id FROM circles WHERE name = ? AND status = ? AND id <> ? LIMIT 1',
        [updates.name, 'active', req.params.id]
      );
      if (duplicates.length > 0) {
        return res.status(409).json({ code: 1002, message: '圈子名称已存在' });
      }
    }

    const fields = Object.keys(updates);
    const values = fields.map((field) => updates[field]);
    await req.app.locals.pool.execute(
      `UPDATE circles SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`,
      [...values, req.params.id]
    );
    const [rows] = await req.app.locals.pool.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM circle_members cm_count WHERE cm_count.circle_id = c.id) AS member_count_actual,
              (SELECT COUNT(*) FROM posts p_count WHERE p_count.status = 'published' AND p_count.circle_id = c.id) AS post_count_actual,
              TRUE AS is_joined
       FROM circles c
       WHERE c.id = ?`,
      [req.params.id]
    );
    return res.json({ code: 0, data: { ...toCircle(rows[0]), currentUserRole: 'owner' } });
  } catch (error) {
    console.error('Update circle error:', error);
    return res.status(500).json({ code: 5000, message: '编辑圈子失败' });
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

    const [roleRows] = await req.app.locals.pool.execute(
      'SELECT role FROM circle_members WHERE circle_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (roleRows[0]?.role === 'owner') {
      return res.status(403).json({ code: 1003, message: '圈主不能退出自己创建的圈子' });
    }

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

async function requireCircleOwner(pool, circleId, userId) {
  const [rows] = await pool.execute(
    `SELECT c.id, cm.role
     FROM circles c
     LEFT JOIN circle_members cm ON cm.circle_id = c.id AND cm.user_id = ?
     WHERE c.id = ? AND c.status = 'active'`,
    [userId, circleId]
  );
  if (rows.length === 0) return { status: 404, message: '圈子不存在' };
  if (rows[0].role !== 'owner') return { status: 403, message: '仅圈主可以管理成员' };
  return null;
}

router.patch('/:id/members/:userId', authMiddleware, async (req, res) => {
  const role = req.body?.role;
  if (role !== 'admin' && role !== 'member') {
    return res.status(400).json({ code: 1001, message: '成员角色只能是 admin 或 member' });
  }
  try {
    const permissionError = await requireCircleOwner(req.app.locals.pool, req.params.id, req.user.id);
    if (permissionError) {
      return res.status(permissionError.status).json({ code: permissionError.status === 404 ? 1004 : 1003, message: permissionError.message });
    }
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ code: 1001, message: '圈主不能修改自己的角色' });
    }
    const [members] = await req.app.locals.pool.execute(
      'SELECT user_id, role FROM circle_members WHERE circle_id = ? AND user_id = ?',
      [req.params.id, req.params.userId]
    );
    if (members.length === 0) {
      return res.status(404).json({ code: 1004, message: '成员不存在' });
    }
    if (members[0].role === 'owner') {
      return res.status(400).json({ code: 1001, message: '不能修改圈主角色' });
    }
    await req.app.locals.pool.execute(
      'UPDATE circle_members SET role = ? WHERE circle_id = ? AND user_id = ?',
      [role, req.params.id, req.params.userId]
    );
    return res.json({ code: 0, data: { userId: req.params.userId, role } });
  } catch (error) {
    console.error('Update circle member role error:', error);
    return res.status(500).json({ code: 5000, message: '更新成员角色失败' });
  }
});

router.delete('/:id/members/:userId', authMiddleware, async (req, res) => {
  try {
    const permissionError = await requireCircleOwner(req.app.locals.pool, req.params.id, req.user.id);
    if (permissionError) {
      return res.status(permissionError.status).json({ code: permissionError.status === 404 ? 1004 : 1003, message: permissionError.message });
    }
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ code: 1001, message: '圈主不能移除自己' });
    }
    const [members] = await req.app.locals.pool.execute(
      'SELECT role FROM circle_members WHERE circle_id = ? AND user_id = ?',
      [req.params.id, req.params.userId]
    );
    if (members.length === 0) {
      return res.status(404).json({ code: 1004, message: '成员不存在' });
    }
    if (members[0].role === 'owner') {
      return res.status(400).json({ code: 1001, message: '不能移除圈主' });
    }
    await req.app.locals.pool.execute(
      'DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?',
      [req.params.id, req.params.userId]
    );
    await req.app.locals.pool.execute(
      'UPDATE circles SET member_count = GREATEST(member_count - 1, 0) WHERE id = ?',
      [req.params.id]
    );
    return res.json({ code: 0, data: { userId: req.params.userId, removed: true } });
  } catch (error) {
    console.error('Remove circle member error:', error);
    return res.status(500).json({ code: 5000, message: '移除成员失败' });
  }
});

router.patch('/:id/owner', authMiddleware, async (req, res) => {
  const targetUserId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
  if (!targetUserId) {
    return res.status(400).json({ code: 1001, message: '必须提供新的圈主用户 ID' });
  }

  let connection;
  try {
    connection = await req.app.locals.pool.getConnection();
    await connection.beginTransaction();
    const [circles] = await connection.execute(
      `SELECT c.id
       FROM circles c
       JOIN circle_members cm ON cm.circle_id = c.id AND cm.user_id = ? AND cm.role = 'owner'
       WHERE c.id = ? AND c.status = 'active'
       FOR UPDATE`,
      [req.user.id, req.params.id]
    );
    if (circles.length === 0) {
      await connection.rollback();
      const [existing] = await connection.execute('SELECT id FROM circles WHERE id = ?', [req.params.id]);
      return res.status(existing.length === 0 ? 404 : 403).json({
        code: existing.length === 0 ? 1004 : 1003,
        message: existing.length === 0 ? '圈子不存在' : '仅圈主可以转让圈子',
      });
    }
    if (targetUserId === req.user.id) {
      await connection.rollback();
      return res.status(400).json({ code: 1001, message: '新的圈主不能是当前圈主' });
    }

    const [targetMembers] = await connection.execute(
      'SELECT role FROM circle_members WHERE circle_id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, targetUserId]
    );
    if (targetMembers.length === 0) {
      await connection.rollback();
      return res.status(400).json({ code: 1001, message: '新的圈主必须已经加入圈子' });
    }
    if (targetMembers[0].role === 'owner') {
      await connection.rollback();
      return res.status(400).json({ code: 1001, message: '目标用户已经是圈主' });
    }

    await connection.execute(
      'UPDATE circle_members SET role = ? WHERE circle_id = ? AND user_id = ?',
      ['member', req.params.id, req.user.id]
    );
    await connection.execute(
      'UPDATE circle_members SET role = ? WHERE circle_id = ? AND user_id = ?',
      ['owner', req.params.id, targetUserId]
    );
    await connection.execute(
      'UPDATE circles SET creator_id = ? WHERE id = ?',
      [targetUserId, req.params.id]
    );
    await connection.commit();
    return res.json({ code: 0, data: { circleId: req.params.id, previousOwnerId: req.user.id, ownerId: targetUserId } });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Transfer circle ownership error:', error);
    return res.status(500).json({ code: 5000, message: '转让圈主失败' });
  } finally {
    connection?.release();
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await req.app.locals.pool.getConnection();
    await connection.beginTransaction();
    const [circles] = await connection.execute(
      `SELECT c.id
       FROM circles c
       JOIN circle_members cm ON cm.circle_id = c.id AND cm.user_id = ? AND cm.role = 'owner'
       WHERE c.id = ? AND c.status = 'active'
       FOR UPDATE`,
      [req.user.id, req.params.id]
    );
    if (circles.length === 0) {
      await connection.rollback();
      const [existing] = await connection.execute('SELECT id FROM circles WHERE id = ?', [req.params.id]);
      return res.status(existing.length === 0 ? 404 : 403).json({
        code: existing.length === 0 ? 1004 : 1003,
        message: existing.length === 0 ? '圈子不存在' : '仅圈主可以解散圈子',
      });
    }
    await connection.execute(
      `UPDATE circles
       SET status = 'deleted', member_count = 0
       WHERE id = ?`,
      [req.params.id]
    );
    await connection.commit();
    return res.json({ code: 0, data: { circleId: req.params.id, deleted: true } });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Disband circle error:', error);
    return res.status(500).json({ code: 5000, message: '解散圈子失败' });
  } finally {
    connection?.release();
  }
});

router.get('/:id/members', optionalAuth, async (req, res) => {
  try {
    await ensureDefaultCircles(req.app.locals.pool);
    const [circleRows] = await req.app.locals.pool.execute(
      'SELECT id FROM circles WHERE id = ? AND status = ?',
      [req.params.id, 'active']
    );
    if (circleRows.length === 0) {
      return res.status(404).json({ code: 1004, message: '圈子不存在' });
    }

    const [rows] = await req.app.locals.pool.query(
      `SELECT cm.user_id, cm.role, cm.created_at,
              u.nickname, u.avatar_url, u.level
       FROM circle_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.circle_id = ?
       ORDER BY FIELD(cm.role, 'owner', 'admin', 'member'), cm.created_at ASC`,
      [req.params.id]
    );
    const currentMember = rows.find((row) => row.user_id === req.user?.id);
    return res.json({
      code: 0,
      data: {
        members: rows.map((row) => ({
          userId: row.user_id,
          nickname: row.nickname,
          avatarUrl: row.avatar_url,
          level: row.level,
          role: row.role,
          joinedAt: row.created_at,
        })),
        currentUserRole: currentMember?.role || null,
      },
    });
  } catch (error) {
    console.error('Get circle members error:', error);
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
      'SELECT id FROM circles WHERE id = ? AND status = ?',
      [req.params.id, 'active']
    );
    if (circleRows.length === 0) {
      return res.status(404).json({ code: 1004, message: '圈子不存在' });
    }

    const [rows] = await req.app.locals.pool.query(
      `SELECT p.*, u.id AS author_id, u.nickname, u.avatar_url, u.level,
              (
                SELECT COUNT(*)
                FROM bookmarks b
                WHERE b.post_id = p.id
              ) AS bookmark_count,
              EXISTS(
                SELECT 1 FROM likes l
                WHERE l.target_type = 'post' AND l.target_id = p.id AND l.user_id = ?
              ) AS is_liked,
              EXISTS(
                SELECT 1 FROM bookmarks b_user
                WHERE b_user.post_id = p.id AND b_user.user_id = ?
              ) AS is_bookmarked
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.status = 'published'
         AND p.circle_id = ?
       ${orderSql}
       LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`,
      [req.user?.id || '', req.user?.id || '', req.params.id]
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
      circleId: row.circle_id,
      stats: typeof row.stats === 'string' ? JSON.parse(row.stats) : (row.stats || {}),
      likeCount: typeof row.stats === 'string' ? (JSON.parse(row.stats).likesCount || 0) : (row.stats?.likesCount || 0),
      commentCount: typeof row.stats === 'string' ? (JSON.parse(row.stats).commentsCount || 0) : (row.stats?.commentsCount || 0),
      bookmarkCount: row.bookmark_count || 0,
      isLiked: Boolean(row.is_liked),
      isBookmarked: Boolean(row.is_bookmarked),
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
