const { query } = require('../config/db');
const { mapRow } = require('../utils/rowMapper');

async function store({ userId, tokenHash, expiresAt }) {
  const { rows } = await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3) RETURNING id`,
    [userId, tokenHash, expiresAt]
  );
  return mapRow(rows[0]);
}

async function findActiveByHash(tokenHash) {
  const { rows } = await query(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [tokenHash]
  );
  return mapRow(rows[0]);
}

async function revokeByHash(tokenHash) {
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [tokenHash]);
}

async function revokeAllForUser(userId) {
  await query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );
}

// Housekeeping: drop rows that expired long ago.
async function purgeExpired() {
  await query('DELETE FROM refresh_tokens WHERE expires_at < now() - INTERVAL \'30 days\'');
}

module.exports = { store, findActiveByHash, revokeByHash, revokeAllForUser, purgeExpired };
