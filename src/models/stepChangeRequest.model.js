const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/rowMapper');

const SELECT = `
  SELECT r.id, r.proforma_id, r.from_step_id, r.to_step_id, r.requested_by, r.status,
         r.reason, r.decided_by, r.decision_note, r.created_at, r.decided_at,
         p.proforma_number AS proforma_number,
         fs.name AS from_step_name, ts.name AS to_step_name,
         CASE WHEN ru.id IS NULL THEN NULL
              ELSE JSON_OBJECT('id', ru.id, 'name', ru.name, 'role', ru.role) END AS requested_by_user
    FROM step_change_requests r
    JOIN proformas p ON p.id = r.proforma_id
    LEFT JOIN order_steps fs ON fs.id = r.from_step_id
    LEFT JOIN order_steps ts ON ts.id = r.to_step_id
    LEFT JOIN users ru ON ru.id = r.requested_by
`;

function shape(row) {
  if (!row) return null;
  const r = mapRow(row);
  r.requestedBy = typeof r.requestedByUser === 'string' ? JSON.parse(r.requestedByUser) : r.requestedByUser;
  delete r.requestedByUser;
  return r;
}

async function create({ proformaId, fromStepId, toStepId, requestedBy, reason = '' }) {
  const res = await query(
    `INSERT INTO step_change_requests (proforma_id, from_step_id, to_step_id, requested_by, reason)
     VALUES (?, ?, ?, ?, ?)`,
    [proformaId, fromStepId, toStepId, requestedBy, reason]
  );
  return findById(res.insertId);
}

async function findById(id) {
  const rows = await query(`${SELECT} WHERE r.id = ?`, [id]);
  return shape(rows[0]);
}

// A proforma may have at most one open request at a time.
async function findPendingForProforma(proformaId) {
  const rows = await query(
    `${SELECT} WHERE r.proforma_id = ? AND r.status = 'pending' ORDER BY r.id DESC LIMIT 1`,
    [proformaId]
  );
  return shape(rows[0]);
}

async function listPending({ limit = 50, offset = 0 } = {}) {
  const countRows = await query("SELECT COUNT(*) AS total FROM step_change_requests WHERE status = 'pending'");
  const rows = await query(
    `${SELECT} WHERE r.status = 'pending' ORDER BY r.created_at ASC, r.id ASC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return { data: rows.map(shape), total: countRows[0].total };
}

async function decide(id, { status, decidedBy, decisionNote = '' }) {
  await query(
    `UPDATE step_change_requests
        SET status = ?, decided_by = ?, decision_note = ?, decided_at = NOW()
      WHERE id = ?`,
    [status, decidedBy, decisionNote, id]
  );
  return findById(id);
}

async function pendingCount() {
  const rows = await query("SELECT COUNT(*) AS c FROM step_change_requests WHERE status = 'pending'");
  return rows[0].c;
}

module.exports = { create, findById, findPendingForProforma, listPending, decide, pendingCount };
