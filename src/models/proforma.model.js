const { query, withTransaction } = require('../config/db');
const { mapRow, mapRows } = require('../utils/rowMapper');

const ITEM_COLUMNS = `id, item_type, description, product_id, product_name, stone_category,
                      stone_color, finish, length, width, area, total_length, thickness,
                      quantity, unit_price, line_total, remark`;

// Reads join customer/sales-person/approver rows and nest them as JSON objects
// (with camelCase keys), matching the shape the API has always returned. The
// computed objects get distinct aliases so they don't collide with p.* columns.
const SELECT_WITH_RELATIONS = `
  SELECT p.*,
         JSON_OBJECT('id', c.id, 'fullName', c.full_name, 'companyName', c.company_name,
                     'phone', c.phone, 'email', c.email, 'address', c.address, 'city', c.city,
                     'taxNumber', c.tax_number, 'notes', c.notes) AS customer_json,
         JSON_OBJECT('id', sp.id, 'name', sp.name, 'email', sp.email, 'role', sp.role) AS sales_person_json,
         CASE WHEN sa.id IS NULL THEN NULL
              ELSE JSON_OBJECT('id', sa.id, 'name', sa.name, 'email', sa.email) END AS supervisor_json,
         CASE WHEN aa.id IS NULL THEN NULL
              ELSE JSON_OBJECT('id', aa.id, 'name', aa.name, 'email', aa.email) END AS admin_json,
         CASE WHEN cs.id IS NULL THEN NULL
              ELSE JSON_OBJECT('id', cs.id, 'name', cs.name) END AS current_step_json
    FROM proformas p
    JOIN customers c ON c.id = p.customer_id
    JOIN users sp ON sp.id = p.sales_person_id
    LEFT JOIN users sa ON sa.id = p.supervisor_approved_by
    LEFT JOIN users aa ON aa.id = p.admin_approved_by
    LEFT JOIN order_steps cs ON cs.id = p.current_step_id
`;

function parseJson(v) {
  return typeof v === 'string' ? JSON.parse(v) : v;
}

function shape(row, items) {
  if (!row) return null;
  const p = mapRow(row);
  p.customer = parseJson(p.customerJson);
  p.salesPerson = parseJson(p.salesPersonJson);
  p.supervisorApprovedBy = parseJson(p.supervisorJson);
  p.adminApprovedBy = parseJson(p.adminJson);
  p.currentStep = parseJson(p.currentStepJson);
  delete p.customerJson;
  delete p.salesPersonJson;
  delete p.supervisorJson;
  delete p.adminJson;
  delete p.currentStepJson;
  p.items = items || [];
  return p;
}

async function insertItems(tx, proformaId, items) {
  let order = 0;
  for (const item of items) {
    await tx.query(
      `INSERT INTO proforma_items
         (proforma_id, item_type, description, product_id, product_name, stone_category,
          stone_color, finish, length, width, area, total_length, thickness, quantity,
          unit_price, line_total, remark, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        proformaId, item.itemType, item.description, item.productId, item.productName,
        item.stoneCategory, item.stoneColor, item.finish, item.length, item.width,
        item.area, item.totalLength, item.thickness, item.quantity, item.unitPrice,
        item.lineTotal, item.remark, order++,
      ]
    );
  }
}

async function create(data) {
  const id = await withTransaction(async (tx) => {
    const res = await tx.query(
      `INSERT INTO proformas
         (proforma_number, customer_id, sales_person_id, issue_date, expiry_date,
          subtotal, discount, vat_rate, vat_amount, grand_total,
          payment_terms, delivery_time, validity_period, notes, status,
          order_number, material_type, ordered_by, ordered_date, project_name,
          total_weight, remark, auto_approved)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        data.proformaNumber, data.customerId, data.salesPersonId, data.issueDate, data.expiryDate,
        data.subtotal, data.discount, data.vatRate, data.vatAmount, data.grandTotal,
        data.paymentTerms, data.deliveryTime, data.validityPeriod, data.notes, data.status,
        data.orderNumber, data.materialType, data.orderedBy, data.orderedDate, data.projectName,
        data.totalWeight, data.remark, data.autoApproved ? 1 : 0,
      ]
    );
    const proformaId = res.insertId;
    await insertItems(tx, proformaId, data.items);
    return proformaId;
  });
  return findById(id);
}

async function findById(id) {
  const rows = await query(`${SELECT_WITH_RELATIONS} WHERE p.id = ?`, [id]);
  if (!rows[0]) return null;
  const items = await findItems(id);
  return shape(rows[0], items);
}

async function findItems(proformaId) {
  const rows = await query(
    `SELECT ${ITEM_COLUMNS} FROM proforma_items WHERE proforma_id = ? ORDER BY sort_order`,
    [proformaId]
  );
  // product_id is exposed as `product` for API compatibility.
  return mapRows(rows).map(({ productId, ...rest }) => ({ ...rest, product: productId }));
}

async function list({ salesPersonId, status, customerId, search, from, to, sentToFactory, sort, limit, offset }) {
  const conditions = [];
  const params = [];

  if (salesPersonId) {
    conditions.push('p.sales_person_id = ?');
    params.push(salesPersonId);
  }
  // "Sent to factory" = the order has entered the production pipeline.
  if (sentToFactory === true) {
    conditions.push('p.current_step_id IS NOT NULL');
  } else if (sentToFactory === false) {
    conditions.push('p.current_step_id IS NULL');
  }
  if (status) {
    conditions.push('p.status = ?');
    params.push(status);
  }
  if (customerId) {
    conditions.push('p.customer_id = ?');
    params.push(customerId);
  }
  if (search) {
    conditions.push('p.proforma_number LIKE ?');
    params.push(`%${search}%`);
  }
  if (from) {
    conditions.push('p.issue_date >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('p.issue_date <= ?');
    params.push(to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countRows = await query(`SELECT COUNT(*) AS total FROM proformas p ${where}`, params);
  const rows = await query(
    `${SELECT_WITH_RELATIONS} ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Attach items for every listed proforma in one round-trip.
  const ids = rows.map((r) => r.id);
  const itemsById = new Map(ids.map((id) => [id, []]));
  if (ids.length) {
    const itemRows = await query(
      `SELECT proforma_id, ${ITEM_COLUMNS} FROM proforma_items
       WHERE proforma_id IN (?) ORDER BY proforma_id, sort_order`,
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
  await withTransaction(async (tx) => {
    await tx.query(
      `UPDATE proformas SET
         customer_id = ?, issue_date = ?, expiry_date = ?,
         subtotal = ?, discount = ?, vat_rate = ?, vat_amount = ?, grand_total = ?,
         payment_terms = ?, delivery_time = ?, validity_period = ?, notes = ?,
         status = ?, rejection_reason = ?,
         order_number = ?, material_type = ?, ordered_by = ?, ordered_date = ?,
         project_name = ?, total_weight = ?, remark = ?
       WHERE id = ?`,
      [
        data.customerId, data.issueDate, data.expiryDate,
        data.subtotal, data.discount, data.vatRate, data.vatAmount, data.grandTotal,
        data.paymentTerms, data.deliveryTime, data.validityPeriod, data.notes,
        data.status, data.rejectionReason,
        data.orderNumber, data.materialType, data.orderedBy, data.orderedDate,
        data.projectName, data.totalWeight, data.remark, id,
      ]
    );
    await tx.query('DELETE FROM proforma_items WHERE proforma_id = ?', [id]);
    await insertItems(tx, id, data.items);
  });
  return findById(id);
}

async function updateStatus(id, fields) {
  const sets = ['status = ?'];
  const params = [fields.status];

  if (fields.rejectionReason !== undefined) {
    sets.push('rejection_reason = ?');
    params.push(fields.rejectionReason);
  }
  if (fields.supervisorApprovedBy !== undefined) {
    sets.push('supervisor_approved_by = ?');
    params.push(fields.supervisorApprovedBy);
    sets.push(fields.supervisorApprovedBy === null
      ? 'supervisor_approved_at = NULL'
      : 'supervisor_approved_at = NOW()');
  }
  if (fields.adminApprovedBy !== undefined) {
    sets.push('admin_approved_by = ?');
    params.push(fields.adminApprovedBy);
    sets.push(fields.adminApprovedBy === null
      ? 'admin_approved_at = NULL'
      : 'admin_approved_at = NOW()');
  }
  if (fields.autoApproved !== undefined) {
    sets.push('auto_approved = ?');
    params.push(fields.autoApproved ? 1 : 0);
  }

  params.push(id);
  await query(`UPDATE proformas SET ${sets.join(', ')} WHERE id = ?`, params);
  return findById(id);
}

async function remove(id) {
  const res = await query('DELETE FROM proformas WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

// Moves the order's tracking pointer. Pass null to clear it (e.g. when an
// approved order is rejected back out of production).
async function setCurrentStep(id, stepId) {
  await query('UPDATE proformas SET current_step_id = ? WHERE id = ?', [stepId, id]);
  return findById(id);
}

// Minimal row for the public tracking lookup: enough to verify the phone and
// render a status, and nothing more. Matches on the proforma number, or on a
// non-empty order number. The customer phone is returned for verification only
// — the tracking service compares it and never exposes it.
async function findByNumberForTracking(number) {
  const rows = await query(
    `SELECT p.id, p.proforma_number, p.order_number, p.project_name, p.status,
            p.current_step_id, p.updated_at, c.phone AS customer_phone
       FROM proformas p
       JOIN customers c ON c.id = p.customer_id
      WHERE p.proforma_number = ?
         OR (p.order_number <> '' AND p.order_number = ?)
      LIMIT 1`,
    [number, number]
  );
  return mapRow(rows[0]);
}

// Atomic per-year sequence via the LAST_INSERT_ID() trick.
async function nextNumber(prefix, year) {
  const res = await query(
    'INSERT INTO counters (`key`, seq) VALUES (?, LAST_INSERT_ID(1)) ' +
      'ON DUPLICATE KEY UPDATE seq = LAST_INSERT_ID(seq + 1)',
    [`proforma-${year}`]
  );
  const seq = res.insertId;
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

// Plain running count backing the "Order No." field — no prefix or year, just
// the next whole number after the last one handed out. Seeded from existing
// proformas by migration 004 so it continues rather than restarting at 1.
async function nextOrderNumber() {
  const res = await query(
    'INSERT INTO counters (`key`, seq) VALUES (?, LAST_INSERT_ID(1)) ' +
      'ON DUPLICATE KEY UPDATE seq = LAST_INSERT_ID(seq + 1)',
    ['order-number']
  );
  return String(res.insertId);
}

// Read-only preview of the next order number, for the create form to display
// before the proforma actually exists. Does not consume the sequence.
async function peekNextOrderNumber() {
  const rows = await query('SELECT seq FROM counters WHERE `key` = ?', ['order-number']);
  return String((rows[0]?.seq ?? 0) + 1);
}

// ---- aggregates used by dashboards ----

async function statusCounts(salesPersonId) {
  const params = [];
  let where = '';
  if (salesPersonId) {
    where = 'WHERE sales_person_id = ?';
    params.push(salesPersonId);
  }
  const rows = await query(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(grand_total), 0) AS total
       FROM proformas ${where} GROUP BY status`,
    params
  );
  return rows.map((r) => ({ status: r.status, count: Number(r.count), total: Number(r.total) }));
}

async function approvedRevenue() {
  const rows = await query(
    "SELECT COALESCE(SUM(grand_total), 0) AS revenue FROM proformas WHERE status = 'approved'"
  );
  return Number(rows[0].revenue);
}

async function monthlyRevenue(limit = 12) {
  const rows = await query(
    `SELECT YEAR(issue_date) AS year, MONTH(issue_date) AS month,
            SUM(grand_total) AS revenue, COUNT(*) AS count
       FROM proformas
      WHERE status = 'approved'
      GROUP BY YEAR(issue_date), MONTH(issue_date)
      ORDER BY year, month
      LIMIT ?`,
    [limit]
  );
  return rows.map((r) => ({
    year: Number(r.year), month: Number(r.month), revenue: Number(r.revenue), count: Number(r.count),
  }));
}

async function countApprovedBySupervisorSince(userId, since) {
  const rows = await query(
    `SELECT COUNT(*) AS count FROM proformas
      WHERE supervisor_approved_by = ? AND supervisor_approved_at >= ?`,
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
  setCurrentStep,
  findByNumberForTracking,
  nextNumber,
  nextOrderNumber,
  peekNextOrderNumber,
  statusCounts,
  approvedRevenue,
  monthlyRevenue,
  countApprovedBySupervisorSince,
};
