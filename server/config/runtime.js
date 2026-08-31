const path = require('path');

function requiredProductionValues(env) {
  const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DB_PASSWORD', 'CORS_ORIGIN', 'UPLOAD_DIR'];
  return required.filter((name) => !String(env[name] || '').trim());
}

function loadRuntimeConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const missing = production ? requiredProductionValues(env) : [];
  if (missing.length > 0) {
    const error = new Error(`生产运行配置缺失: ${missing.join(', ')}`);
    error.code = 'RUNTIME_CONFIG_INVALID';
    throw error;
  }

  const corsOrigins = String(env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (production && corsOrigins.length === 0) {
    const error = new Error('生产环境必须设置显式 CORS_ORIGIN');
    error.code = 'RUNTIME_CONFIG_INVALID';
    throw error;
  }

  return {
    production,
    port: Number.parseInt(env.PORT || '3000', 10),
    corsOrigins,
    uploadDir: path.resolve(env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads')),
    database: {
      host: env.DB_HOST || 'localhost',
      port: Number.parseInt(env.DB_PORT || '3306', 10),
      user: env.DB_USER || 'root',
      password: env.DB_PASSWORD || '',
      name: env.DB_NAME || 'pet_planet',
    },
    jwtSecret: env.JWT_SECRET || 'local-development-jwt-secret',
    jwtRefreshSecret: env.JWT_REFRESH_SECRET || 'local-development-refresh-secret',
  };
}

module.exports = { loadRuntimeConfig, requiredProductionValues };
