const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { awardPoints } = require('./points');

const router = express.Router();

/**
 * Helper: format comment from DB row
 */
function formatComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    parentId: row.parent_id || undefined,
    replyToUserId: row.reply_to_user_id || undefined,
    content: row.content,
    likeCount: row.likes_count,
    likesCount: row.likes_count,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Helper: enrich comment with user info and like status
 */
async function enrichComment(pool, comment, currentUserId) {
  // Get user info
  const [users] = await pool.execute(
    'SELECT id, nickname, avatar_url, level FROM users WHERE id = ?',
    [comment.userId]
  );
  if (users.length > 0) {
    comment.user = {
      id: users[0].id,
      nickname: users[0].nickname,
      avatarUrl: users[0].avatar_url,
      level: users[0].level,
    };
  }

  // Get reply-to user info
  if (comment.replyToUserId) {
    const [replyUsers] = await pool.execute(
      'SELECT id, nickname FROM users WHERE id = ?',
      [comment.replyToUserId]
    );
    if (replyUsers.length > 0) {
      comment.replyToUser = {
        id: replyUsers[0].id,
        nickname: replyUsers[0].nickname,
      };
    }
  }

  // Check like status
  if (currentUserId) {
    const [likes] = await pool.execute(
      'SELECT id FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?',
      [currentUserId, 'comment', comment.id]
    );
    comment.isLiked = likes.length > 0;
  } else {
    comment.isLiked = false;
  }

  comment.children = [];
  comment.replies = [];
  return comment;
}

/**
 * GET /api/posts/:postId/comments
 * Get comments for a post with nested replies
 */
router.get('/posts/:postId/comments', optionalAuth, async (req, res) => {
  try {
    const postId = req.params.postId;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const sort = req.query.sort || 'latest';
    const offset = (page - 1) * limit;

    // Check post exists
    const [posts] = await req.app.locals.pool.execute(
      "SELECT id FROM posts WHERE id = ? AND status = 'published'",
      [postId]
    );
    if (posts.length === 0) {
      return res.status(404).json({ code: 1004, message: '帖子不存在' });
    }

    // Count top-level comments
    const [countRows] = await req.app.locals.pool.execute(
      "SELECT COUNT(*) as total FROM comments WHERE post_id = ? AND parent_id IS NULL AND status = 'visible'",
      [postId]
    );
    const total = countRows[0].total;

    // Order
    const orderSQL = sort === 'oldest' ? 'ASC' : 'DESC';

    // Fetch top-level comments
    const [topLevel] = await req.app.locals.pool.query(
      `SELECT * FROM comments
       WHERE post_id = ? AND parent_id IS NULL AND status = 'visible'
       ORDER BY created_at ${orderSQL}
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      [postId]
    );

    const data = [];
    for (const row of topLevel) {
      const comment = formatComment(row);
      await enrichComment(req.app.locals.pool, comment, req.user?.id);

      // Fetch child comments (replies)
      const [children] = await req.app.locals.pool.execute(
        `SELECT * FROM comments
         WHERE post_id = ? AND parent_id = ? AND status = 'visible'
         ORDER BY created_at ASC`,
        [postId, comment.id]
      );

      for (const childRow of children) {
        const child = formatComment(childRow);
        await enrichComment(req.app.locals.pool, child, req.user?.id);
        comment.children.push(child);
        comment.replies.push(child);
      }

      comment.replyCount = comment.children.length;
      data.push(comment);
    }

    return res.json({
      code: 0,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get comments error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * POST /api/posts/:postId/comments
 * Create a comment on a post
 */
router.post('/posts/:postId/comments', authMiddleware, async (req, res) => {
  try {
    const postId = req.params.postId;
    const { content, parentId } = req.body;

    // Validation
    if (!content || content.length < 1 || content.length > 500) {
      return res.status(400).json({ code: 1001, message: '评论内容为1-500字符' });
    }

    // Check post exists
    const [posts] = await req.app.locals.pool.execute(
      "SELECT id FROM posts WHERE id = ? AND status = 'published'",
      [postId]
    );
    if (posts.length === 0) {
      return res.status(404).json({ code: 1004, message: '帖子不存在' });
    }

    // Validate parent comment if replying
    if (parentId) {
      const [parents] = await req.app.locals.pool.execute(
        "SELECT id FROM comments WHERE id = ? AND post_id = ? AND status = 'visible'",
        [parentId, postId]
      );
      if (parents.length === 0) {
        return res.status(404).json({ code: 1004, message: '父评论不存在' });
      }
    }

    const commentId = uuidv4();
    await req.app.locals.pool.execute(
      `INSERT INTO comments (id, post_id, user_id, parent_id, content, likes_count, status)
       VALUES (?, ?, ?, ?, ?, 0, 'visible')`,
      [commentId, postId, req.user.id, parentId || null, content]
    );

    // Update post comments count
    const [postStats] = await req.app.locals.pool.execute(
      'SELECT stats FROM posts WHERE id = ?',
      [postId]
    );
    const stats = typeof postStats[0].stats === 'string' ? JSON.parse(postStats[0].stats) : postStats[0].stats;
    stats.commentsCount = (stats.commentsCount || 0) + 1;
    await req.app.locals.pool.execute(
      'UPDATE posts SET stats = ? WHERE id = ?',
      [JSON.stringify(stats), postId]
    );

    // Award points for commenting
    await awardPoints(req.app.locals.pool, req.user.id, 2, 'comment', '发表评论', commentId);

    // Fetch and return
    const [rows] = await req.app.locals.pool.execute(
      'SELECT * FROM comments WHERE id = ?',
      [commentId]
    );

    const comment = formatComment(rows[0]);
    await enrichComment(req.app.locals.pool, comment, req.user.id);

    return res.status(201).json({ code: 0, data: comment });
  } catch (error) {
    console.error('Create comment error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * DELETE /api/comments/:id
 * Delete a comment (soft delete, comment author or post author)
 */
router.delete('/comments/:id', authMiddleware, async (req, res) => {
  try {
    const commentId = req.params.id;

    const [comments] = await req.app.locals.pool.execute(
      'SELECT * FROM comments WHERE id = ? AND status != ?',
      [commentId, 'deleted']
    );

    if (comments.length === 0) {
      return res.status(404).json({ code: 1004, message: '评论不存在' });
    }

    const comment = comments[0];

    // Check permission: comment author or post author
    const [posts] = await req.app.locals.pool.execute(
      'SELECT user_id FROM posts WHERE id = ?',
      [comment.post_id]
    );
    const isCommentAuthor = comment.user_id === req.user.id;
    const isPostAuthor = posts.length > 0 && posts[0].user_id === req.user.id;

    if (!isCommentAuthor && !isPostAuthor) {
      return res.status(403).json({ code: 1003, message: '无权限删除此评论' });
    }

    // Soft delete
    await req.app.locals.pool.execute(
      "UPDATE comments SET status = 'deleted' WHERE id = ?",
      [commentId]
    );

    // Update post comments count
    const [postStats] = await req.app.locals.pool.execute(
      'SELECT stats FROM posts WHERE id = ?',
      [comment.post_id]
    );
    const stats = typeof postStats[0].stats === 'string' ? JSON.parse(postStats[0].stats) : postStats[0].stats;
    stats.commentsCount = Math.max(0, (stats.commentsCount || 0) - 1);
    await req.app.locals.pool.execute(
      'UPDATE posts SET stats = ? WHERE id = ?',
      [JSON.stringify(stats), comment.post_id]
    );

    return res.json({ code: 0, message: '评论已删除' });
  } catch (error) {
    console.error('Delete comment error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * POST /api/comments/:id/like
 * Toggle like on a comment
 */
router.post('/comments/:id/like', authMiddleware, async (req, res) => {
  try {
    const commentId = req.params.id;

    // Check comment exists
    const [comments] = await req.app.locals.pool.execute(
      "SELECT id, likes_count FROM comments WHERE id = ? AND status = 'visible'",
      [commentId]
    );
    if (comments.length === 0) {
      return res.status(404).json({ code: 1004, message: '评论不存在' });
    }

    let likesCount = comments[0].likes_count;

    // Check existing like
    const [existing] = await req.app.locals.pool.execute(
      'SELECT id FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?',
      [req.user.id, 'comment', commentId]
    );

    if (existing.length > 0) {
      // Unlike
      await req.app.locals.pool.execute(
        'DELETE FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?',
        [req.user.id, 'comment', commentId]
      );
      likesCount = Math.max(0, likesCount - 1);
      await req.app.locals.pool.execute(
        'UPDATE comments SET likes_count = ? WHERE id = ?',
        [likesCount, commentId]
      );
      return res.json({ code: 0, data: { liked: false, isLiked: false, likesCount, likeCount: likesCount } });
    }

    // Like
    const likeId = uuidv4();
    await req.app.locals.pool.execute(
      'INSERT INTO likes (id, user_id, target_type, target_id) VALUES (?, ?, ?, ?)',
      [likeId, req.user.id, 'comment', commentId]
    );
    likesCount += 1;
    await req.app.locals.pool.execute(
      'UPDATE comments SET likes_count = ? WHERE id = ?',
      [likesCount, commentId]
    );

    return res.json({ code: 0, data: { liked: true, isLiked: true, likesCount, likeCount: likesCount } });
  } catch (error) {
    console.error('Toggle comment like error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

module.exports = router;
