const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const {
  generateAccessToken,
  generateRefreshToken,
  JWT_REFRESH_SECRET,
  authMiddleware,
} = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rateLimit');
const jwt = require('jsonwebtoken');

const router = express.Router();
const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  keyPrefix: 'auth',
});

const SMS_CODE_TTL_MINUTES = 5;
const EMAIL_RESET_TTL_MINUTES = 15;
const SMS_TYPE_MAP = {
  register: 'register',
  login: 'login',
  reset: 'reset_password',
};

function buildUserDto(row) {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname || row.username,
    avatarUrl: row.avatar_url || null,
    phone: row.phone || null,
    email: row.email || null,
    bio: row.bio || '',
    level: row.level || 1,
    points: row.points || 0,
    createdAt: row.created_at,
  };
}

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', authRateLimit, async (req, res) => {
  try {
    const { username, password, nickname, phone, email } = req.body;

    // --- Validation ---
    if (!username || !password) {
      return res.status(400).json({ code: 1001, message: '用户名和密码为必填项' });
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ code: 1001, message: '用户名需为3-20位字母数字下划线' });
    }

    if (password.length < 6 || password.length > 32) {
      return res.status(400).json({ code: 1001, message: '密码需为6-32位' });
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ code: 1001, message: '密码需至少包含字母和数字' });
    }

    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ code: 1001, message: '手机号格式不正确' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ code: 1001, message: '邮箱格式不正确' });
    }

    // --- Check duplicates ---
    const [existingUsers] = await req.app.locals.pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existingUsers.length > 0) {
      return res.status(409).json({ code: 2001, message: '用户名已存在' });
    }

    if (phone) {
      const [existingPhone] = await req.app.locals.pool.execute(
        'SELECT id FROM users WHERE phone = ?',
        [phone]
      );
      if (existingPhone.length > 0) {
        return res.status(409).json({ code: 2002, message: '手机号已注册' });
      }
    }

    if (email) {
      const [existingEmail] = await req.app.locals.pool.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );
      if (existingEmail.length > 0) {
        return res.status(409).json({ code: 2006, message: '邮箱已注册' });
      }
    }

    // --- Create user ---
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    const finalNickname = nickname || username;

    await req.app.locals.pool.execute(
      `INSERT INTO users (id, username, password_hash, nickname, phone, email, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [userId, username, passwordHash, finalNickname, phone || null, email || null]
    );

    // --- Generate tokens ---
    const userPayload = { id: userId, username };
    const accessToken = generateAccessToken(userPayload);
    const refreshToken = generateRefreshToken(userPayload);

    // Store refresh token
    const refreshTokenId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await req.app.locals.pool.execute(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [refreshTokenId, userId, refreshToken, expiresAt]
    );

    // Update last login
    await req.app.locals.pool.execute(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [userId]
    );

    return res.status(201).json({
      code: 0,
      data: {
        user: {
          id: userId,
          username,
          nickname: finalNickname,
          level: 1,
          points: 0,
        },
        accessToken,
        refreshToken,
        expiresIn: 7200,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post('/login', authRateLimit, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ code: 1001, message: '用户名和密码为必填项' });
    }

    // Find user
    const [users] = await req.app.locals.pool.execute(
      'SELECT id, username, password_hash, nickname, avatar_url, level, points, status FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ code: 2003, message: '账号或密码错误' });
    }

    const user = users[0];

    // Check ban status
    if (user.status === 'banned') {
      return res.status(403).json({ code: 2005, message: '账号已被封禁' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ code: 2003, message: '账号或密码错误' });
    }

    // Generate tokens
    const userPayload = { id: user.id, username: user.username };
    const accessToken = generateAccessToken(userPayload);
    const refreshToken = generateRefreshToken(userPayload);

    // Store refresh token
    const refreshTokenId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await req.app.locals.pool.execute(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [refreshTokenId, user.id, refreshToken, expiresAt]
    );

    // Update last login
    await req.app.locals.pool.execute(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [user.id]
    );

    return res.json({
      code: 0,
      data: {
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          avatarUrl: user.avatar_url,
          level: user.level,
          points: user.points,
        },
        accessToken,
        refreshToken,
        expiresIn: 7200,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', authRateLimit, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ code: 1001, message: 'refreshToken 为必填项' });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ code: 2004, message: 'Token 已过期，请重新登录' });
    }

    // Check if token exists in DB
    const [tokens] = await req.app.locals.pool.execute(
      'SELECT id FROM refresh_tokens WHERE user_id = ? AND token = ? AND expires_at > NOW()',
      [decoded.id, refreshToken]
    );

    if (tokens.length === 0) {
      return res.status(401).json({ code: 2004, message: 'Token 已过期，请重新登录' });
    }

    // Get user info
    const [users] = await req.app.locals.pool.execute(
      'SELECT id, username, nickname, avatar_url, phone, email, bio, level, points, created_at FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({ code: 2004, message: '用户不存在' });
    }

    const user = users[0];

    // Delete old refresh token
    await req.app.locals.pool.execute(
      'DELETE FROM refresh_tokens WHERE user_id = ? AND token = ?',
      [decoded.id, refreshToken]
    );

    // Generate new tokens
    const userPayload = { id: user.id, username: user.username };
    const newAccessToken = generateAccessToken(userPayload);
    const newRefreshToken = generateRefreshToken(userPayload);

    // Store new refresh token
    const refreshTokenId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await req.app.locals.pool.execute(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [refreshTokenId, user.id, newRefreshToken, expiresAt]
    );

    return res.json({
      code: 0,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: buildUserDto(user),
        expiresIn: 7200,
      },
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/**
 * POST /api/auth/logout
 * Logout - invalidate refresh token
 */
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Delete refresh tokens for this user
    if (refreshToken) {
      await req.app.locals.pool.execute(
        'DELETE FROM refresh_tokens WHERE user_id = ? AND token = ?',
        [req.user.id, refreshToken]
      );
    } else {
      // Delete all refresh tokens for this user (logout from all devices)
      await req.app.locals.pool.execute(
        'DELETE FROM refresh_tokens WHERE user_id = ?',
        [req.user.id]
      );
    }

    return res.json({ code: 0, message: '已退出登录' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.post('/sms/send', authRateLimit, async (req, res) => {
  try {
    const { phone, type } = req.body;

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ code: 1001, message: '手机号格式不正确' });
    }

    if (!['login', 'register', 'reset'].includes(type)) {
      return res.status(400).json({ code: 1001, message: '验证码类型无效' });
    }

    const smsType = SMS_TYPE_MAP[type];
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeId = uuidv4();

    await req.app.locals.pool.execute(
      `UPDATE sms_codes
       SET is_used = TRUE
       WHERE phone = ? AND type = ? AND is_used = FALSE`,
      [phone, smsType]
    );

    await req.app.locals.pool.execute(
      `INSERT INTO sms_codes (id, phone, code, type, expires_at)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [codeId, phone, code, smsType, SMS_CODE_TTL_MINUTES]
    );

    const data = { expiresIn: SMS_CODE_TTL_MINUTES * 60 };
    if (process.env.NODE_ENV !== 'production') {
      data.debugCode = code;
    }

    return res.json({
      code: 0,
      data,
      message: '验证码已发送',
    });
  } catch (error) {
    console.error('Send sms code error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.post('/email/reset/send', authRateLimit, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ code: 1001, message: '邮箱格式不正确' });
    }

    const [users] = await req.app.locals.pool.execute(
      'SELECT id FROM users WHERE email = ? AND status = "active"',
      [email]
    );

    if (users.length === 0) {
      return res.json({
        code: 0,
        data: { expiresIn: EMAIL_RESET_TTL_MINUTES * 60 },
        message: '如果邮箱已注册，重置链接将发送到该邮箱',
      });
    }

    const user = users[0];
    const token = `${uuidv4()}${crypto.randomBytes(16).toString('hex')}`;
    const tokenHash = await bcrypt.hash(token, 10);
    const tokenId = uuidv4();

    await req.app.locals.pool.execute(
      `UPDATE email_reset_tokens
       SET is_used = TRUE, used_at = NOW()
       WHERE user_id = ? AND is_used = FALSE`,
      [user.id]
    );

    await req.app.locals.pool.execute(
      `INSERT INTO email_reset_tokens (id, user_id, email, token_hash, expires_at)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [tokenId, user.id, email, tokenHash, EMAIL_RESET_TTL_MINUTES]
    );

    const data = { expiresIn: EMAIL_RESET_TTL_MINUTES * 60 };
    if (process.env.NODE_ENV !== 'production') {
      data.debugToken = token;
    }

    return res.json({
      code: 0,
      data,
      message: '如果邮箱已注册，重置链接将发送到该邮箱',
    });
  } catch (error) {
    console.error('Send email reset token error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.post('/password/reset', authRateLimit, async (req, res) => {
  try {
    const { method, phone, email, smsCode, resetToken, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6 || newPassword.length > 32) {
      return res.status(400).json({ code: 1001, message: '新密码需为6-32位' });
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ code: 1001, message: '新密码需至少包含字母和数字' });
    }

    let userQuery = '';
    let userParam = '';

    if (method === 'phone') {
      if (!phone || !smsCode) {
        return res.status(400).json({ code: 1001, message: '手机号和验证码为必填项' });
      }
      const [codes] = await req.app.locals.pool.execute(
        `SELECT id FROM sms_codes
         WHERE phone = ?
           AND code = ?
           AND type = 'reset_password'
           AND is_used = FALSE
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [phone, smsCode]
      );
      if (codes.length === 0) {
        return res.status(400).json({ code: 1001, message: '验证码无效或已过期' });
      }
      userQuery = 'SELECT id FROM users WHERE phone = ?';
      userParam = phone;
    } else if (method === 'email') {
      if (!email || !resetToken) {
        return res.status(400).json({ code: 1001, message: '邮箱和重置Token为必填项' });
      }

      const [tokenRows] = await req.app.locals.pool.execute(
        `SELECT t.id, t.token_hash, t.user_id
         FROM email_reset_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.email = ?
           AND u.email = ?
           AND t.is_used = FALSE
           AND t.expires_at > NOW()
         ORDER BY t.created_at DESC
         LIMIT 5`,
        [email, email]
      );

      let matchedToken = null;
      for (const row of tokenRows) {
        if (await bcrypt.compare(resetToken, row.token_hash)) {
          matchedToken = row;
          break;
        }
      }

      if (!matchedToken) {
        return res.status(400).json({ code: 1001, message: '重置Token无效或已过期' });
      }

      userQuery = 'SELECT id FROM users WHERE id = ?';
      userParam = matchedToken.user_id;
      req.resetTokenId = matchedToken.id;
    } else {
      return res.status(400).json({ code: 1001, message: '重置方式无效' });
    }

    const [users] = await req.app.locals.pool.execute(userQuery, [userParam]);
    if (users.length === 0) {
      return res.status(404).json({ code: 1004, message: '用户不存在' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await req.app.locals.pool.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, users[0].id]
    );
    await req.app.locals.pool.execute(
      'DELETE FROM refresh_tokens WHERE user_id = ?',
      [users[0].id]
    );
    if (method === 'phone') {
      await req.app.locals.pool.execute(
        `UPDATE sms_codes
         SET is_used = TRUE
         WHERE phone = ? AND code = ? AND type = 'reset_password'`,
        [phone, smsCode]
      );
    } else if (method === 'email') {
      await req.app.locals.pool.execute(
        `UPDATE email_reset_tokens
         SET is_used = TRUE, used_at = NOW()
         WHERE id = ?`,
        [req.resetTokenId]
      );
    }

    return res.json({ code: 0, message: '密码重置成功' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

module.exports = router;
