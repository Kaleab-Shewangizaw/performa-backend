const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const proformaModel = require('../models/proforma.model');
const approvalHistoryModel = require('../models/approvalHistory.model');
const settingModel = require('../models/setting.model');
const proformaService = require('../services/proforma.service');
const { renderProformaPdf } = require('../services/pdf.service');
const { parsePagination, parseSort, buildPagination } = require('../utils/query');

const SORTABLE = {
  proformaNumber: 'p.proforma_number',
  issueDate: 'p.issue_date',
  grandTotal: 'p.grand_total',
  status: 'p.status',
  createdAt: 'p.created_at',
};

async function findProforma(id) {
  const proforma = await proformaModel.findById(id);
  if (!proforma) throw new ApiError(404, 'Proforma not found');
  return proforma;
}

function assertCanView(user, proforma) {
  if (user.role === 'sales' && proforma.salesPerson.id !== user.id) {
    throw new ApiError(403, 'You do not have access to this proforma');
  }
}

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const sort = parseSort(req.query, SORTABLE, 'p.created_at DESC');

  // Sales only ever see their own proformas.
  const salesPersonId =
    req.user.role === 'sales' ? req.user.id : req.query.salesPerson || undefined;

  const { data, total } = await proformaModel.list({
    salesPersonId,
    status: req.query.status,
    customerId: req.query.customer,
    search: req.query.q,
    from: req.query.from,
    to: req.query.to,
    sort,
    limit,
    offset,
  });
  res.json({ proformas: data, pagination: buildPagination({ page, limit, total }) });
});

const create = asyncHandler(async (req, res) => {
  const proforma = await proformaService.createProforma(req.body, req.user);
  res.status(201).json({ proforma });
});

const getOne = asyncHandler(async (req, res) => {
  const proforma = await findProforma(req.params.id);
  assertCanView(req.user, proforma);
  res.json({ proforma });
});

const update = asyncHandler(async (req, res) => {
  const proforma = await findProforma(req.params.id);
  assertCanView(req.user, proforma);
  const updated = await proformaService.updateProforma(proforma, req.body, req.user);
  res.json({ proforma: updated });
});

const submit = asyncHandler(async (req, res) => {
  const proforma = await findProforma(req.params.id);
  assertCanView(req.user, proforma);
  const updated = await proformaService.submitProforma(proforma, req.user);
  res.json({ proforma: updated });
});

const approve = asyncHandler(async (req, res) => {
  const proforma = await findProforma(req.params.id);
  const { comment } = req.body;

  let updated;
  if (req.user.role === 'supervisor') {
    updated = await proformaService.supervisorApprove(proforma, req.user, comment);
  } else if (req.user.role === 'admin') {
    updated = await proformaService.adminApprove(proforma, req.user, comment);
  } else {
    throw new ApiError(403, 'Only supervisors and admins can approve proformas');
  }
  res.json({ proforma: updated });
});

const reject = asyncHandler(async (req, res) => {
  const proforma = await findProforma(req.params.id);
  const updated = await proformaService.reject(proforma, req.user, req.body.reason);
  res.json({ proforma: updated });
});

const remove = asyncHandler(async (req, res) => {
  const proforma = await findProforma(req.params.id);

  if (req.user.role === 'sales') {
    assertCanView(req.user, proforma);
    if (proforma.status !== 'draft') {
      throw new ApiError(403, 'Only draft proformas can be deleted');
    }
  } else if (req.user.role !== 'admin') {
    throw new ApiError(403, 'You do not have permission to delete proformas');
  }

  // Items and history cascade via FK ON DELETE CASCADE.
  await proformaModel.remove(proforma.id);
  res.status(204).send();
});

const history = asyncHandler(async (req, res) => {
  const proforma = await findProforma(req.params.id);
  assertCanView(req.user, proforma);
  const entries = await approvalHistoryModel.listForProforma(proforma.id);
  res.json({ history: entries });
});

const pdf = asyncHandler(async (req, res) => {
  const proforma = await findProforma(req.params.id);
  assertCanView(req.user, proforma);
  const settings = await settingModel.get();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${proforma.proformaNumber}.pdf"`);
  await renderProformaPdf(proforma, settings, res);
});

module.exports = { list, create, getOne, update, submit, approve, reject, remove, history, pdf };
