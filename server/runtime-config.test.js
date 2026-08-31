const assert = require('assert');
const { loadRuntimeConfig, requiredProductionValues } = require('./config/runtime');

const development = loadRuntimeConfig({ NODE_ENV: 'development' });
assert.strictEqual(development.production, false);
assert.strictEqual(development.database.name, 'pet_planet');

const missing = requiredProductionValues({ NODE_ENV: 'production' });
assert.deepStrictEqual(missing, ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DB_PASSWORD', 'CORS_ORIGIN', 'UPLOAD_DIR']);
assert.throws(
  () => loadRuntimeConfig({ NODE_ENV: 'production' }),
  (error) => error.code === 'RUNTIME_CONFIG_INVALID' && /JWT_SECRET/.test(error.message),
);

const production = loadRuntimeConfig({
  NODE_ENV: 'production',
  JWT_SECRET: 'strong-access-secret',
  JWT_REFRESH_SECRET: 'strong-refresh-secret',
  DB_PASSWORD: 'db-password',
  CORS_ORIGIN: 'https://staging.example.test',
  UPLOAD_DIR: 'D:/pet-planet/uploads',
});
assert.strictEqual(production.corsOrigins[0], 'https://staging.example.test');
assert.strictEqual(production.uploadDir.endsWith('uploads'), true);
console.log('runtime config checks passed');
