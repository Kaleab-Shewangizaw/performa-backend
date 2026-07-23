// Postgres returns snake_case columns and NUMERIC as strings; the API speaks
// camelCase with real numbers. These helpers do that translation in one place.

function toCamel(str) {
  return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

// Column names whose NUMERIC/string values should surface as JS numbers.
const NUMERIC_COLUMNS = new Set([
  'subtotal', 'discount', 'vat_rate', 'vat_amount', 'grand_total',
  'default_unit_price', 'unit_price', 'line_total', 'area', 'total_length',
  'length', 'width', 'thickness', 'default_vat_rate',
]);

function mapRow(row) {
  if (!row) return null;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[toCamel(key)] = NUMERIC_COLUMNS.has(key) && value !== null ? Number(value) : value;
  }
  return out;
}

function mapRows(rows) {
  return rows.map(mapRow);
}

module.exports = { mapRow, mapRows, toCamel };
