const { query } = require('../config/db');
const { mapRow, mapRows } = require('../utils/rowMapper');

const COLUMNS = `id, name, stone_category, stone_color, finish, thickness_options,
                 default_unit_price, status, allows_direct_approval, created_at, updated_at`;

// thickness_options is JSON; MariaDB returns it as a string, so parse it.
function mapProduct(row) {
  const p = mapRow(row);
  if (!p) return null;
  if (typeof p.thicknessOptions === 'string') {
    p.thicknessOptions = JSON.parse(p.thicknessOptions);
  }
  return p;
}

function mapProducts(rows) {
  return rows.map(mapProduct);
}

async function create(data) {
  const res = await query(
    `INSERT INTO products
       (name, stone_category, stone_color, finish, thickness_options, default_unit_price, status,
        allows_direct_approval)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      data.name, data.stoneCategory, data.stoneColor, data.finish,
      JSON.stringify(data.thicknessOptions), data.defaultUnitPrice, data.status,
      data.allowsDirectApproval ? 1 : 0,
    ]
  );
  return findById(res.insertId);
}

async function findById(id) {
  const rows = await query(`SELECT ${COLUMNS} FROM products WHERE id = ?`, [id]);
  return mapProduct(rows[0]);
}

async function findByIds(ids) {
  if (!ids.length) return [];
  const rows = await query(`SELECT ${COLUMNS} FROM products WHERE id IN (?)`, [ids]);
  return mapProducts(rows);
}

async function findByName(name) {
  const rows = await query(`SELECT ${COLUMNS} FROM products WHERE name = ?`, [name]);
  return mapProduct(rows[0]);
}

async function list({ search, stoneCategory, finish, status, sort, limit, offset }) {
  const conditions = [];
  const params = [];

  if (stoneCategory) {
    conditions.push('stone_category = ?');
    params.push(stoneCategory);
  }
  if (finish) {
    conditions.push('finish = ?');
    params.push(finish);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(name LIKE ? OR stone_color LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countRows = await query(`SELECT COUNT(*) AS total FROM products ${where}`, params);
  const rows = await query(
    `SELECT ${COLUMNS} FROM products ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return { data: mapProducts(rows), total: countRows[0].total };
}

async function update(id, data) {
  await query(
    `UPDATE products SET
       name = ?, stone_category = ?, stone_color = ?, finish = ?,
       thickness_options = ?, default_unit_price = ?, status = ?, allows_direct_approval = ?
     WHERE id = ?`,
    [
      data.name, data.stoneCategory, data.stoneColor, data.finish,
      JSON.stringify(data.thicknessOptions), data.defaultUnitPrice, data.status,
      data.allowsDirectApproval ? 1 : 0, id,
    ]
  );
  return findById(id);
}

async function setStatus(id, status) {
  await query('UPDATE products SET status = ? WHERE id = ?', [status, id]);
  return findById(id);
}

async function remove(id) {
  const res = await query('DELETE FROM products WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

async function isUsedInProformas(id) {
  const rows = await query('SELECT 1 FROM proforma_items WHERE product_id = ? LIMIT 1', [id]);
  return rows.length > 0;
}

module.exports = {
  create, findById, findByIds, findByName, list, update, setStatus, remove, isUsedInProformas,
};
