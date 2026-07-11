const { query } = require('../config/db');

const PUBLIC_COLUMNS = 'id, name, email, role, is_active, created_at, updated_at';

async function createUser({ name, email, passwordHash, role }) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash, role]
  );
  return rows[0];
}

async function findByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function findByIdWithPassword(id) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function listUsers() {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY created_at DESC`);
  return rows;
}

async function updateRole(id, role) {
  const { rows } = await query(
    `UPDATE users SET role = $2, updated_at = now() WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, role]
  );
  return rows[0] || null;
}

async function setActive(id, isActive) {
  const { rows } = await query(
    `UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, isActive]
  );
  return rows[0] || null;
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  findByIdWithPassword,
  listUsers,
  updateRole,
  setActive,
};
