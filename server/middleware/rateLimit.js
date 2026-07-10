function createRateLimit({ windowMs, max, keyPrefix = 'default' }) {
  const buckets = new Map();

  function reject(res, resetAt) {
    const now = Date.now();
    const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      code: 4290,
      message: '请求过于频繁，请稍后再试',
    });
  }

  function memoryLimit(req, res, next, key) {
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      return reject(res, current.resetAt);
    }

    return next();
  }

  return async (req, res, next) => {
    const identity = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${identity}`;
    const pool = req.app?.locals?.pool;

    if (!pool) {
      return memoryLimit(req, res, next, key);
    }

    try {
      const now = Date.now();
      const [rows] = await pool.execute(
        'SELECT request_count, reset_at FROM rate_limit_buckets WHERE bucket_key = ?',
        [key]
      );

      if (rows.length === 0 || new Date(rows[0].reset_at).getTime() <= now) {
        const resetAt = new Date(now + windowMs);
        await pool.execute(
          `INSERT INTO rate_limit_buckets (bucket_key, request_count, reset_at)
           VALUES (?, 1, ?)
           ON DUPLICATE KEY UPDATE request_count = 1, reset_at = VALUES(reset_at)`,
          [key, resetAt]
        );
        return next();
      }

      const resetAtMs = new Date(rows[0].reset_at).getTime();
      if (rows[0].request_count >= max) {
        return reject(res, resetAtMs);
      }

      await pool.execute(
        'UPDATE rate_limit_buckets SET request_count = request_count + 1 WHERE bucket_key = ?',
        [key]
      );

      return next();
    } catch (error) {
      console.error('[rateLimit] Falling back to memory bucket:', error.message);
      return memoryLimit(req, res, next, key);
    }
  };
}

module.exports = { createRateLimit };
