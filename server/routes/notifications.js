const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 10));
    const offset = (page - 1) * pageSize;

    const [countRows] = await req.app.locals.pool.execute(
      'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?',
      [req.user.id]
    );
    const total = countRows[0].total;

    const [rows] = await req.app.locals.pool.query(
      `SELECT n.*, u.nickname as from_nickname, u.avatar_url as from_avatar
       FROM notifications n
       LEFT JOIN users u ON n.from_user_id = u.id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`,
      [req.user.id]
    );

    const data = rows.map((r) => ({
      id: r.id,
      type: r.type,
      fromUser: r.from_user_id ? { id: r.from_user_id, nickname: r.from_nickname, avatarUrl: r.from_avatar } : null,
      targetId: r.target_id,
      targetType: r.target_type,
      content: r.content,
      isRead: !!r.is_read,
      createdAt: r.created_at,
    }));

    return res.json({ code: 0, data, total, page, hasMore: offset + pageSize < total });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const [rows] = await req.app.locals.pool.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    return res.json({ code: 0, data: rows[0].count });
  } catch (error) {
    console.error('Get unread count error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.post('/:id/read', authMiddleware, async (req, res) => {
  try {
    await req.app.locals.pool.execute(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    return res.json({ code: 0, message: '已标记已读' });
  } catch (error) {
    console.error('Mark read error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.post('/read-all', authMiddleware, async (req, res) => {
  try {
    await req.app.locals.pool.execute(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    return res.json({ code: 0, message: '已全部标记已读' });
  } catch (error) {
    console.error('Mark all read error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

module.exports = router;
