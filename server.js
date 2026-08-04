const app = require('./src/app');
const env = require('./src/config/env');
const { pool } = require('./src/config/db');

// Start listening immediately so the app — and the frontend it serves — is
// available even when the database is temporarily unreachable. Passenger/cPanel
// returns 503 whenever the Node process exits, so we must NOT exit on a DB
// hiccup; pg reconnects on demand once the database is reachable.
app.listen(env.port, () => {
  console.log(`performa-backend listening on port ${env.port} (${env.nodeEnv})`);
});

// Advisory connectivity check — logs status but never crashes the process.
pool
  .query('SELECT 1')
  .then(() => console.log('Connected to PostgreSQL'))
  .catch((err) => console.error('WARNING: PostgreSQL not reachable yet —', err.message));
