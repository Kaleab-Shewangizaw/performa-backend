const { query } = require('../config/db');
const { mapRow } = require('../utils/rowMapper');

const COLUMNS = `key, company_name, company_address, company_phone, company_email,
                 company_website, logo_url, currency, default_vat_rate,
                 default_payment_terms, default_validity_days, proforma_prefix,
                 created_at, updated_at`;

const FIELD_TO_COLUMN = {
  companyName: 'company_name',
  companyAddress: 'company_address',
  companyPhone: 'company_phone',
  companyEmail: 'company_email',
  companyWebsite: 'company_website',
  logoUrl: 'logo_url',
  currency: 'currency',
  defaultVatRate: 'default_vat_rate',
  defaultPaymentTerms: 'default_payment_terms',
  defaultValidityDays: 'default_validity_days',
  proformaPrefix: 'proforma_prefix',
};

// Returns the single settings row, creating it with defaults on first access.
async function get() {
  const { rows } = await query(`SELECT ${COLUMNS} FROM settings WHERE key = 'global'`);
  if (rows[0]) return mapRow(rows[0]);

  const { rows: created } = await query(
    `INSERT INTO settings (key) VALUES ('global')
     ON CONFLICT (key) DO UPDATE SET key = 'global'
     RETURNING ${COLUMNS}`
  );
  return mapRow(created[0]);
}

async function update(data) {
  await get(); // ensure the row exists

  const sets = [];
  const params = [];
  for (const [field, column] of Object.entries(FIELD_TO_COLUMN)) {
    if (data[field] !== undefined) {
      params.push(data[field]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (!sets.length) return get();

  const { rows } = await query(
    `UPDATE settings SET ${sets.join(', ')}, updated_at = now()
     WHERE key = 'global' RETURNING ${COLUMNS}`,
    params
  );
  return mapRow(rows[0]);
}

module.exports = { get, update };
