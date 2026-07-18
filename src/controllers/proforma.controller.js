const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const Proforma = require('../models/proforma.model');
const ApprovalHistory = require('../models/approvalHistory.model');
const Setting = require('../models/setting.model');
const proformaService = require('../services/proforma.service');
const { renderProformaPdf } = require('../services/pdf.service');
const { parsePagination, parseSort, paginatedList, escapeRegex } = require('../utils/query');

const POPULATE = [
  { path: 'customer' },
  { path: 'salesPerson', select: 'name email role' },
  { path: 'supervisorApprovedBy', select: 'name email' },
  { path: 'adminApprovedBy', select: 'name email' },
];

async function findProforma(id) {
  const proforma = await Proforma.findById(id).populate(POPULATE);
  if (!proforma) throw new ApiError(404, 'Proforma not found');
  return proforma;
}

function assertCanView(user, proforma) {
  const ownerId = String(proforma.salesPerson?._id || proforma.salesPerson);
  if (user.role === 'sales' && ownerId !== String(user.id)) {
    throw new ApiError(403, 'You do not have access to this proforma');
  }
}

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query, ['proformaNumber', 'issueDate', 'grandTotal', 'status', 'createdAt']);

  const filter = {};
  if (req.user.role === 'sales') {
    filter.salesPerson = req.user.id;
  } else if (req.query.salesPerson) {
    filter.salesPerson = req.query.salesPerson;
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.customer) filter.customer = req.query.customer;
  if (req.query.q) {
    filter.proformaNumber = new RegExp(escapeRegex(req.query.q), 'i');
  }
  if (req.query.from || req.query.to) {
    filter.issueDate = {};
    if (req.query.from) filter.issueDate.$gte = new Date(req.query.from);
    if (req.query.to) filter.issueDate.$lte = new Date(req.query.to);
  }

  const { data, pagination } = await paginatedList(Proforma, {
    filter,
    sort,
    page,
    limit,
    skip,
    populate: POPULATE,
  });
  res.json({ proformas: data, pagination });
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
  await proformaService.submitProforma(proforma, req.user);
  res.json({ proforma });
});

const approve = asyncHandler(async (req, res) => {
  const proforma = await findProforma(req.params.id);
  const { comment } = req.body;

  if (req.user.role === 'supervisor') {
    await proformaService.supervisorApprove(proforma, req.user, comment);
  } else if (req.user.role === 'admin') {
    await proformaService.adminApprove(proforma, req.user, comment);
  } else {
    throw new ApiError(403, 'Only supervisors and admins can approve proformas');
  }
  res.json({ proforma });
});

const reject = asyncHandler(async (req, res) => {
  const proforma = await findProforma(req.params.id);
  await proformaService.reject(proforma, req.user, req.body.reason);
  res.json({ proforma });
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

  await ApprovalHistory.deleteMany({ proforma: proforma._id });
  await proforma.deleteOne();
  res.status(204).send();
});

const history = asyncHandler(async (req, res) => {
  const proforma = await findProforma(req.params.id);
  assertCanView(req.user, proforma);
  const entries = await ApprovalHistory.find({ proforma: proforma._id })
    .sort({ createdAt: 1 })
    .populate('actor', 'name email role');
  res.json({ history: entries });
});

const pdf = asyncHandler(async (req, res) => {
  const proforma = await findProforma(req.params.id);
  assertCanView(req.user, proforma);
  const settings = await Setting.get();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${proforma.proformaNumber}.pdf"`
  );
  await renderProformaPdf(proforma, settings, res);
});

module.exports = { list, create, getOne, update, submit, approve, reject, remove, history, pdf };
