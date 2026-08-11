const { query } = require('../config/db');
const { mapRows } = require('../utils/rowMapper');

async function create({ actorId = null, action, entityType = '', entityId = null, summary = '' }) {
  const res = await query(
    `INSERT INTO activity_log (actor_id, action, entity_type, entity_id, summary)
     VALUES (?, ?, ?, ?, ?)`,
    [actorId, action, entityType, entityId, summary]
  );
  return res.insertId;
}

async function list({ action, limit = 50, offset = 0 }) {
  const conditions = [];
  const params = [];
  if (action) {
    conditions.push('a.action = ?');
    params.push(action);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRows = await query(`SELECT COUNT(*) AS total FROM activity_log a ${where}`, params);
  const rows = await query(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.summary, a.created_at,
            CASE WHEN u.id IS NULL THEN NULL
                 ELSE JSON_OBJECT('id', u.id, 'name', u.name, 'role', u.role) END AS actor
       FROM activity_log a
       LEFT JOIN users u ON u.id = a.actor_id
       ${where}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const data = mapRows(rows).map((r) => ({
    ...r,
    actor: typeof r.actor === 'string' ? JSON.parse(r.actor) : r.actor,
  }));
  return { data, total: countRows[0].total };
}

module.exports = { create, list };
