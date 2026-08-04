const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/rowMapper');

const COLUMNS = `id, full_name, company_name, phone, email, address, city,
                 tax_number, notes, created_by, created_at, updated_at`;

async function create(data, createdBy) {
  const res = await query(
    `INSERT INTO customers
       (full_name, company_name, phone, email, address, city, tax_number, notes, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      data.fullName, data.companyName, data.phone, data.email,
      data.address, data.city, data.taxNumber, data.notes, createdBy,
    ]
  );
  return findById(res.insertId);
}

async function findById(id) {
  const rows = await query(`SELECT ${COLUMNS} FROM customers WHERE id = ?`, [id]);
  return mapRow(rows[0]);
}

async function list({ search, city, sort, limit, offset }) {
  const conditions = [];
  const params = [];

  if (city) {
    conditions.push('city = ?');
    params.push(city);
  }
  if (search) {
    conditions.push('(full_name LIKE ? OR company_name LIKE ? OR phone LIKE ? OR email LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countRows = await query(`SELECT COUNT(*) AS total FROM customers ${where}`, params);
  const rows = await query(
    `SELECT ${COLUMNS} FROM customers ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return { data: mapRows(rows), total: countRows[0].total };
}

async function update(id, data) {
  const res = await query(
    `UPDATE customers SET
       full_name = ?, company_name = ?, phone = ?, email = ?,
       address = ?, city = ?, tax_number = ?, notes = ?
     WHERE id = ?`,
    [
      data.fullName, data.companyName, data.phone, data.email,
      data.address, data.city, data.taxNumber, data.notes, id,
    ]
  );
  if (res.affectedRows === 0) {
    const exists = await findById(id);
    if (!exists) return null;
  }
  return findById(id);
}

async function remove(id) {
  const res = await query('DELETE FROM customers WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

async function hasProformas(id) {
  const rows = await query('SELECT 1 FROM proformas WHERE customer_id = ? LIMIT 1', [id]);
  return rows.length > 0;
}

async function count() {
  const rows = await query('SELECT COUNT(*) AS c FROM customers');
  return rows[0].c;
}

async function recent(limit) {
  const rows = await query(
    `SELECT ${COLUMNS} FROM customers ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
  return mapRows(rows);
}

module.exports = { create, findById, list, update, remove, hasProformas, count, recent };
