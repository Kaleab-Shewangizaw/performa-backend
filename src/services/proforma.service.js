const ApiError = require('../utils/apiError');
const proformaModel = require('../models/proforma.model');
const productModel = require('../models/product.model');
const customerModel = require('../models/customer.model');
const settingModel = require('../models/setting.model');
const approvalHistoryModel = require('../models/approvalHistory.model');
const notificationService = require('./notification.service');
const { EDITABLE_STATUSES } = require('../utils/constants');

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Measurements keep more precision than money: a 0.868 m² area must not
// become 0.87 before it is multiplied by the unit price.
function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

// Builds item rows from request items, denormalizing product data and
// computing lengths, areas and line totals server-side.
//
//   area items   : totalLength = length x qty      (running metres of stone)
//                  area        = length x width x qty  (m2, what is billed)
//                  lineTotal   = area x unitPrice
//   linear items : edge work (bullnose, groove) billed per metre of edge
//                  totalLength = length x qty
//                  lineTotal   = totalLength x unitPrice
async function buildItems(items) {
  const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))];
  const products = productIds.length ? await productModel.findByIds(productIds) : [];
  const byId = new Map(products.map((p) => [p.id, p]));

  return items.map((item) => {
    let product = null;
    if (item.productId) {
      product = byId.get(item.productId);
      if (!product) throw new ApiError(400, `Product ${item.productId} not found`);
      if (product.status !== 'active') {
        throw new ApiError(400, `Product "${product.name}" is inactive`);
      }
      if (item.thickness != null && !product.thicknessOptions.includes(item.thickness)) {
        throw new ApiError(
          400,
          `Thickness ${item.thickness}mm is not available for "${product.name}"`
        );
      }
    }

    const quantity = item.quantity || 1;
    const totalLength = round3(item.length * quantity);
    const isLinear = item.itemType === 'linear';
    const area = isLinear ? 0 : round4(item.length * item.width * quantity);
    const unitPrice = item.unitPrice ?? product?.defaultUnitPrice ?? 0;
    const lineTotal = round2((isLinear ? totalLength : area) * unitPrice);

    return {
      itemType: item.itemType,
      description: item.description,
      productId: product?.id ?? null,
      productName: product?.name ?? null,
      stoneCategory: product?.stoneCategory ?? null,
      stoneColor: product?.stoneColor ?? null,
      finish: product?.finish ?? null,
      length: item.length,
      width: isLinear ? null : item.width,
      area,
      totalLength,
      thickness: isLinear ? null : item.thickness,
      quantity,
      unitPrice,
      lineTotal,
      remark: item.remark || '',
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

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

// "Harer Granite"-style summary taken from the first catalogued line, used
// when the sales person doesn't type the material themselves.
function defaultMaterialType(items) {
  const withProduct = items.find((i) => i.productName);
  if (!withProduct) return '';
  return [withProduct.stoneColor, withProduct.stoneCategory].filter(Boolean).join(' ');
}

async function createProforma(data, user) {
  const customer = await customerModel.findById(data.customerId);
  if (!customer) throw new ApiError(400, 'Customer not found');

  const settings = await settingModel.get();
  const items = await buildItems(data.items);
  const vatRate = data.vatRate ?? settings.defaultVatRate;
  const totals = computeTotals(items, data.discount || 0, vatRate);

  const issueDate = data.issueDate ? new Date(data.issueDate) : new Date();
  const expiryDate = data.expiryDate
    ? new Date(data.expiryDate)
    : new Date(issueDate.getTime() + settings.defaultValidityDays * 86400000);

  const proformaNumber = await proformaModel.nextNumber(
    settings.proformaPrefix,
    new Date().getFullYear()
  );

  const proforma = await proformaModel.create({
    proformaNumber,
    customerId: customer.id,
    salesPersonId: user.id,
    issueDate: toDateOnly(issueDate),
    expiryDate: toDateOnly(expiryDate),
    items,
    vatRate,
    ...totals,
    paymentTerms: data.paymentTerms ?? settings.defaultPaymentTerms,
    deliveryTime: data.deliveryTime || '',
    validityPeriod: data.validityPeriod || `${settings.defaultValidityDays} days`,
    notes: data.notes || '',
    status: data.asDraft ? 'draft' : 'pending',
    orderNumber: data.orderNumber || '',
    // Falls back to the stone used on the first catalogued line.
    materialType: data.materialType || defaultMaterialType(items),
    orderedBy: data.orderedBy || customer.fullName,
    orderedDate: data.orderedDate || toDateOnly(issueDate),
    projectName: data.projectName || '',
    totalWeight: data.totalWeight || '',
    remark: data.remark || '',
  });

  await approvalHistoryModel.create({
    proformaId: proforma.id,
    action: data.asDraft ? 'created' : 'submitted',
    actorId: user.id,
  });

  return proforma;
}

function assertEditable(proforma, user) {
  if (user.role === 'sales') {
    if (proforma.salesPerson.id !== user.id) {
      throw new ApiError(403, 'You can only edit your own proformas');
    }
    if (!EDITABLE_STATUSES.includes(proforma.status)) {
      throw new ApiError(403, 'This proforma has been approved and can no longer be edited');
    }
  }
}

async function updateProforma(proforma, data, user) {
  assertEditable(proforma, user);

  let customerId = proforma.customerId;
  if (data.customerId) {
    const customer = await customerModel.findById(data.customerId);
    if (!customer) throw new ApiError(400, 'Customer not found');
    customerId = customer.id;
  }

  const items = await buildItems(data.items);
  const vatRate = data.vatRate ?? proforma.vatRate;
  const totals = computeTotals(items, data.discount || 0, vatRate);

  // A rejected proforma that gets edited goes back to pending review;
  // a draft is submitted only when explicitly asked.
  let status = proforma.status;
  let rejectionReason = proforma.rejectionReason;
  if (status === 'rejected') {
    status = 'pending';
    rejectionReason = '';
  } else if (status === 'draft' && data.submit) {
    status = 'pending';
  }

  const updated = await proformaModel.replaceItemsAndTotals(proforma.id, {
    customerId,
    issueDate: data.issueDate || toDateOnly(new Date(proforma.issueDate)),
    expiryDate: data.expiryDate || toDateOnly(new Date(proforma.expiryDate)),
    items,
    vatRate,
    ...totals,
    paymentTerms: data.paymentTerms ?? proforma.paymentTerms,
    deliveryTime: data.deliveryTime ?? proforma.deliveryTime,
    validityPeriod: data.validityPeriod ?? proforma.validityPeriod,
    notes: data.notes ?? proforma.notes,
    status,
    rejectionReason,
    orderNumber: data.orderNumber ?? proforma.orderNumber,
    materialType: data.materialType || defaultMaterialType(items),
    orderedBy: data.orderedBy ?? proforma.orderedBy,
    orderedDate: data.orderedDate || (proforma.orderedDate ? toDateOnly(new Date(proforma.orderedDate)) : null),
    projectName: data.projectName ?? proforma.projectName,
    totalWeight: data.totalWeight ?? proforma.totalWeight,
    remark: data.remark ?? proforma.remark,
  });

  await approvalHistoryModel.create({
    proformaId: proforma.id,
    action: status === 'pending' && data.submit ? 'submitted' : 'updated',
    actorId: user.id,
  });

  return updated;
}

async function submitProforma(proforma, user) {
  if (user.role === 'sales' && proforma.salesPerson.id !== user.id) {
    throw new ApiError(403, 'You can only submit your own proformas');
  }
  if (proforma.status !== 'draft') {
    throw new ApiError(400, 'Only draft proformas can be submitted');
  }
  const updated = await proformaModel.updateStatus(proforma.id, { status: 'pending' });
  await approvalHistoryModel.create({
    proformaId: proforma.id, action: 'submitted', actorId: user.id,
  });
  return updated;
}

async function supervisorApprove(proforma, user, comment) {
  if (proforma.status !== 'pending') {
    throw new ApiError(400, `Cannot approve a proforma in "${proforma.status}" status`);
  }
  const updated = await proformaModel.updateStatus(proforma.id, {
    status: 'supervisor_approved',
    supervisorApprovedBy: user.id,
  });

  await approvalHistoryModel.create({
    proformaId: proforma.id, action: 'supervisor_approved', actorId: user.id, comment: comment || '',
  });
  await notificationService.notify(proforma.salesPerson.id, {
    type: 'proforma_supervisor_approved',
    message: `Proforma ${proforma.proformaNumber} was approved by supervisor`,
    proformaId: proforma.id,
  });
  return updated;
}

async function adminApprove(proforma, user, comment) {
  // Admin can approve from pending (override) or supervisor_approved (normal flow)
  if (!['pending', 'supervisor_approved'].includes(proforma.status)) {
    throw new ApiError(400, `Cannot approve a proforma in "${proforma.status}" status`);
  }
  const updated = await proformaModel.updateStatus(proforma.id, {
    status: 'approved',
    adminApprovedBy: user.id,
  });

  await approvalHistoryModel.create({
    proformaId: proforma.id, action: 'admin_approved', actorId: user.id, comment: comment || '',
  });
  await notificationService.notify(proforma.salesPerson.id, {
    type: 'proforma_admin_approved',
    message: `Proforma ${proforma.proformaNumber} received final approval`,
    proformaId: proforma.id,
  });
  return updated;
}

async function reject(proforma, user, reason) {
  const rejectable =
    user.role === 'admin'
      ? ['pending', 'supervisor_approved', 'approved']
      : ['pending'];
  if (!rejectable.includes(proforma.status)) {
    throw new ApiError(400, `Cannot reject a proforma in "${proforma.status}" status`);
  }

  const updated = await proformaModel.updateStatus(proforma.id, {
    status: 'rejected',
    rejectionReason: reason,
    supervisorApprovedBy: null,
    adminApprovedBy: null,
  });

  await approvalHistoryModel.create({
    proformaId: proforma.id, action: 'rejected', actorId: user.id, comment: reason,
  });
  await notificationService.notify(proforma.salesPerson.id, {
    type: 'proforma_rejected',
    message: `Proforma ${proforma.proformaNumber} was rejected: ${reason}`,
    proformaId: proforma.id,
  });
  return updated;
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
