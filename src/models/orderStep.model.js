const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/rowMapper');

const COLUMNS = 'id, name, position, is_active, created_at, updated_at';

async function list({ activeOnly = false } = {}) {
  const where = activeOnly ? 'WHERE is_active = 1' : '';
  const rows = await query(
    `SELECT ${COLUMNS} FROM order_steps ${where} ORDER BY position, id`
  );
  return mapRows(rows);
}

async function findById(id) {
  const rows = await query(`SELECT ${COLUMNS} FROM order_steps WHERE id = ?`, [id]);
  return mapRow(rows[0]);
}

// The step an order enters the moment it is approved.
async function firstActive() {
  const rows = await query(
    `SELECT ${COLUMNS} FROM order_steps WHERE is_active = 1 ORDER BY position, id LIMIT 1`
  );
  return mapRow(rows[0]);
}

// New steps default to the end of the pipeline unless a position is given.
async function create({ name, position, isActive = true }) {
  let pos = position;
  if (pos === undefined || pos === null) {
    const rows = await query('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM order_steps');
    pos = rows[0].next;
  }
  const res = await query(
    'INSERT INTO order_steps (name, position, is_active) VALUES (?, ?, ?)',
    [name, pos, isActive ? 1 : 0]
  );
  return findById(res.insertId);
}

async function update(id, { name, position, isActive }) {
  const sets = [];
  const params = [];

  if (name !== undefined) {
    sets.push('name = ?');
    params.push(name);
  }
  if (position !== undefined) {
    sets.push('position = ?');
    params.push(position);
  }
  if (isActive !== undefined) {
    sets.push('is_active = ?');
    params.push(isActive ? 1 : 0);
  }
  if (!sets.length) return findById(id);

  params.push(id);
  await query(`UPDATE order_steps SET ${sets.join(', ')} WHERE id = ?`, params);
  return findById(id);
}

async function countReferences(id) {
  const rows = await query(
    `SELECT
       (SELECT COUNT(*) FROM proformas WHERE current_step_id = ?) +
       (SELECT COUNT(*) FROM order_step_history WHERE step_id = ?) AS refs`,
    [id, id]
  );
  return Number(rows[0].refs);
}

// Hard-delete only when nothing points at the step; otherwise deactivate so
// existing orders and their history stay intact. Returns the surviving row for
// a soft-delete, or null when the row was removed.
async function remove(id) {
  if ((await countReferences(id)) === 0) {
    await query('DELETE FROM order_steps WHERE id = ?', [id]);
    return null;
  }
  return update(id, { isActive: false });
}

module.exports = { list, findById, firstActive, create, update, remove, countReferences };
