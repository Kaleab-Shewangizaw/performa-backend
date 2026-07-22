const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/rowMapper');

async function create({ proformaId, action, actorId, comment = '' }) {
  const { rows } = await query(
    `INSERT INTO approval_history (proforma_id, action, actor_id, comment)
     VALUES ($1,$2,$3,$4)
     RETURNING id, proforma_id, action, actor_id, comment, created_at`,
    [proformaId, action, actorId, comment]
  );
  return mapRow(rows[0]);
}

async function listForProforma(proformaId) {
  const { rows } = await query(
    `SELECT h.id, h.proforma_id, h.action, h.comment, h.created_at,
            CASE WHEN u.id IS NULL THEN NULL
                 ELSE json_build_object('id', u.id, 'name', u.name,
                                        'email', u.email, 'role', u.role) END AS actor
       FROM approval_history h
       LEFT JOIN users u ON u.id = h.actor_id
      WHERE h.proforma_id = $1
      ORDER BY h.created_at ASC, h.id ASC`,
    [proformaId]
  );
  return mapRows(rows);
}

async function removeForProforma(proformaId) {
  await query('DELETE FROM approval_history WHERE proforma_id = $1', [proformaId]);
}

module.exports = { create, listForProforma, removeForProforma };
