// Production view of an approved proforma for factory workers: everything they
// need to cut and finish the job, with all commercial pricing removed. Money
// lives only on the sales side; the factory floor never sees it.

const PROFORMA_MONEY_FIELDS = ['subtotal', 'discount', 'vatRate', 'vatAmount', 'grandTotal'];
const ITEM_MONEY_FIELDS = ['unitPrice', 'lineTotal'];

function omit(obj, keys) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!keys.includes(k)) out[k] = v;
  }
  return out;
}

// Accepts a proforma as shaped by proforma.model and returns a copy safe to
// send to a factory worker.
function toOrderView(proforma) {
  if (!proforma) return null;
  const view = omit(proforma, PROFORMA_MONEY_FIELDS);
  view.items = (proforma.items || []).map((item) => omit(item, ITEM_MONEY_FIELDS));
  return view;
}

module.exports = { toOrderView };
