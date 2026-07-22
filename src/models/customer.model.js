const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/rowMapper');

const COLUMNS = `id, full_name, company_name, phone, email, address, city,
                 tax_number, notes, created_by, created_at, updated_at`;

async function create(data, createdBy) {
  const { rows } = await query(
    `INSERT INTO customers
       (full_name, company_name, phone, email, address, city, tax_number, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING ${COLUMNS}`,
    [
      data.fullName, data.companyName, data.phone, data.email,
      data.address, data.city, data.taxNumber, data.notes, createdBy,
    ]
  );
  return mapRow(rows[0]);
}

async function findById(id) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM customers WHERE id = $1`, [id]);
  return mapRow(rows[0]);
}

async function list({ search, city, sort, limit, offset }) {
  const conditions = [];
  const params = [];

  if (city) {
    params.push(city);
    conditions.push(`lower(city) = lower($${params.length})`);
  }
  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    conditions.push(
      `(full_name ILIKE ${p} OR company_name ILIKE ${p} OR phone ILIKE ${p} OR email ILIKE ${p})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM customers ${where}`,
    params
  );

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM customers ${where}
     ORDER BY ${sort} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { data: mapRows(rows), total: countRows[0].total };
}

async function update(id, data) {
  const { rows } = await query(
    `UPDATE customers SET
       full_name = $2, company_name = $3, phone = $4, email = $5,
       address = $6, city = $7, tax_number = $8, notes = $9, updated_at = now()
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [
      id, data.fullName, data.companyName, data.phone, data.email,
      data.address, data.city, data.taxNumber, data.notes,
    ]
  );
  return mapRow(rows[0]);
}

async function remove(id) {
  const { rowCount } = await query('DELETE FROM customers WHERE id = $1', [id]);
  return rowCount > 0;
}

async function hasProformas(id) {
  const { rows } = await query('SELECT 1 FROM proformas WHERE customer_id = $1 LIMIT 1', [id]);
  return rows.length > 0;
}

async function count() {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM customers');
  return rows[0].count;
}

async function recent(limit) {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM customers ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return mapRows(rows);
}

module.exports = { create, findById, list, update, remove, hasProformas, count, recent };
