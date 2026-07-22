const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/rowMapper');

const COLUMNS = 'id, user_id, type, message, proforma_id, read, created_at';

async function create({ userId, type, message, proformaId }) {
  const { rows } = await query(
    `INSERT INTO notifications (user_id, type, message, proforma_id)
     VALUES ($1,$2,$3,$4) RETURNING ${COLUMNS}`,
    [userId, type, message, proformaId]
  );
  return mapRow(rows[0]);
}

async function listForUser({ userId, unreadOnly, limit, offset }) {
  const params = [userId];
  let where = 'WHERE user_id = $1';
  if (unreadOnly) where += ' AND read = FALSE';

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM notifications ${where}`,
    params
  );
  const { rows: unreadRows } = await query(
    'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read = FALSE',
    [userId]
  );

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM notifications ${where}
     ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  // `proforma` keeps the field name the frontend already reads.
  const data = mapRows(rows).map(({ proformaId, ...rest }) => ({ ...rest, proforma: proformaId }));
  return { data, total: countRows[0].total, unreadCount: unreadRows[0].count };
}

async function markRead(id, userId) {
  await query('UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2', [id, userId]);
}

async function markAllRead(userId) {
  await query('UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE', [userId]);
}

module.exports = { create, listForUser, markRead, markAllRead };
