// Load .env for local dev. On a platform that injects env vars directly
// (e.g. cPanel's Node app), this is optional and must never crash startup.
try {
  require('dotenv').config({ quiet: true });
} catch (err) {
  console.warn('dotenv not loaded (using platform env vars):', err.message);
}

const required = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  // Connect over SSL without CA verification (self-signed managed Postgres).
  dbSsl: /^(1|true|require|yes|on)$/i.test(process.env.DB_SSL || ''),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
  // Folder (relative to the backend root) holding the built frontend. When it
  // contains an index.html the API also serves the SPA — a single-app deploy.
  clientDir: process.env.CLIENT_DIR || 'public',
  // Comma-separated allowed origins for a split deploy. Empty = same-origin
  // (reflect request origin), which is correct when this app serves the SPA.
  corsOrigin: process.env.CORS_ORIGIN || '',
};
