const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function toConversationRow(row, currentUserId) {
  const isUser1 = row.user1_id === currentUserId;
  return {
    id: row.id,
    user: {
      id: isUser1 ? row.user2_id : row.user1_id,
      nickname: isUser1 ? row.user2_nickname : row.user1_nickname,
      avatarUrl: isUser1 ? row.user2_avatar : row.user1_avatar,
      bio: '',
      level: isUser1 ? row.user2_level : row.user1_level,
      postCount: 0,
      followerCount: 0,
      followingCount: 0,
      likeCount: 0,
    },
    lastMessage: row.last_message || '',
    lastMessageType: row.last_message_type || 'text',
    unreadCount: row.unread_count || 0,
    updatedAt: row.last_message_at || row.created_at,
  };
}

router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const [rows] = await req.app.locals.pool.execute(
      `SELECT c.*,
              u1.nickname AS user1_nickname, u1.avatar_url AS user1_avatar, u1.level AS user1_level,
              u2.nickname AS user2_nickname, u2.avatar_url AS user2_avatar, u2.level AS user2_level,
              (
                SELECT COUNT(*)
                FROM messages m
                WHERE m.conversation_id = c.id
                  AND m.sender_id != ?
                  AND m.is_read = FALSE
              ) AS unread_count
       FROM conversations c
       JOIN users u1 ON c.user1_id = u1.id
       JOIN users u2 ON c.user2_id = u2.id
       WHERE c.user1_id = ? OR c.user2_id = ?
       ORDER BY c.last_message_at DESC, c.created_at DESC`,
      [req.user.id, req.user.id, req.user.id]
    );

    return res.json({ code: 0, data: rows.map((row) => toConversationRow(row, req.user.id)) });
  } catch (error) {
    console.error('Get conversations error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.post('/conversations', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId || userId === req.user.id) {
      return res.status(400).json({ code: 1001, message: '会话目标无效' });
    }

    const [targets] = await req.app.locals.pool.execute(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );
    if (targets.length === 0) {
      return res.status(404).json({ code: 1004, message: '用户不存在' });
    }

    const [userA, userB] = [req.user.id, userId].sort();
    const [existing] = await req.app.locals.pool.execute(
      'SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?',
      [userA, userB]
    );

    let conversationId = existing[0]?.id;
    if (!conversationId) {
      conversationId = uuidv4();
      await req.app.locals.pool.execute(
        'INSERT INTO conversations (id, user1_id, user2_id) VALUES (?, ?, ?)',
        [conversationId, userA, userB]
      );
    }

    const [rows] = await req.app.locals.pool.execute(
      `SELECT c.*,
              u1.nickname AS user1_nickname, u1.avatar_url AS user1_avatar, u1.level AS user1_level,
              u2.nickname AS user2_nickname, u2.avatar_url AS user2_avatar, u2.level AS user2_level,
              0 AS unread_count
       FROM conversations c
       JOIN users u1 ON c.user1_id = u1.id
       JOIN users u2 ON c.user2_id = u2.id
       WHERE c.id = ?`,
      [conversationId]
    );

    return res.status(201).json({ code: 0, data: toConversationRow(rows[0], req.user.id) });
  } catch (error) {
    console.error('Create conversation error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const [rows] = await req.app.locals.pool.execute(
      `SELECT COUNT(*) AS count
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE m.sender_id != ?
         AND m.is_read = FALSE
         AND (c.user1_id = ? OR c.user2_id = ?)`,
      [req.user.id, req.user.id, req.user.id]
    );

    return res.json({ code: 0, data: rows[0].count || 0 });
  } catch (error) {
    console.error('Get message unread count error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.get('/:conversationId', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const [conversations] = await req.app.locals.pool.execute(
      'SELECT id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [conversationId, req.user.id, req.user.id]
    );
    if (conversations.length === 0) {
      return res.status(404).json({ code: 1004, message: '会话不存在' });
    }

    const [rows] = await req.app.locals.pool.execute(
      `SELECT * FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC
       LIMIT ? OFFSET ?`,
      [conversationId, pageSize, offset]
    );

    return res.json({
      code: 0,
      data: rows.map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        content: row.content,
        type: row.type,
        isRead: !!row.is_read,
        createdAt: row.created_at,
      })),
      hasMore: rows.length === pageSize,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.post('/:conversationId', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, type = 'text' } = req.body;

    if (!content || !String(content).trim()) {
      return res.status(400).json({ code: 1001, message: '消息内容不能为空' });
    }

    const [conversations] = await req.app.locals.pool.execute(
      'SELECT id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [conversationId, req.user.id, req.user.id]
    );
    if (conversations.length === 0) {
      return res.status(404).json({ code: 1004, message: '会话不存在' });
    }

    const messageId = uuidv4();
    await req.app.locals.pool.execute(
      'INSERT INTO messages (id, conversation_id, sender_id, content, type, is_read) VALUES (?, ?, ?, ?, ?, FALSE)',
      [messageId, conversationId, req.user.id, String(content).trim(), type]
    );
    await req.app.locals.pool.execute(
      'UPDATE conversations SET last_message = ?, last_message_type = ?, last_message_at = NOW() WHERE id = ?',
      [String(content).trim(), type, conversationId]
    );

    return res.status(201).json({
      code: 0,
      data: {
        id: messageId,
        conversationId,
        senderId: req.user.id,
        content: String(content).trim(),
        type,
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.post('/:conversationId/read', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;

    await req.app.locals.pool.execute(
      `UPDATE messages m
       JOIN conversations c ON m.conversation_id = c.id
       SET m.is_read = TRUE
       WHERE m.conversation_id = ?
         AND m.sender_id != ?
         AND (c.user1_id = ? OR c.user2_id = ?)`,
      [conversationId, req.user.id, req.user.id, req.user.id]
    );

    return res.json({ code: 0, message: '已标记已读' });
  } catch (error) {
    console.error('Mark conversation read error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

module.exports = router;
