const { query } = require('../config/db');
const { mapRow } = require('../utils/rowMapper');

const COLUMNS = `\`key\`, company_name, company_address, company_phone, company_email,
                 company_website, logo_url, currency, default_vat_rate,
                 default_payment_terms, default_validity_days, proforma_prefix,
                 terms_and_conditions, products_offered, bank_details,
                 created_at, updated_at`;

const FIELD_MAP = {
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
  termsAndConditions: 'terms_and_conditions',
  productsOffered: 'products_offered',
  bankDetails: 'bank_details',
};

// Single 'global' row; created with column defaults on first read.
async function get() {
  let rows = await query(`SELECT ${COLUMNS} FROM settings WHERE \`key\` = 'global'`);
  if (!rows.length) {
    await query('INSERT INTO settings (`key`) VALUES (?)', ['global']);
    rows = await query(`SELECT ${COLUMNS} FROM settings WHERE \`key\` = 'global'`);
  }
  return mapRow(rows[0]);
}

async function update(patch) {
  const sets = [];
  const params = [];
  for (const [key, value] of Object.entries(patch)) {
    const column = FIELD_MAP[key];
    if (column) {
      sets.push(`${column} = ?`);
      params.push(value);
    }
  }
  if (sets.length) {
    await get(); // ensure the row exists
    await query(`UPDATE settings SET ${sets.join(', ')} WHERE \`key\` = 'global'`, params);
  }
  return get();
}

module.exports = { get, update };
