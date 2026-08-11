const { query } = require('../config/db');
const { mapRows } = require('../utils/rowMapper');

// changedById is null for system/automatic transitions (e.g. tracking started
// on approval). step_name is stored as a snapshot so the timeline survives a
// later rename or delete of the step.
async function create({ proformaId, stepId, stepName, changedById = null, note = '', reason = '' }) {
  const res = await query(
    `INSERT INTO order_step_history (proforma_id, step_id, step_name, changed_by, note, reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [proformaId, stepId, stepName, changedById, note, reason]
  );
  return res.insertId;
}

async function listForProforma(proformaId) {
  const rows = await query(
    `SELECT h.id, h.proforma_id, h.step_id, h.step_name, h.note, h.reason, h.created_at,
            CASE WHEN u.id IS NULL THEN NULL
                 ELSE JSON_OBJECT('id', u.id, 'name', u.name, 'role', u.role)
            END AS changed_by
       FROM order_step_history h
       LEFT JOIN users u ON u.id = h.changed_by
      WHERE h.proforma_id = ?
      ORDER BY h.created_at ASC, h.id ASC`,
    [proformaId]
  );
  return mapRows(rows).map((h) => ({
    ...h,
    changedBy: typeof h.changedBy === 'string' ? JSON.parse(h.changedBy) : h.changedBy,
  }));
}

module.exports = { create, listForProforma };
