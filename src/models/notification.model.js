const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/rowMapper');

const COLUMNS = 'id, user_id, type, message, proforma_id, `read`, created_at';

async function create({ userId, type, message, proformaId }) {
  const res = await query(
    'INSERT INTO notifications (user_id, type, message, proforma_id) VALUES (?,?,?,?)',
    [userId, type, message, proformaId]
  );
  const rows = await query(`SELECT ${COLUMNS} FROM notifications WHERE id = ?`, [res.insertId]);
  return mapRow(rows[0]);
}

async function listForUser({ userId, unreadOnly, limit, offset }) {
  let where = 'WHERE user_id = ?';
  const params = [userId];
  if (unreadOnly) where += ' AND `read` = 0';

  const countRows = await query(`SELECT COUNT(*) AS total FROM notifications ${where}`, params);
  const unreadRows = await query(
    'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND `read` = 0',
    [userId]
  );
  const rows = await query(
    `SELECT ${COLUMNS} FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // `proforma` keeps the field name the frontend already reads.
  const data = mapRows(rows).map(({ proformaId, ...rest }) => ({ ...rest, proforma: proformaId }));
  return { data, total: countRows[0].total, unreadCount: unreadRows[0].c };
}

async function markRead(id, userId) {
  await query('UPDATE notifications SET `read` = 1 WHERE id = ? AND user_id = ?', [id, userId]);
}

async function markAllRead(userId) {
  await query('UPDATE notifications SET `read` = 1 WHERE user_id = ? AND `read` = 0', [userId]);
}

module.exports = { create, listForUser, markRead, markAllRead };
