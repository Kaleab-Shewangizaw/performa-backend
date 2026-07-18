const ApiError = require('../utils/apiError');
const Proforma = require('../models/proforma.model');
const Product = require('../models/product.model');
const Customer = require('../models/customer.model');
const Counter = require('../models/counter.model');
const Setting = require('../models/setting.model');
const ApprovalHistory = require('../models/approvalHistory.model');
const notificationService = require('./notification.service');
const { EDITABLE_STATUSES } = require('../utils/constants');

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Builds embedded item docs from request items, denormalizing product data
// and computing area + line totals server-side.
async function buildItems(items) {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: productIds } });
  const byId = new Map(products.map((p) => [p.id, p]));

  return items.map((item) => {
    const product = byId.get(item.productId);
    if (!product) throw new ApiError(400, `Product ${item.productId} not found`);
    if (product.status !== 'active') {
      throw new ApiError(400, `Product "${product.name}" is inactive`);
    }
    if (!product.thicknessOptions.includes(item.thickness)) {
      throw new ApiError(
        400,
        `Thickness ${item.thickness}mm is not available for "${product.name}"`
      );
    }
    const area = round2(item.width * item.height);
    const unitPrice = item.unitPrice ?? product.defaultUnitPrice;
    return {
      product: product._id,
      productName: product.name,
      stoneCategory: product.stoneCategory,
      stoneColor: product.stoneColor,
      finish: product.finish,
      width: item.width,
      height: item.height,
      area,
      thickness: item.thickness,
      quantity: item.quantity,
      unitPrice,
      lineTotal: round2(area * item.quantity * unitPrice),
    };
  });
}

function computeTotals(items, discount, vatRate) {
  const subtotal = round2(items.reduce((sum, i) => sum + i.lineTotal, 0));
  const cappedDiscount = Math.min(discount, subtotal);
  const taxable = round2(subtotal - cappedDiscount);
  const vatAmount = round2(taxable * (vatRate / 100));
  const grandTotal = round2(taxable + vatAmount);
  return { subtotal, discount: cappedDiscount, vatAmount, grandTotal };
}

async function nextProformaNumber() {
  const settings = await Setting.get();
  const year = new Date().getFullYear();
  const seq = await Counter.next(`proforma-${year}`);
  return `${settings.proformaPrefix}-${year}-${String(seq).padStart(4, '0')}`;
}

async function createProforma(data, user) {
  const customer = await Customer.findById(data.customerId);
  if (!customer) throw new ApiError(400, 'Customer not found');

  const settings = await Setting.get();
  const items = await buildItems(data.items);
  const vatRate = data.vatRate ?? settings.defaultVatRate;
  const totals = computeTotals(items, data.discount || 0, vatRate);

  const issueDate = data.issueDate ? new Date(data.issueDate) : new Date();
  const expiryDate = data.expiryDate
    ? new Date(data.expiryDate)
    : new Date(issueDate.getTime() + settings.defaultValidityDays * 86400000);

  const proforma = await Proforma.create({
    proformaNumber: await nextProformaNumber(),
    customer: customer._id,
    salesPerson: user.id,
    issueDate,
    expiryDate,
    items,
    vatRate,
    ...totals,
    paymentTerms: data.paymentTerms ?? settings.defaultPaymentTerms,
    deliveryTime: data.deliveryTime || '',
    validityPeriod: data.validityPeriod || `${settings.defaultValidityDays} days`,
    notes: data.notes || '',
    status: data.asDraft ? 'draft' : 'pending',
  });

  await ApprovalHistory.create({
    proforma: proforma._id,
    action: data.asDraft ? 'created' : 'submitted',
    actor: user.id,
  });

  return proforma.populate(['customer', 'salesPerson']);
}

function assertEditable(proforma, user) {
  if (user.role === 'sales') {
    if (String(proforma.salesPerson._id || proforma.salesPerson) !== String(user.id)) {
      throw new ApiError(403, 'You can only edit your own proformas');
    }
    if (!EDITABLE_STATUSES.includes(proforma.status)) {
      throw new ApiError(403, 'This proforma has been approved and can no longer be edited');
    }
  }
}

async function updateProforma(proforma, data, user) {
  assertEditable(proforma, user);

  if (data.customerId) {
    const customer = await Customer.findById(data.customerId);
    if (!customer) throw new ApiError(400, 'Customer not found');
    proforma.customer = customer._id;
  }

  const items = await buildItems(data.items);
  const vatRate = data.vatRate ?? proforma.vatRate;
  const totals = computeTotals(items, data.discount || 0, vatRate);

  Object.assign(proforma, {
    items,
    vatRate,
    ...totals,
    issueDate: data.issueDate ? new Date(data.issueDate) : proforma.issueDate,
    expiryDate: data.expiryDate ? new Date(data.expiryDate) : proforma.expiryDate,
    paymentTerms: data.paymentTerms ?? proforma.paymentTerms,
    deliveryTime: data.deliveryTime ?? proforma.deliveryTime,
    validityPeriod: data.validityPeriod ?? proforma.validityPeriod,
    notes: data.notes ?? proforma.notes,
  });

  // A rejected proforma that gets edited goes back to pending review;
  // a draft can be submitted explicitly.
  if (proforma.status === 'rejected') {
    proforma.status = 'pending';
    proforma.rejectionReason = '';
  }
  if (proforma.status === 'draft' && data.submit) {
    proforma.status = 'pending';
  }

  await proforma.save();
  await ApprovalHistory.create({
    proforma: proforma._id,
    action: proforma.status === 'pending' && data.submit ? 'submitted' : 'updated',
    actor: user.id,
  });

  return proforma.populate(['customer', 'salesPerson']);
}

async function submitProforma(proforma, user) {
  if (user.role === 'sales' && String(proforma.salesPerson) !== String(user.id)) {
    throw new ApiError(403, 'You can only submit your own proformas');
  }
  if (proforma.status !== 'draft') {
    throw new ApiError(400, 'Only draft proformas can be submitted');
  }
  proforma.status = 'pending';
  await proforma.save();
  await ApprovalHistory.create({ proforma: proforma._id, action: 'submitted', actor: user.id });
  return proforma;
}

async function supervisorApprove(proforma, user, comment) {
  if (proforma.status !== 'pending') {
    throw new ApiError(400, `Cannot approve a proforma in "${proforma.status}" status`);
  }
  proforma.status = 'supervisor_approved';
  proforma.supervisorApprovedBy = user.id;
  proforma.supervisorApprovedAt = new Date();
  await proforma.save();

  await ApprovalHistory.create({
    proforma: proforma._id,
    action: 'supervisor_approved',
    actor: user.id,
    comment: comment || '',
  });
  await notificationService.notify(proforma.salesPerson, {
    type: 'proforma_supervisor_approved',
    message: `Proforma ${proforma.proformaNumber} was approved by supervisor`,
    proforma: proforma._id,
  });
  return proforma;
}

async function adminApprove(proforma, user, comment) {
  // Admin can approve from pending (override) or supervisor_approved (normal flow)
  if (!['pending', 'supervisor_approved'].includes(proforma.status)) {
    throw new ApiError(400, `Cannot approve a proforma in "${proforma.status}" status`);
  }
  proforma.status = 'approved';
  proforma.adminApprovedBy = user.id;
  proforma.adminApprovedAt = new Date();
  await proforma.save();

  await ApprovalHistory.create({
    proforma: proforma._id,
    action: 'admin_approved',
    actor: user.id,
    comment: comment || '',
  });
  await notificationService.notify(proforma.salesPerson, {
    type: 'proforma_admin_approved',
    message: `Proforma ${proforma.proformaNumber} received final approval`,
    proforma: proforma._id,
  });
  return proforma;
}

async function reject(proforma, user, reason) {
  const rejectable =
    user.role === 'admin'
      ? ['pending', 'supervisor_approved', 'approved']
      : ['pending'];
  if (!rejectable.includes(proforma.status)) {
    throw new ApiError(400, `Cannot reject a proforma in "${proforma.status}" status`);
  }
  proforma.status = 'rejected';
  proforma.rejectionReason = reason;
  proforma.supervisorApprovedBy = null;
  proforma.supervisorApprovedAt = null;
  proforma.adminApprovedBy = null;
  proforma.adminApprovedAt = null;
  await proforma.save();

  await ApprovalHistory.create({
    proforma: proforma._id,
    action: 'rejected',
    actor: user.id,
    comment: reason,
  });
  await notificationService.notify(proforma.salesPerson, {
    type: 'proforma_rejected',
    message: `Proforma ${proforma.proformaNumber} was rejected: ${reason}`,
    proforma: proforma._id,
  });
  return proforma;
}

module.exports = {
  createProforma,
  updateProforma,
  submitProforma,
  supervisorApprove,
  adminApprove,
  reject,
  round2,
};
