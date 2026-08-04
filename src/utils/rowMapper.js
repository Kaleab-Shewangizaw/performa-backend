// MySQL returns snake_case columns; the API speaks camelCase. It also returns
// DECIMAL as strings and TINYINT(1) as 0/1, so those are coerced here in one
// place. (JSON columns are parsed explicitly in the models that use them,
// because MariaDB reports JSON as LONGTEXT and won't auto-parse.)

function toCamel(str) {
  return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

// DECIMAL columns that should surface as JS numbers.
const NUMERIC_COLUMNS = new Set([
  'subtotal', 'discount', 'vat_rate', 'vat_amount', 'grand_total',
  'default_unit_price', 'unit_price', 'line_total', 'area', 'total_length',
  'length', 'width', 'thickness', 'default_vat_rate',
]);

// TINYINT(1) columns that should surface as booleans.
const BOOLEAN_COLUMNS = new Set([
  'is_active', 'read', 'allows_direct_approval', 'auto_approved',
]);

function mapRow(row) {
  if (!row) return null;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    let v = value;
    if (value !== null) {
      if (NUMERIC_COLUMNS.has(key)) v = Number(value);
      else if (BOOLEAN_COLUMNS.has(key)) v = Boolean(value);
    }
    out[toCamel(key)] = v;
  }
  return out;
}

function mapRows(rows) {
  return rows.map(mapRow);
}

module.exports = { mapRow, mapRows, toCamel };
