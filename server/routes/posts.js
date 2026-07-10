const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { awardPoints } = require('./points');

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
    circleId: null,
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
    const { breedId, tag, userId } = req.query;

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

    if (circleId) {
      try {
        const [circleRows] = await req.app.locals.pool.execute(
          'SELECT name FROM circles WHERE id = ? AND status = ?',
          [circleId, 'active']
        );
        if (circleRows.length > 0) {
          matchedCircleId = circleId;
          if (!finalTags.includes(circleRows[0].name)) {
            finalTags.push(circleRows[0].name);
          }
        }
      } catch {
        // ignore optional circle enrichment when local schema is minimal
      }
    }

    await req.app.locals.pool.execute(
      `INSERT INTO posts (id, user_id, breed_id, title, content, images, tags, stats, is_pinned, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE, 'published')`,
      [
        postId,
        req.user.id,
        breedId || null,
        title || null,
        content,
        JSON.stringify(images || []),
        JSON.stringify(finalTags),
        stats,
      ]
    );

    if (matchedCircleId) {
      await req.app.locals.pool.execute(
        'UPDATE circles SET post_count = post_count + 1 WHERE id = ?',
        [matchedCircleId]
      );
    }

    // Update user posts count
    // Award points for creating a post
    await awardPoints(req.app.locals.pool, req.user.id, 5, 'post', '发布帖子', postId);

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
    console.error('Create post error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
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
      'SELECT user_id, status FROM posts WHERE id = ?',
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

    const existingTags = typeof existing[0].tags === 'string'
      ? JSON.parse(existing[0].tags)
      : (existing[0].tags || []);

    if (Array.isArray(existingTags) && existingTags.length > 0) {
      const [circles] = await req.app.locals.pool.query(
        'SELECT id, name FROM circles WHERE status = ?',
        ['active']
      );
      const matchedCircle = circles.find((circle) => existingTags.includes(circle.name));
      if (matchedCircle) {
        await req.app.locals.pool.execute(
          'UPDATE circles SET post_count = GREATEST(post_count - 1, 0) WHERE id = ?',
          [matchedCircle.id]
        );
      }
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
  try {
    const postId = req.params.id;

    // Check post exists
    const [posts] = await req.app.locals.pool.execute(
      "SELECT id, stats FROM posts WHERE id = ? AND status = 'published'",
      [postId]
    );
    if (posts.length === 0) {
      return res.status(404).json({ code: 1004, message: '帖子不存在' });
    }

    const stats = typeof posts[0].stats === 'string' ? JSON.parse(posts[0].stats) : posts[0].stats;

    // Check existing like
    const [existing] = await req.app.locals.pool.execute(
      'SELECT id FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?',
      [req.user.id, 'post', postId]
    );

    if (existing.length > 0) {
      // Unlike
      await req.app.locals.pool.execute(
        'DELETE FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?',
        [req.user.id, 'post', postId]
      );
      stats.likesCount = Math.max(0, (stats.likesCount || 0) - 1);
      await req.app.locals.pool.execute(
        'UPDATE posts SET stats = ? WHERE id = ?',
        [JSON.stringify(stats), postId]
      );

      return res.json({ code: 0, data: { liked: false, isLiked: false, likesCount: stats.likesCount, likeCount: stats.likesCount } });
    }

    // Like
    const likeId = uuidv4();
    await req.app.locals.pool.execute(
      'INSERT INTO likes (id, user_id, target_type, target_id) VALUES (?, ?, ?, ?)',
      [likeId, req.user.id, 'post', postId]
    );
    stats.likesCount = (stats.likesCount || 0) + 1;
    await req.app.locals.pool.execute(
      'UPDATE posts SET stats = ? WHERE id = ?',
      [JSON.stringify(stats), postId]
    );

    // Award points to post owner (not self-like)
    const [postOwner] = await req.app.locals.pool.execute(
      'SELECT user_id FROM posts WHERE id = ?',
      [postId]
    );
    if (postOwner.length > 0 && postOwner[0].user_id !== req.user.id) {
      await awardPoints(req.app.locals.pool, postOwner[0].user_id, 1, 'like_received', '收到点赞', postId);
    }

    return res.json({ code: 0, data: { liked: true, isLiked: true, likesCount: stats.likesCount, likeCount: stats.likesCount } });
  } catch (error) {
    console.error('Toggle like error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
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
