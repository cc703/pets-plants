const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const aiRoutes = require('./routes/ai');
const notificationRoutes = require('./routes/notifications');
const pointsRoutes = require('./routes/points');
const messageRoutes = require('./routes/messages');
const circleRoutes = require('./routes/circles');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, 'uploads');

app.use(corsOrigins.length > 0
  ? cors({
      origin: (origin, callback) => {
        if (!origin || corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  : cors());
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(uploadDir));

// MySQL 连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pet_planet',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Make pool accessible to routes via req.app.locals.pool
app.locals.pool = pool;

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api', commentRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/circles', circleRoutes);
app.use('/api/reports', reportRoutes);

// GET /api/bookmarks - Get current user's bookmarked posts
const { authMiddleware: authMw } = require('./middleware/auth');
app.get('/api/bookmarks', authMw, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [countRows] = await pool.execute(
      'SELECT COUNT(*) as total FROM bookmarks WHERE user_id = ?',
      [req.user.id]
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT b.id as bookmark_id, b.created_at as bookmarked_at, p.*
       FROM bookmarks b
       JOIN posts p ON b.post_id = p.id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      [req.user.id]
    );

    const data = rows.map((row) => ({
      id: row.bookmark_id,
      postId: row.id,
      createdAt: row.bookmarked_at,
      targetTitle: row.title || row.content?.slice(0, 40) || '',
      post: {
        id: row.id,
        userId: row.user_id,
        breedId: row.breed_id,
        title: row.title,
        content: row.content,
        images: typeof row.images === 'string' ? JSON.parse(row.images) : (row.images || []),
        tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
        stats: typeof row.stats === 'string' ? JSON.parse(row.stats) : (row.stats || {}),
        isPinned: !!row.is_pinned,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    }));

    return res.json({
      code: 0,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 获取所有品种
app.get('/api/breeds', async (req, res) => {
  try {
    const { species, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT * FROM breeds';
    const params = [];

    if (species && (species === 'cat' || species === 'dog')) {
      sql += ' WHERE species = ?';
      params.push(species);
    }

    sql += ' ORDER BY popularity_rank ASC LIMIT ? OFFSET ?';
    params.push(Number(limit), (Number(page) - 1) * Number(limit));

    const [rows] = await pool.execute(sql, params);
    res.json({ data: rows, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error('Error fetching breeds:', error);
    res.status(500).json({ error: '获取品种列表失败' });
  }
});

// 获取单个品种详情
app.get('/api/breeds/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM breeds WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '品种未找到' });
    }
    res.json({ data: rows[0] });
  } catch (error) {
    console.error('Error fetching breed:', error);
    res.status(500).json({ error: '获取品种详情失败' });
  }
});

// 搜索品种
app.get('/api/breeds/search/:keyword', async (req, res) => {
  try {
    const keyword = `%${req.params.keyword}%`;
    const [rows] = await pool.execute(
      'SELECT * FROM breeds WHERE name LIKE ? OR name_en LIKE ? OR origin_country LIKE ?',
      [keyword, keyword, keyword]
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('Error searching breeds:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`🐾 萌宠星球 API 服务运行在 http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用，请先关闭占用进程`);
  } else {
    console.error('服务器错误:', err);
  }
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('未捕获异常:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('未处理Promise拒绝:', err);
});
