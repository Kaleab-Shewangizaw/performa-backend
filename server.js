const app = require('./src/app');
const env = require('./src/config/env');
const { pool } = require('./src/config/db');

async function start() {
  // Fail fast if the database is unreachable.
  await pool.query('SELECT 1');
  console.log('Connected to PostgreSQL');

  app.listen(env.port, () => {
    console.log(`performa-backend listening on port ${env.port} (${env.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('Failed to connect to PostgreSQL:', err.message);
  process.exit(1);
});
