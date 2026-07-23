const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/rowMapper');

const COLUMNS = `id, name, stone_category, stone_color, finish, thickness_options,
                 default_unit_price, status, allows_direct_approval, created_at, updated_at`;

async function create(data) {
  const { rows } = await query(
    `INSERT INTO products
       (name, stone_category, stone_color, finish, thickness_options, default_unit_price, status,
        allows_direct_approval)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING ${COLUMNS}`,
    [
      data.name, data.stoneCategory, data.stoneColor, data.finish,
      data.thicknessOptions, data.defaultUnitPrice, data.status, data.allowsDirectApproval,
    ]
  );
  return mapRow(rows[0]);
}

async function findById(id) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM products WHERE id = $1`, [id]);
  return mapRow(rows[0]);
}

async function findByIds(ids) {
  if (!ids.length) return [];
  const { rows } = await query(`SELECT ${COLUMNS} FROM products WHERE id = ANY($1::int[])`, [ids]);
  return mapRows(rows);
}

async function findByName(name) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM products WHERE name = $1`, [name]);
  return mapRow(rows[0]);
}

async function list({ search, stoneCategory, finish, status, sort, limit, offset }) {
  const conditions = [];
  const params = [];

  if (stoneCategory) {
    params.push(stoneCategory);
    conditions.push(`stone_category = $${params.length}`);
  }
  if (finish) {
    params.push(finish);
    conditions.push(`finish = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    conditions.push(`(name ILIKE ${p} OR stone_color ILIKE ${p})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM products ${where}`,
    params
  );

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM products ${where}
     ORDER BY ${sort} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { data: mapRows(rows), total: countRows[0].total };
}

async function update(id, data) {
  const { rows } = await query(
    `UPDATE products SET
       name = $2, stone_category = $3, stone_color = $4, finish = $5,
       thickness_options = $6, default_unit_price = $7, status = $8,
       allows_direct_approval = $9, updated_at = now()
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [
      id, data.name, data.stoneCategory, data.stoneColor, data.finish,
      data.thicknessOptions, data.defaultUnitPrice, data.status, data.allowsDirectApproval,
    ]
  );
  return mapRow(rows[0]);
}

async function setStatus(id, status) {
  const { rows } = await query(
    `UPDATE products SET status = $2, updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, status]
  );
  return mapRow(rows[0]);
}

async function remove(id) {
  const { rowCount } = await query('DELETE FROM products WHERE id = $1', [id]);
  return rowCount > 0;
}

async function isUsedInProformas(id) {
  const { rows } = await query('SELECT 1 FROM proforma_items WHERE product_id = $1 LIMIT 1', [id]);
  return rows.length > 0;
}

module.exports = {
  create, findById, findByIds, findByName, list, update, setStatus, remove, isUsedInProformas,
};
