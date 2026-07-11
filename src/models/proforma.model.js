const { pool, query } = require('../config/db');

function computeTotals(items, taxRate) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  return {
    subtotal: round2(subtotal),
    taxAmount: round2(taxAmount),
    total: round2(total),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function createProforma(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { subtotal, taxAmount, total } = computeTotals(data.items, data.taxRate);

    const { rows } = await client.query(
      `INSERT INTO proformas
        (title, client_name, client_email, client_address, issue_date, due_date,
         currency, tax_rate, subtotal, tax_amount, total, notes, owner_id)
       VALUES ($1,$2,$3,$4,COALESCE($5, CURRENT_DATE),$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        data.title,
        data.clientName,
        data.clientEmail || null,
        data.clientAddress || null,
        data.issueDate || null,
        data.dueDate || null,
        data.currency || 'USD',
        data.taxRate,
        subtotal,
        taxAmount,
        total,
        data.notes || null,
        data.ownerId,
      ]
    );
    const proforma = rows[0];

    await insertItems(client, proforma.id, data.items);

    await client.query('COMMIT');
    return getProformaById(proforma.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function insertItems(client, proformaId, items) {
  let order = 0;
  for (const item of items) {
    const amount = round2(item.quantity * item.unitPrice);
    await client.query(
      `INSERT INTO proforma_items (proforma_id, description, quantity, unit_price, amount, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [proformaId, item.description, item.quantity, item.unitPrice, amount, order++]
    );
  }
}

async function listProformas({ ownerId, status, limit = 50, offset = 0 }) {
  const conditions = [];
  const params = [];

  if (ownerId) {
    params.push(ownerId);
    conditions.push(`owner_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);
  params.push(offset);

  const { rows } = await query(
    `SELECT * FROM proformas ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function getProformaById(id) {
  const { rows } = await query('SELECT * FROM proformas WHERE id = $1', [id]);
  const proforma = rows[0];
  if (!proforma) return null;

  const { rows: items } = await query(
    'SELECT * FROM proforma_items WHERE proforma_id = $1 ORDER BY sort_order ASC',
    [id]
  );
  return { ...proforma, items };
}

async function updateProforma(id, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { subtotal, taxAmount, total } = computeTotals(data.items, data.taxRate);

    const { rows } = await client.query(
      `UPDATE proformas SET
        title = $2, client_name = $3, client_email = $4, client_address = $5,
        issue_date = $6, due_date = $7, currency = $8, tax_rate = $9,
        subtotal = $10, tax_amount = $11, total = $12, notes = $13, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.title,
        data.clientName,
        data.clientEmail || null,
        data.clientAddress || null,
        data.issueDate || null,
        data.dueDate || null,
        data.currency || 'USD',
        data.taxRate,
        subtotal,
        taxAmount,
        total,
        data.notes || null,
      ]
    );

    if (!rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query('DELETE FROM proforma_items WHERE proforma_id = $1', [id]);
    await insertItems(client, id, data.items);

    await client.query('COMMIT');
    return getProformaById(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateStatus(id, status) {
  const { rows } = await query(
    'UPDATE proformas SET status = $2, updated_at = now() WHERE id = $1 RETURNING *',
    [id, status]
  );
  return rows[0] || null;
}

async function deleteProforma(id) {
  const { rowCount } = await query('DELETE FROM proformas WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = {
  createProforma,
  listProformas,
  getProformaById,
  updateProforma,
  updateStatus,
  deleteProforma,
};
