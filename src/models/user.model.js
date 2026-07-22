const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/rowMapper');

const PUBLIC_COLUMNS = 'id, name, email, role, is_active, created_at, updated_at';

async function create({ name, email, passwordHash, role }) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, lower($2), $3, $4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash, role]
  );
  return mapRow(rows[0]);
}

// Includes password_hash — only for authentication.
async function findByEmailWithPassword(email) {
  const { rows } = await query('SELECT * FROM users WHERE email = lower($1)', [email]);
  return mapRow(rows[0]);
}

async function findById(id) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return mapRow(rows[0]);
}

async function existsByEmail(email) {
  const { rows } = await query('SELECT 1 FROM users WHERE email = lower($1)', [email]);
  return rows.length > 0;
}

async function count() {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM users');
  return rows[0].count;
}

async function countActive() {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM users WHERE is_active');
  return rows[0].count;
}

async function list({ role, search, sort, limit, offset }) {
  const conditions = [];
  const params = [];

  if (role) {
    params.push(role);
    conditions.push(`role = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows: countRows } = await query(`SELECT COUNT(*)::int AS total FROM users ${where}`, params);

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM users ${where}
     ORDER BY ${sort} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { data: mapRows(rows), total: countRows[0].total };
}

async function update(id, { name, email, passwordHash, role }) {
  const sets = [];
  const params = [id];

  if (name !== undefined) {
    params.push(name);
    sets.push(`name = $${params.length}`);
  }
  if (email !== undefined) {
    params.push(email);
    sets.push(`email = lower($${params.length})`);
  }
  if (passwordHash !== undefined) {
    params.push(passwordHash);
    sets.push(`password_hash = $${params.length}`);
  }
  if (role !== undefined) {
    params.push(role);
    sets.push(`role = $${params.length}`);
  }
  if (!sets.length) return findById(id);

  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')}, updated_at = now()
     WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    params
  );
  return mapRow(rows[0]);
}

async function setActive(id, isActive) {
  const { rows } = await query(
    `UPDATE users SET is_active = $2, updated_at = now()
     WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, isActive]
  );
  return mapRow(rows[0]);
}

module.exports = {
  create,
  findById,
  findByEmailWithPassword,
  existsByEmail,
  count,
  countActive,
  list,
  update,
  setActive,
};
