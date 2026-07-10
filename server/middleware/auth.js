const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pet-planet-jwt-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'pet-planet-refresh-secret-key';
const JWT_EXPIRES_IN = '2h';
const JWT_REFRESH_EXPIRES_IN = '7d';

/**
 * Generate access token
 */
function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Generate refresh token
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
}

/**
 * Auth middleware - verifies JWT and attaches user to req
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 1002, message: '未授权（未登录）' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 2004, message: 'Token 已过期' });
    }
    return res.status(401).json({ code: 1002, message: '无效的Token' });
  }
}

/**
 * Optional auth - doesn't fail if no token, but attaches user if present
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (_) {
      // ignore invalid token
    }
  }
  next();
}

module.exports = {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  generateAccessToken,
  generateRefreshToken,
  authMiddleware,
  optionalAuth,
};
