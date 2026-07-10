const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ==================== 积分奖励规则 ====================
const POINTS_RULES = {
  check_in: { base: 10, streak_bonus: 5, max_streak_bonus: 50 },
  quiz_correct: 10,
  post_create: 5,
  comment_create: 2,
  like_received: 1,
};

// ==================== 辅助函数 ====================

/** 给用户加积分并记录流水 */
async function awardPoints(pool, userId, amount, type, description, relatedId = null) {
  const id = uuidv4();
  await pool.execute(
    'INSERT INTO points_history (id, user_id, amount, type, description, related_id) VALUES (?, ?, ?, ?, ?, ?)',
    [id, userId, amount, type, description, relatedId]
  );
  await pool.execute(
    'UPDATE users SET points = points + ? WHERE id = ?',
    [amount, userId]
  );
}

// ==================== 签到 ====================

/** GET /api/points/today - 查询今日签到状态 */
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await req.app.locals.pool.execute(
      'SELECT id, streak, points_earned FROM check_ins WHERE user_id = ? AND check_in_date = ?',
      [req.user.id, today]
    );

    if (rows.length > 0) {
      return res.json({
        code: 0,
        data: { checkedIn: true, streak: rows[0].streak, pointsEarned: rows[0].points_earned },
      });
    }

    // 查询最近一次签到，计算连续天数
    const [lastCheckIn] = await req.app.locals.pool.execute(
      'SELECT check_in_date, streak FROM check_ins WHERE user_id = ? ORDER BY check_in_date DESC LIMIT 1',
      [req.user.id]
    );

    let currentStreak = 0;
    if (lastCheckIn.length > 0) {
      const lastDate = new Date(lastCheckIn[0].check_in_date);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastDate.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
        currentStreak = lastCheckIn[0].streak;
      }
    }

    return res.json({
      code: 0,
      data: { checkedIn: false, streak: currentStreak, pointsEarned: 0 },
    });
  } catch (error) {
    console.error('Get today check-in error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/** POST /api/points/check-in - 每日签到 */
router.post('/check-in', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 检查是否已签到
    const [existing] = await req.app.locals.pool.execute(
      'SELECT id FROM check_ins WHERE user_id = ? AND check_in_date = ?',
      [req.user.id, today]
    );

    if (existing.length > 0) {
      return res.status(409).json({ code: 3001, message: '今日已签到' });
    }

    // 计算连续签到天数
    const [lastCheckIn] = await req.app.locals.pool.execute(
      'SELECT check_in_date, streak FROM check_ins WHERE user_id = ? ORDER BY check_in_date DESC LIMIT 1',
      [req.user.id]
    );

    let streak = 1;
    if (lastCheckIn.length > 0) {
      const lastDate = new Date(lastCheckIn[0].check_in_date);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastDate.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
        streak = lastCheckIn[0].streak + 1;
      }
    }

    // 计算积分：基础 + 连续签到奖励（上限50）
    const streakBonus = Math.min((streak - 1) * POINTS_RULES.check_in.streak_bonus, POINTS_RULES.check_in.max_streak_bonus);
    const totalPoints = POINTS_RULES.check_in.base + streakBonus;

    // 写入签到记录
    const checkInId = uuidv4();
    await req.app.locals.pool.execute(
      'INSERT INTO check_ins (id, user_id, check_in_date, streak, points_earned) VALUES (?, ?, ?, ?, ?)',
      [checkInId, req.user.id, today, streak, totalPoints]
    );

    // 加积分
    await awardPoints(req.app.locals.pool, req.user.id, totalPoints, 'check_in', `每日签到（连续${streak}天）`);

    return res.json({
      code: 0,
      data: { streak, pointsEarned: totalPoints, message: `签到成功！连续${streak}天，获得${totalPoints}积分` },
    });
  } catch (error) {
    console.error('Check-in error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

// ==================== 积分记录 ====================

/** GET /api/points/history - 积分流水记录 */
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [countRows] = await req.app.locals.pool.execute(
      'SELECT COUNT(*) as total FROM points_history WHERE user_id = ?',
      [req.user.id]
    );
    const total = countRows[0].total;

    const [rows] = await req.app.locals.pool.query(
      `SELECT * FROM points_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      [req.user.id]
    );

    const data = rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      type: r.type,
      description: r.description,
      relatedId: r.related_id,
      createdAt: r.created_at,
    }));

    return res.json({ code: 0, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Get points history error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

// ==================== 积分增加 ====================

/** POST /api/points/earn - 增加积分（答题、发帖等） */
router.post('/earn', authMiddleware, async (req, res) => {
  try {
    const { amount, type = 'reward', description = '', relatedId = null } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ code: 2001, message: '积分数量必须为正数' });
    }

    await awardPoints(req.app.locals.pool, req.user.id, Math.round(amount), type, description || `获得${amount}积分`, relatedId);

    return res.json({
      code: 0,
      data: { earned: amount, message: `成功获得${amount}积分` },
    });
  } catch (error) {
    console.error('Earn points error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/** POST /api/points/spend - 消费积分（兑换商品等） */
router.post('/spend', authMiddleware, async (req, res) => {
  try {
    const { amount, description = '', relatedId = null } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ code: 2001, message: '积分数量必须为正数' });
    }

    // 检查积分余额
    const [users] = await req.app.locals.pool.execute(
      'SELECT points FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!users.length || users[0].points < amount) {
      return res.status(400).json({ code: 3002, message: '积分不足' });
    }

    await awardPoints(req.app.locals.pool, req.user.id, -Math.round(amount), 'purchase', description || `消费${amount}积分`, relatedId);

    return res.json({
      code: 0,
      data: { spent: amount, remaining: users[0].points - amount, message: `成功消费${amount}积分` },
    });
  } catch (error) {
    console.error('Spend points error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

/** GET /api/points/summary - 积分概览 */
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const [users] = await req.app.locals.pool.execute(
      'SELECT points FROM users WHERE id = ?',
      [req.user.id]
    );

    const [todayCheckIn] = await req.app.locals.pool.execute(
      'SELECT streak FROM check_ins WHERE user_id = ? AND check_in_date = CURDATE()',
      [req.user.id]
    );

    const [totalEarned] = await req.app.locals.pool.execute(
      'SELECT COALESCE(SUM(amount), 0) as total FROM points_history WHERE user_id = ? AND amount > 0',
      [req.user.id]
    );

    const [streakInfo] = await req.app.locals.pool.execute(
      'SELECT streak FROM check_ins WHERE user_id = ? ORDER BY check_in_date DESC LIMIT 1',
      [req.user.id]
    );

    return res.json({
      code: 0,
      data: {
        points: users[0]?.points || 0,
        totalEarned: totalEarned[0].total,
        checkedInToday: todayCheckIn.length > 0,
        currentStreak: streakInfo.length > 0 ? streakInfo[0].streak : 0,
      },
    });
  } catch (error) {
    console.error('Get points summary error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

module.exports = router;
module.exports.awardPoints = awardPoints;
module.exports.POINTS_RULES = POINTS_RULES;
