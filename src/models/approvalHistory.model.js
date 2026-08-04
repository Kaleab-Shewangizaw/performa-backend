const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/rowMapper');

async function create({ proformaId, action, actorId, comment = '' }) {
  const res = await query(
    'INSERT INTO approval_history (proforma_id, action, actor_id, comment) VALUES (?,?,?,?)',
    [proformaId, action, actorId, comment]
  );
  const rows = await query(
    'SELECT id, proforma_id, action, actor_id, comment, created_at FROM approval_history WHERE id = ?',
    [res.insertId]
  );
  return mapRow(rows[0]);
}

async function listForProforma(proformaId) {
  const rows = await query(
    `SELECT h.id, h.proforma_id, h.action, h.comment, h.created_at,
            CASE WHEN u.id IS NULL THEN NULL
                 ELSE JSON_OBJECT('id', u.id, 'name', u.name, 'email', u.email, 'role', u.role)
            END AS actor
       FROM approval_history h
       LEFT JOIN users u ON u.id = h.actor_id
      WHERE h.proforma_id = ?
      ORDER BY h.created_at ASC, h.id ASC`,
    [proformaId]
  );
  return mapRows(rows).map((h) => ({
    ...h,
    actor: typeof h.actor === 'string' ? JSON.parse(h.actor) : h.actor,
  }));
}

async function removeForProforma(proformaId) {
  await query('DELETE FROM approval_history WHERE proforma_id = ?', [proformaId]);
}

module.exports = { create, listForProforma, removeForProforma };
