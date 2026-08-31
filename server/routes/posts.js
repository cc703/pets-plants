const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { awardPoints, POINTS_RULES } = require('./points');
const { createNotification } = require('../utils/notifications');

const router = express.Router();

/**
 * Helper: format post from DB row
 */
function formatPost(row) {
  const stats = typeof row.stats === 'string' ? JSON.parse(row.stats) : (row.stats || { likesCount: 0, commentsCount: 0, viewsCount: 0 });
  return {
    id: row.id,
    userId: row.user_id,
    breedId: row.breed_id,
    circleId: row.circle_id || null,
    title: row.title,
    content: row.content,
    images: typeof row.images === 'string' ? JSON.parse(row.images) : (row.images || []),
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
    stats,
    likeCount: stats.likesCount || 0,
    commentCount: stats.commentsCount || 0,
    bookmarkCount: row.bookmark_count || 0,
    isPinned: !!row.is_pinned,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Helper: attach user info and interaction status to post
 */
async function enrichPost(pool, post, currentUserId) {
  // Get user info
  const [users] = await pool.execute(
    'SELECT id, nickname, avatar_url, level FROM users WHERE id = ?',
    [post.userId]
  );
  if (users.length > 0) {
    post.user = {
      id: users[0].id,
      nickname: users[0].nickname,
      avatarUrl: users[0].avatar_url,
      level: users[0].level,
    };
  }

  // Get breed info if present
  if (post.breedId) {
    const [breeds] = await pool.execute(
      'SELECT id, name FROM breeds WHERE id = ?',
      [post.breedId]
    );
    if (breeds.length > 0) {
      post.breed = { id: breeds[0].id, name: breeds[0].name };
    }
  }

  // Check like/bookmark status if authenticated
  if (currentUserId) {
    const [likes] = await pool.execute(
      'SELECT id FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?',
      [currentUserId, 'post', post.id]
    );
    post.isLiked = likes.length > 0;

    const [bookmarks] = await pool.execute(
      'SELECT id FROM bookmarks WHERE user_id = ? AND post_id = ?',
      [currentUserId, post.id]
    );
    post.isBookmarked = bookmarks.length > 0;
  } else {
    post.isLiked = false;
    post.isBookmarked = false;
  }

  return post;
}

/**
 * GET /api/posts
 * Get post list with pagination and filters
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const sort = req.query.sort || 'hot';
    const { breedId, tag, userId, circleId } = req.query;

    let whereClauses = ["p.status = 'published'"];
    const params = [];

    if (breedId) {
      whereClauses.push('p.breed_id = ?');
      params.push(breedId);
    }
    if (userId) {
      whereClauses.push('p.user_id = ?');
      params.push(userId);
    }
    if (circleId) {
      whereClauses.push('p.circle_id = ?');
      params.push(circleId);
    }
    if (tag) {
      whereClauses.push('JSON_CONTAINS(p.tags, ?)');
      params.push(JSON.stringify(tag));
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // Count total
    const [countRows] = await req.app.locals.pool.execute(
      `SELECT COUNT(*) as total FROM posts p ${whereSQL}`,
      params
    );
    const total = countRows[0].total;

    // Order by
    let orderSQL;
    if (sort === 'latest') {
      orderSQL = 'ORDER BY p.is_pinned DESC, p.created_at DESC';
    } else {
      // hot: by likes count (in stats JSON)
      orderSQL = 'ORDER BY p.is_pinned DESC, JSON_EXTRACT(p.stats, "$.likesCount") DESC, p.created_at DESC';
    }

    // Fetch posts
    const [rows] = await req.app.locals.pool.query(
      `SELECT p.*,
              (
                SELECT COUNT(*)
                FROM bookmarks b
                WHERE b.post_id = p.id
              ) AS bookmark_count
       FROM posts p ${whereSQL} ${orderSQL} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    const data = [];
    for (const row of rows) {
      const post = formatPost(row);
      await enrichPost(req.app.locals.pool, post, req.user?.id);
      data.push(post);
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
    console.error('Get posts error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * GET /api/posts/:id
 * Get post detail
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const [rows] = await req.app.locals.pool.execute(
      `SELECT p.*,
              (
                SELECT COUNT(*)
                FROM bookmarks b
                WHERE b.post_id = p.id
              ) AS bookmark_count
       FROM posts p
       WHERE p.id = ? AND p.status != ?`,
      [req.params.id, 'deleted']
    );

    if (rows.length === 0) {
      return res.status(404).json({ code: 1004, message: '帖子不存在' });
    }

    const post = formatPost(rows[0]);

    // Increment view count
    const stats = post.stats;
    stats.viewsCount = (stats.viewsCount || 0) + 1;
    await req.app.locals.pool.execute(
      'UPDATE posts SET stats = ? WHERE id = ?',
      [JSON.stringify(stats), post.id]
    );
    post.stats = stats;

    await enrichPost(req.app.locals.pool, post, req.user?.id);

    return res.json({ code: 0, data: post });
  } catch (error) {
    console.error('Get post detail error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * POST /api/posts
 * Create a new post
 */
router.post('/', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { content, title, images, tags, breedId, circleId } = req.body;

    // Validation
    if (!content || content.length < 1 || content.length > 5000) {
      return res.status(400).json({ code: 1001, message: '帖子内容为1-5000字符' });
    }
    if (title && title.length > 200) {
      return res.status(400).json({ code: 1001, message: '标题最多200字符' });
    }
    if (images && images.length > 9) {
      return res.status(400).json({ code: 1001, message: '最多上传9张图片' });
    }
    if (tags && tags.length > 10) {
      return res.status(400).json({ code: 1001, message: '最多10个标签' });
    }
    if (tags) {
      for (const tag of tags) {
        if (tag.length > 20) {
          return res.status(400).json({ code: 1001, message: '每个标签最多20字符' });
        }
      }
    }

    const postId = uuidv4();
    const stats = JSON.stringify({ likesCount: 0, commentsCount: 0, viewsCount: 0 });
    let finalTags = Array.isArray(tags) ? [...tags] : [];
    let matchedCircleId = null;
    connection = await req.app.locals.pool.getConnection();
    await connection.beginTransaction();

    if (circleId) {
      const [circleRows] = await connection.execute(
        'SELECT id FROM circles WHERE id = ? AND status = ?',
        [circleId, 'active']
      );
      if (circleRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ code: 1004, message: '圈子不存在' });
      }
      matchedCircleId = circleId;
    }

    await connection.execute(
      `INSERT INTO posts (id, user_id, breed_id, circle_id, title, content, images, tags, stats, is_pinned, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, 'published')`,
      [
        postId,
        req.user.id,
        breedId || null,
        matchedCircleId,
        title || null,
        content,
        JSON.stringify(images || []),
        JSON.stringify(finalTags),
        stats,
      ]
    );

    if (matchedCircleId) {
      await connection.execute(
        'UPDATE circles SET post_count = post_count + 1 WHERE id = ?',
        [matchedCircleId]
      );
    }

    await awardPoints(connection, req.user.id, POINTS_RULES.post_create, 'post', '发布帖子', postId);
    await connection.commit();

    // Fetch and return the created post
    const [rows] = await req.app.locals.pool.execute(
      `SELECT p.*,
              (
                SELECT COUNT(*)
                FROM bookmarks b
                WHERE b.post_id = p.id
              ) AS bookmark_count
       FROM posts p
       WHERE p.id = ?`,
      [postId]
    );

    const post = formatPost(rows[0]);
    await enrichPost(req.app.locals.pool, post, req.user.id);

    return res.status(201).json({ code: 0, data: post });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Create post error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  } finally {
    connection?.release();
  }
});

/**
 * PUT /api/posts/:id
 * Update a post (owner only)
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const postId = req.params.id;
    const { content, title, images, tags, breedId } = req.body;

    // Check post exists and is owned by user
    const [existing] = await req.app.locals.pool.execute(
      'SELECT user_id, status, tags FROM posts WHERE id = ?',
      [postId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ code: 1004, message: '帖子不存在' });
    }
    if (existing[0].user_id !== req.user.id) {
      return res.status(403).json({ code: 1003, message: '无权限修改此帖子' });
    }
    if (existing[0].status === 'deleted') {
      return res.status(404).json({ code: 1004, message: '帖子不存在' });
    }

    // Build update
    const updates = [];
    const params = [];

    if (content !== undefined) {
      if (content.length < 1 || content.length > 5000) {
        return res.status(400).json({ code: 1001, message: '帖子内容为1-5000字符' });
      }
      updates.push('content = ?');
      params.push(content);
    }
    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title || null);
    }
    if (images !== undefined) {
      if (images.length > 9) {
        return res.status(400).json({ code: 1001, message: '最多上传9张图片' });
      }
      updates.push('images = ?');
      params.push(JSON.stringify(images));
    }
    if (tags !== undefined) {
      if (tags.length > 10) {
        return res.status(400).json({ code: 1001, message: '最多10个标签' });
      }
      updates.push('tags = ?');
      params.push(JSON.stringify(tags));
    }
    if (breedId !== undefined) {
      updates.push('breed_id = ?');
      params.push(breedId || null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ code: 1001, message: '没有需要更新的字段' });
    }

    params.push(postId);
    await req.app.locals.pool.execute(
      `UPDATE posts SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const [rows] = await req.app.locals.pool.execute(
      `SELECT p.*,
              (
                SELECT COUNT(*)
                FROM bookmarks b
                WHERE b.post_id = p.id
              ) AS bookmark_count
       FROM posts p
       WHERE p.id = ?`,
      [postId]
    );

    const post = formatPost(rows[0]);
    await enrichPost(req.app.locals.pool, post, req.user.id);

    return res.json({ code: 0, data: post });
  } catch (error) {
    console.error('Update post error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * DELETE /api/posts/:id
 * Delete a post (soft delete, owner only)
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const postId = req.params.id;

    const [existing] = await req.app.locals.pool.execute(
      'SELECT user_id, circle_id, status FROM posts WHERE id = ?',
      [postId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ code: 1004, message: '帖子不存在' });
    }
    if (existing[0].user_id !== req.user.id) {
      return res.status(403).json({ code: 1003, message: '无权限删除此帖子' });
    }

    await req.app.locals.pool.execute(
      "UPDATE posts SET status = 'deleted' WHERE id = ?",
      [postId]
    );

    if (existing[0].circle_id) {
      await req.app.locals.pool.execute(
        'UPDATE circles SET post_count = GREATEST(post_count - 1, 0) WHERE id = ?',
        [existing[0].circle_id]
      );
    }

    return res.json({ code: 0, message: '帖子已删除' });
  } catch (error) {
    console.error('Delete post error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * POST /api/posts/:id/like
 * Toggle like on a post
 */
router.post('/:id/like', authMiddleware, async (req, res) => {
  let connection;
  try {
    const postId = req.params.id;
    connection = await req.app.locals.pool.getConnection();
    await connection.beginTransaction();

    const [posts] = await connection.execute(
      "SELECT id, user_id, stats FROM posts WHERE id = ? AND status = 'published' FOR UPDATE",
      [postId]
    );
    if (posts.length === 0) {
      await connection.rollback();
      return res.status(404).json({ code: 1004, message: '帖子不存在' });
    }

    const stats = typeof posts[0].stats === 'string' ? JSON.parse(posts[0].stats) : posts[0].stats;

    // Check existing like
    const [existing] = await connection.execute(
      'SELECT id FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?',
      [req.user.id, 'post', postId]
    );

    if (existing.length > 0) {
      // Unlike
      await connection.execute(
        'DELETE FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?',
        [req.user.id, 'post', postId]
      );
      stats.likesCount = Math.max(0, (stats.likesCount || 0) - 1);
      await connection.execute(
        'UPDATE posts SET stats = ? WHERE id = ?',
        [JSON.stringify(stats), postId]
      );

      await connection.commit();
      return res.json({ code: 0, data: { liked: false, isLiked: false, likesCount: stats.likesCount, likeCount: stats.likesCount } });
    }

    // Like
    const likeId = uuidv4();
    await connection.execute(
      'INSERT INTO likes (id, user_id, target_type, target_id) VALUES (?, ?, ?, ?)',
      [likeId, req.user.id, 'post', postId]
    );
    stats.likesCount = (stats.likesCount || 0) + 1;
    await connection.execute(
      'UPDATE posts SET stats = ? WHERE id = ?',
      [JSON.stringify(stats), postId]
    );
    await createNotification(connection, {
      userId: posts[0].user_id,
      fromUserId: req.user.id,
      type: 'like',
      targetType: 'post',
      targetId: postId,
      content: '赞了你的帖子',
    });
    await connection.commit();

    return res.json({ code: 0, data: { liked: true, isLiked: true, likesCount: stats.likesCount, likeCount: stats.likesCount } });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Toggle like error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  } finally {
    connection?.release();
  }
});

/**
 * POST /api/posts/:id/bookmark
 * Toggle bookmark on a post
 */
router.post('/:id/bookmark', authMiddleware, async (req, res) => {
  try {
    const postId = req.params.id;

    // Check post exists
    const [posts] = await req.app.locals.pool.execute(
      "SELECT id FROM posts WHERE id = ? AND status = 'published'",
      [postId]
    );
    if (posts.length === 0) {
      return res.status(404).json({ code: 1004, message: '帖子不存在' });
    }

    // Check existing bookmark
    const [existing] = await req.app.locals.pool.execute(
      'SELECT id FROM bookmarks WHERE user_id = ? AND post_id = ?',
      [req.user.id, postId]
    );

    if (existing.length > 0) {
      // Remove bookmark
      await req.app.locals.pool.execute(
        'DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?',
        [req.user.id, postId]
      );
      const [bookmarkCountRows] = await req.app.locals.pool.execute(
        'SELECT COUNT(*) AS total FROM bookmarks WHERE post_id = ?',
        [postId]
      );
      return res.json({ code: 0, data: { bookmarked: false, isBookmarked: false, bookmarkCount: bookmarkCountRows[0].total } });
    }

    // Add bookmark
    const bookmarkId = uuidv4();
    await req.app.locals.pool.execute(
      'INSERT INTO bookmarks (id, user_id, post_id) VALUES (?, ?, ?)',
      [bookmarkId, req.user.id, postId]
    );

    const [bookmarkCountRows] = await req.app.locals.pool.execute(
      'SELECT COUNT(*) AS total FROM bookmarks WHERE post_id = ?',
      [postId]
    );
    return res.json({ code: 0, data: { bookmarked: true, isBookmarked: true, bookmarkCount: bookmarkCountRows[0].total } });
  } catch (error) {
    console.error('Toggle bookmark error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

module.exports = router;
