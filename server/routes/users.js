const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 jpg/png/webp 格式'));
    }
  },
});

function ensureJsonObject(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

async function getUserCounts(pool, userId) {
  const [[followers], [following], [posts]] = await Promise.all([
    pool.execute('SELECT COUNT(*) AS total FROM follows WHERE following_id = ?', [userId]),
    pool.execute('SELECT COUNT(*) AS total FROM follows WHERE follower_id = ?', [userId]),
    pool.execute("SELECT COUNT(*) AS total FROM posts WHERE user_id = ? AND status = 'published'", [userId]),
  ]);

  return {
    followersCount: followers[0]?.total || 0,
    followingCount: following[0]?.total || 0,
    postsCount: posts[0]?.total || 0,
  };
}

/**
 * Helper: convert DB row to user profile (public)
 */
function toUserProfile(row, counts = {}) {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    gender: row.gender || 'unknown',
    birthday: row.birthday || null,
    city: row.city || null,
    level: row.level,
    points: row.points,
    followersCount: counts.followersCount ?? row.followers_count ?? 0,
    followingCount: counts.followingCount ?? row.following_count ?? 0,
    postsCount: counts.postsCount ?? row.posts_count ?? 0,
    createdAt: row.created_at,
  };
}

/**
 * Helper: convert DB row to current user info (includes private fields)
 */
function toCurrentUser(row, counts = {}) {
  return {
    ...toUserProfile(row, counts),
    phone: row.phone,
    email: row.email,
    preferences: ensureJsonObject(row.preferences, {
      notifications: true,
      darkMode: false,
      autoPlayVideo: true,
      language: 'zh-CN',
    }),
    lastLoginAt: row.last_login_at,
  };
}

/**
 * GET /api/users/me
 * Get current authenticated user info
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [users] = await req.app.locals.pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ code: 1004, message: '用户不存在' });
    }

    const counts = await getUserCounts(req.app.locals.pool, req.user.id);
    return res.json({ code: 0, data: toCurrentUser(users[0], counts) });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * GET /api/users/:id
 * Get a user's public profile
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const userId = req.params.id;

    const [users] = await req.app.locals.pool.execute(
      'SELECT * FROM users WHERE id = ? AND status != ?',
      [userId, 'banned']
    );

    if (users.length === 0) {
      return res.status(404).json({ code: 1004, message: '用户不存在' });
    }

    const counts = await getUserCounts(req.app.locals.pool, userId);
    const profile = toUserProfile(users[0], counts);

    // If authenticated, add follow status
    if (req.user && req.user.id !== userId) {
      const [following] = await req.app.locals.pool.execute(
        'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
        [req.user.id, userId]
      );
      const [followedBy] = await req.app.locals.pool.execute(
        'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
        [userId, req.user.id]
      );
      profile.isFollowing = following.length > 0;
      profile.isFollowedBy = followedBy.length > 0;
    } else {
      profile.isFollowing = false;
      profile.isFollowedBy = false;
    }

    return res.json({ code: 0, data: profile });
  } catch (error) {
    console.error('Get user profile error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.get('/:id/posts', optionalAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const offset = (page - 1) * pageSize;

    const [countRows] = await req.app.locals.pool.execute(
      "SELECT COUNT(*) AS total FROM posts WHERE user_id = ? AND status = 'published'",
      [userId]
    );
    const total = countRows[0]?.total || 0;

    const [rows] = await req.app.locals.pool.query(
      `SELECT p.*, u.nickname, u.avatar_url, u.level
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = ? AND p.status = 'published'
       ORDER BY p.created_at DESC
       LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`,
      [userId]
    );

    const data = rows.map((row) => {
      const stats = typeof row.stats === 'string' ? JSON.parse(row.stats) : (row.stats || {});
      return {
        id: row.id,
        user: {
          id: row.user_id,
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
        circleId: null,
        likeCount: stats.likesCount || 0,
        commentCount: stats.commentsCount || 0,
        bookmarkCount: 0,
        isLiked: false,
        isBookmarked: false,
        status: row.status,
        createdAt: row.created_at,
      };
    });

    return res.json({
      code: 0,
      data,
      pagination: {
        page,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * PUT /api/users/me
 * Update current user profile
 */
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { nickname, avatarUrl, bio, gender, birthday, city } = req.body;
    const updates = [];
    const params = [];

    if (nickname !== undefined) {
      if (nickname.length < 1 || nickname.length > 20) {
        return res.status(400).json({ code: 1001, message: '昵称长度为1-20位' });
      }
      updates.push('nickname = ?');
      params.push(nickname);
    }
    if (avatarUrl !== undefined) {
      updates.push('avatar_url = ?');
      params.push(avatarUrl);
    }
    if (bio !== undefined) {
      if (bio.length > 200) {
        return res.status(400).json({ code: 1001, message: '个人简介最多200字' });
      }
      updates.push('bio = ?');
      params.push(bio);
    }
    if (gender !== undefined) {
      if (!['male', 'female', 'unknown'].includes(gender)) {
        return res.status(400).json({ code: 1001, message: '性别值无效' });
      }
      updates.push('gender = ?');
      params.push(gender);
    }
    if (birthday !== undefined) {
      updates.push('birthday = ?');
      params.push(birthday || null);
    }
    if (city !== undefined) {
      updates.push('city = ?');
      params.push(city || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ code: 1001, message: '没有需要更新的字段' });
    }

    params.push(req.user.id);
    await req.app.locals.pool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Return updated user
    const [users] = await req.app.locals.pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [req.user.id]
    );

    const counts = await getUserCounts(req.app.locals.pool, req.user.id);
    return res.json({ code: 0, data: toCurrentUser(users[0], counts) });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * PATCH /api/users/me/preferences
 * Update user preferences
 */
router.patch('/me/preferences', authMiddleware, async (req, res) => {
  try {
    const { notifications, darkMode, autoPlayVideo, language } = req.body;

    // Get current preferences
    const [users] = await req.app.locals.pool.execute(
      'SELECT preferences FROM users WHERE id = ?',
      [req.user.id]
    );

    const currentPrefs = users[0]?.preferences || {
      notifications: true,
      darkMode: false,
      autoPlayVideo: true,
      language: 'zh-CN',
    };

    const newPrefs = {
      ...currentPrefs,
      ...(notifications !== undefined && { notifications }),
      ...(darkMode !== undefined && { darkMode }),
      ...(autoPlayVideo !== undefined && { autoPlayVideo }),
      ...(language !== undefined && { language }),
    };

    await req.app.locals.pool.execute(
      'UPDATE users SET preferences = ? WHERE id = ?',
      [JSON.stringify(newPrefs), req.user.id]
    );

    return res.json({ code: 0, data: newPrefs });
  } catch (error) {
    console.error('Update preferences error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * POST /api/users/me/avatar
 * Upload avatar image
 */
router.post('/me/avatar', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 1001, message: '请选择图片文件' });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;

    await req.app.locals.pool.execute(
      'UPDATE users SET avatar_url = ? WHERE id = ?',
      [avatarUrl, req.user.id]
    );

    return res.json({ code: 0, data: { avatarUrl } });
  } catch (error) {
    console.error('Upload avatar error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.post('/upload/image', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 1001, message: '请选择图片文件' });
    }

    const url = `/uploads/${req.file.filename}`;
    return res.json({ code: 0, data: { url } });
  } catch (error) {
    console.error('Upload image error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * PUT /api/users/me/password
 * Change password
 */
router.put('/me/password', authMiddleware, async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ code: 1001, message: '旧密码和新密码为必填项' });
    }

    if (newPassword.length < 6 || newPassword.length > 32) {
      return res.status(400).json({ code: 1001, message: '新密码需为6-32位' });
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ code: 1001, message: '新密码需至少包含字母和数字' });
    }

    // Get current password hash
    const [users] = await req.app.locals.pool.execute(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    const isValid = await bcrypt.compare(oldPassword, users[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ code: 2003, message: '旧密码不正确' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await req.app.locals.pool.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newHash, req.user.id]
    );

    // Invalidate all refresh tokens for this user
    await req.app.locals.pool.execute(
      'DELETE FROM refresh_tokens WHERE user_id = ?',
      [req.user.id]
    );

    return res.json({ code: 0, message: '密码修改成功' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * POST /api/users/:id/follow
 * Follow a user
 */
router.post('/:id/follow', authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.id;

    if (targetId === req.user.id) {
      return res.status(400).json({ code: 1001, message: '不能关注自己' });
    }

    // Check target exists
    const [targets] = await req.app.locals.pool.execute(
      'SELECT id FROM users WHERE id = ? AND status != ?',
      [targetId, 'banned']
    );
    if (targets.length === 0) {
      return res.status(404).json({ code: 1004, message: '用户不存在' });
    }

    // Check if already following
    const [existing] = await req.app.locals.pool.execute(
      'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
      [req.user.id, targetId]
    );

    if (existing.length > 0) {
      // Already following, unfollow
      await req.app.locals.pool.execute(
        'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
        [req.user.id, targetId]
      );
      const [updated] = await req.app.locals.pool.execute(
        'SELECT COUNT(*) AS total FROM follows WHERE following_id = ?',
        [targetId]
      );

      return res.json({
        code: 0,
        data: { isFollowing: false, followersCount: updated[0].total || 0 },
      });
    }

    // Create follow
    const followId = uuidv4();
    await req.app.locals.pool.execute(
      'INSERT INTO follows (id, follower_id, following_id) VALUES (?, ?, ?)',
      [followId, req.user.id, targetId]
    );
    const [updated] = await req.app.locals.pool.execute(
      'SELECT COUNT(*) AS total FROM follows WHERE following_id = ?',
      [targetId]
    );

    return res.json({
      code: 0,
      data: { isFollowing: true, followersCount: updated[0].total || 0 },
    });
  } catch (error) {
    console.error('Follow user error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * DELETE /api/users/:id/follow
 * Unfollow a user
 */
router.delete('/:id/follow', authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.id;

    const [existing] = await req.app.locals.pool.execute(
      'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
      [req.user.id, targetId]
    );

    if (existing.length === 0) {
      return res.json({ code: 0, data: { isFollowing: false, followersCount: 0 } });
    }

    await req.app.locals.pool.execute(
      'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
      [req.user.id, targetId]
    );
    const [updated] = await req.app.locals.pool.execute(
      'SELECT COUNT(*) AS total FROM follows WHERE following_id = ?',
      [targetId]
    );

    return res.json({
      code: 0,
      data: { isFollowing: false, followersCount: updated[0].total || 0 },
    });
  } catch (error) {
    console.error('Unfollow user error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * GET /api/users/:id/follow-status
 * Get follow status between current user and target
 */
router.get('/:id/follow-status', authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.id;

    const [following] = await req.app.locals.pool.execute(
      'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
      [req.user.id, targetId]
    );
    const [followedBy] = await req.app.locals.pool.execute(
      'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
      [targetId, req.user.id]
    );

    return res.json({
      code: 0,
      data: {
        isFollowing: following.length > 0,
        isFollowedBy: followedBy.length > 0,
        isMutual: following.length > 0 && followedBy.length > 0,
      },
    });
  } catch (error) {
    console.error('Get follow status error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * GET /api/users/:id/followers
 * Get followers list
 */
router.get('/:id/followers', optionalAuth, async (req, res) => {
  try {
    const targetId = req.params.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    // Get total count
    const [countRows] = await req.app.locals.pool.execute(
      'SELECT COUNT(*) as total FROM follows WHERE following_id = ?',
      [targetId]
    );
    const total = countRows[0].total;

    // Get followers
    const [followers] = await req.app.locals.pool.query(
      `SELECT u.id, u.nickname, u.avatar_url, u.bio, u.level
       FROM follows f
       JOIN users u ON f.follower_id = u.id
       WHERE f.following_id = ?
       ORDER BY f.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      [targetId]
    );

    // Add follow status if authenticated
    const data = [];
    for (const f of followers) {
      const item = {
        id: f.id,
        nickname: f.nickname,
        avatarUrl: f.avatar_url,
        bio: f.bio,
        level: f.level,
        isFollowing: false,
      };
      if (req.user && req.user.id !== f.id) {
        const [check] = await req.app.locals.pool.execute(
          'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
          [req.user.id, f.id]
        );
        item.isFollowing = check.length > 0;
      }
      data.push(item);
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
    console.error('Get followers error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * GET /api/users/:id/following
 * Get following list
 */
router.get('/:id/following', optionalAuth, async (req, res) => {
  try {
    const targetId = req.params.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [countRows] = await req.app.locals.pool.execute(
      'SELECT COUNT(*) as total FROM follows WHERE follower_id = ?',
      [targetId]
    );
    const total = countRows[0].total;

    const [following] = await req.app.locals.pool.query(
      `SELECT u.id, u.nickname, u.avatar_url, u.bio, u.level
       FROM follows f
       JOIN users u ON f.following_id = u.id
       WHERE f.follower_id = ?
       ORDER BY f.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      [targetId]
    );

    const data = [];
    for (const f of following) {
      const item = {
        id: f.id,
        nickname: f.nickname,
        avatarUrl: f.avatar_url,
        bio: f.bio,
        level: f.level,
        isFollowing: false,
      };
      if (req.user && req.user.id !== f.id) {
        const [check] = await req.app.locals.pool.execute(
          'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
          [req.user.id, f.id]
        );
        item.isFollowing = check.length > 0;
      }
      data.push(item);
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
    console.error('Get following error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

module.exports = router;
