const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/rowMapper');

const PUBLIC = 'id, name, email, role, is_active, created_at, updated_at';

async function create({ name, email, passwordHash, role }) {
  const res = await query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, LOWER(?), ?, ?)',
    [name, email, passwordHash, role]
  );
  return findById(res.insertId);
}

// Includes password_hash — only for authentication.
async function findByEmailWithPassword(email) {
  const rows = await query('SELECT * FROM users WHERE email = LOWER(?)', [email]);
  return mapRow(rows[0]);
}

async function findById(id) {
  const rows = await query(`SELECT ${PUBLIC} FROM users WHERE id = ?`, [id]);
  return mapRow(rows[0]);
}

async function existsByEmail(email) {
  const rows = await query('SELECT 1 FROM users WHERE email = LOWER(?) LIMIT 1', [email]);
  return rows.length > 0;
}

async function count() {
  const rows = await query('SELECT COUNT(*) AS c FROM users');
  return rows[0].c;
}

async function countActive() {
  const rows = await query('SELECT COUNT(*) AS c FROM users WHERE is_active = 1');
  return rows[0].c;
}

async function list({ role, search, sort, limit, offset }) {
  const conditions = [];
  const params = [];

  if (role) {
    conditions.push('role = ?');
    params.push(role);
  }
  if (search) {
    conditions.push('(name LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countRows = await query(`SELECT COUNT(*) AS total FROM users ${where}`, params);
  const rows = await query(
    `SELECT ${PUBLIC} FROM users ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return { data: mapRows(rows), total: countRows[0].total };
}

async function update(id, { name, email, passwordHash, role }) {
  const sets = [];
  const params = [];

  if (name !== undefined) {
    sets.push('name = ?');
    params.push(name);
  }
  if (email !== undefined) {
    sets.push('email = LOWER(?)');
    params.push(email);
  }
  if (passwordHash !== undefined) {
    sets.push('password_hash = ?');
    params.push(passwordHash);
  }
  if (role !== undefined) {
    sets.push('role = ?');
    params.push(role);
  }
  if (!sets.length) return findById(id);

  params.push(id);
  await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  return findById(id);
}

async function setActive(id, isActive) {
  await query('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  return findById(id);
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
