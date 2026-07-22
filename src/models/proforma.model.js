const { query, withTransaction } = require('../config/db');
const { mapRow, mapRows } = require('../utils/rowMapper');

const ITEM_COLUMNS = `id, product_id, product_name, stone_category, stone_color, finish,
                      width, height, area, thickness, quantity, unit_price, line_total`;

// Reads join customer/sales-person/approver rows and nest them, matching the
// shape the API has always returned (customer: {...}, salesPerson: {...}).
const SELECT_WITH_RELATIONS = `
  SELECT p.*,
         row_to_json(c.*) AS customer,
         json_build_object('id', sp.id, 'name', sp.name, 'email', sp.email, 'role', sp.role) AS sales_person,
         CASE WHEN sa.id IS NULL THEN NULL
              ELSE json_build_object('id', sa.id, 'name', sa.name, 'email', sa.email) END AS supervisor_approved_by,
         CASE WHEN aa.id IS NULL THEN NULL
              ELSE json_build_object('id', aa.id, 'name', aa.name, 'email', aa.email) END AS admin_approved_by
    FROM proformas p
    JOIN customers c ON c.id = p.customer_id
    JOIN users sp ON sp.id = p.sales_person_id
    LEFT JOIN users sa ON sa.id = p.supervisor_approved_by
    LEFT JOIN users aa ON aa.id = p.admin_approved_by
`;

function shape(row, items) {
  if (!row) return null;
  const p = mapRow(row);
  // customer arrives as raw JSON with snake_case keys; normalize it too.
  p.customer = mapRow(p.customer);
  p.items = items || [];
  return p;
}

async function insertItems(client, proformaId, items) {
  let order = 0;
  for (const item of items) {
    await client.query(
      `INSERT INTO proforma_items
         (proforma_id, product_id, product_name, stone_category, stone_color, finish,
          width, height, area, thickness, quantity, unit_price, line_total, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        proformaId, item.productId, item.productName, item.stoneCategory, item.stoneColor,
        item.finish, item.width, item.height, item.area, item.thickness, item.quantity,
        item.unitPrice, item.lineTotal, order++,
      ]
    );
  }
}

async function create(data) {
  const id = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO proformas
         (proforma_number, customer_id, sales_person_id, issue_date, expiry_date,
          subtotal, discount, vat_rate, vat_amount, grand_total,
          payment_terms, delivery_time, validity_period, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        data.proformaNumber, data.customerId, data.salesPersonId, data.issueDate, data.expiryDate,
        data.subtotal, data.discount, data.vatRate, data.vatAmount, data.grandTotal,
        data.paymentTerms, data.deliveryTime, data.validityPeriod, data.notes, data.status,
      ]
    );
    const proformaId = rows[0].id;
    await insertItems(client, proformaId, data.items);
    return proformaId;
  });
  return findById(id);
}

async function findById(id) {
  const { rows } = await query(`${SELECT_WITH_RELATIONS} WHERE p.id = $1`, [id]);
  if (!rows[0]) return null;
  const items = await findItems(id);
  return shape(rows[0], items);
}

async function findItems(proformaId) {
  const { rows } = await query(
    `SELECT ${ITEM_COLUMNS} FROM proforma_items WHERE proforma_id = $1 ORDER BY sort_order`,
    [proformaId]
  );
  // product_id is exposed as `product` for API compatibility with the old schema.
  return mapRows(rows).map(({ productId, ...rest }) => ({ ...rest, product: productId }));
}

async function list({ salesPersonId, status, customerId, search, from, to, sort, limit, offset }) {
  const conditions = [];
  const params = [];

  if (salesPersonId) {
    params.push(salesPersonId);
    conditions.push(`p.sales_person_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`p.status = $${params.length}`);
  }
  if (customerId) {
    params.push(customerId);
    conditions.push(`p.customer_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`p.proforma_number ILIKE $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`p.issue_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`p.issue_date <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM proformas p ${where}`,
    params
  );

  params.push(limit, offset);
  const { rows } = await query(
    `${SELECT_WITH_RELATIONS} ${where}
     ORDER BY ${sort} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  // Attach items for every listed proforma in one round-trip.
  const ids = rows.map((r) => r.id);
  const itemsById = new Map(ids.map((id) => [id, []]));
  if (ids.length) {
    const { rows: itemRows } = await query(
      `SELECT proforma_id, ${ITEM_COLUMNS} FROM proforma_items
       WHERE proforma_id = ANY($1::int[]) ORDER BY proforma_id, sort_order`,
      [ids]
    );
    for (const raw of mapRows(itemRows)) {
      const { proformaId, productId, ...rest } = raw;
      itemsById.get(proformaId).push({ ...rest, product: productId });
    }
  }

  return {
    data: rows.map((row) => shape(row, itemsById.get(row.id))),
    total: countRows[0].total,
  };
}

async function replaceItemsAndTotals(id, data) {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE proformas SET
         customer_id = $2, issue_date = $3, expiry_date = $4,
         subtotal = $5, discount = $6, vat_rate = $7, vat_amount = $8, grand_total = $9,
         payment_terms = $10, delivery_time = $11, validity_period = $12, notes = $13,
         status = $14, rejection_reason = $15, updated_at = now()
       WHERE id = $1`,
      [
        id, data.customerId, data.issueDate, data.expiryDate,
        data.subtotal, data.discount, data.vatRate, data.vatAmount, data.grandTotal,
        data.paymentTerms, data.deliveryTime, data.validityPeriod, data.notes,
        data.status, data.rejectionReason,
      ]
    );
    await client.query('DELETE FROM proforma_items WHERE proforma_id = $1', [id]);
    await insertItems(client, id, data.items);
  });
  return findById(id);
}

async function updateStatus(id, fields) {
  const sets = ['status = $2', 'updated_at = now()'];
  const params = [id, fields.status];

  if (fields.rejectionReason !== undefined) {
    params.push(fields.rejectionReason);
    sets.push(`rejection_reason = $${params.length}`);
  }
  if (fields.supervisorApprovedBy !== undefined) {
    params.push(fields.supervisorApprovedBy);
    sets.push(`supervisor_approved_by = $${params.length}`);
    sets.push(fields.supervisorApprovedBy === null
      ? 'supervisor_approved_at = NULL'
      : 'supervisor_approved_at = now()');
  }
  if (fields.adminApprovedBy !== undefined) {
    params.push(fields.adminApprovedBy);
    sets.push(`admin_approved_by = $${params.length}`);
    sets.push(fields.adminApprovedBy === null
      ? 'admin_approved_at = NULL'
      : 'admin_approved_at = now()');
  }

  await query(`UPDATE proformas SET ${sets.join(', ')} WHERE id = $1`, params);
  return findById(id);
}

async function remove(id) {
  const { rowCount } = await query('DELETE FROM proformas WHERE id = $1', [id]);
  return rowCount > 0;
}

async function nextNumber(prefix, year) {
  // ON CONFLICT ... DO UPDATE is atomic; safe under concurrency (PG 9.5+).
  const { rows } = await query(
    `INSERT INTO counters (key, seq) VALUES ($1, 1)
     ON CONFLICT (key) DO UPDATE SET seq = counters.seq + 1
     RETURNING seq`,
    [`proforma-${year}`]
  );
  return `${prefix}-${year}-${String(rows[0].seq).padStart(4, '0')}`;
}

// ---- aggregates used by dashboards ----

async function statusCounts(salesPersonId) {
  const params = [];
  let where = '';
  if (salesPersonId) {
    params.push(salesPersonId);
    where = 'WHERE sales_person_id = $1';
  }
  const { rows } = await query(
    `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(grand_total), 0) AS total
       FROM proformas ${where} GROUP BY status`,
    params
  );
  return rows.map((r) => ({ status: r.status, count: r.count, total: Number(r.total) }));
}

async function approvedRevenue() {
  const { rows } = await query(
    `SELECT COALESCE(SUM(grand_total), 0) AS revenue FROM proformas WHERE status = 'approved'`
  );
  return Number(rows[0].revenue);
}

async function monthlyRevenue(limit = 12) {
  const { rows } = await query(
    `SELECT EXTRACT(YEAR FROM issue_date)::int AS year,
            EXTRACT(MONTH FROM issue_date)::int AS month,
            SUM(grand_total) AS revenue,
            COUNT(*)::int AS count
       FROM proformas
      WHERE status = 'approved'
      GROUP BY year, month
      ORDER BY year, month
      LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    year: r.year, month: r.month, revenue: Number(r.revenue), count: r.count,
  }));
}

async function countApprovedBySupervisorSince(userId, since) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM proformas
      WHERE supervisor_approved_by = $1 AND supervisor_approved_at >= $2`,
    [userId, since]
  );
  return rows[0].count;
}

module.exports = {
  create,
  findById,
  findItems,
  list,
  replaceItemsAndTotals,
  updateStatus,
  remove,
  nextNumber,
  statusCounts,
  approvedRevenue,
  monthlyRevenue,
  countApprovedBySupervisorSince,
};
