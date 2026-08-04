const { query } = require('../config/db');
const { mapRow } = require('../utils/rowMapper');

async function store({ userId, tokenHash, expiresAt }) {
  const res = await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  );
  return { id: res.insertId };
}

async function findActiveByHash(tokenHash) {
  const rows = await query(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW()`,
    [tokenHash]
  );
  return mapRow(rows[0]);
}

async function revokeByHash(tokenHash) {
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?', [tokenHash]);
}

async function revokeAllForUser(userId) {
  await query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
    [userId]
  );
}

// Housekeeping: drop rows that expired long ago.
async function purgeExpired() {
  await query('DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL 30 DAY');
}

module.exports = { store, findActiveByHash, revokeByHash, revokeAllForUser, purgeExpired };
