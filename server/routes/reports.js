const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { targetType, targetId, reason, detail } = req.body;

    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ code: 1001, message: '举报参数不完整' });
    }

    const reportId = uuidv4();
    await req.app.locals.pool.execute(
      'INSERT INTO reports (id, reporter_id, target_type, target_id, reason, detail, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [reportId, req.user.id, targetType, targetId, reason, detail || null, 'pending']
    );

    return res.status(201).json({
      code: 0,
      data: {
        id: reportId,
        targetType,
        targetId,
        reason,
        detail: detail || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Submit report error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

module.exports = router;
