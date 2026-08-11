const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const proformaModel = require('../models/proforma.model');
const stepHistoryModel = require('../models/orderStepHistory.model');
const stepRequestModel = require('../models/stepChangeRequest.model');
const orderTrackingService = require('../services/orderTracking.service');
const { toOrderView } = require('../utils/orderView');
const { parsePagination, parseSort, buildPagination } = require('../utils/query');

const SORTABLE = {
  proformaNumber: 'p.proforma_number',
  issueDate: 'p.issue_date',
  updatedAt: 'p.updated_at',
  createdAt: 'p.created_at',
};

// A factory order is an approved proforma that has been sent to the factory
// (current_step_id set). Approved-but-not-sent proformas are not yet on the
// floor, so the factory queue never exposes them.
async function findSentOrder(id) {
  const proforma = await proformaModel.findById(id);
  if (!proforma || proforma.status !== 'approved' || !proforma.currentStepId) {
    throw new ApiError(404, 'Order not found');
  }
  return proforma;
}

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const sort = parseSort(req.query, SORTABLE, 'p.updated_at DESC');

  const { data, total } = await proformaModel.list({
    status: 'approved',
    sentToFactory: true,
    customerId: req.query.customer,
    search: req.query.q,
    sort,
    limit,
    offset,
  });

  res.json({
    orders: data.map(toOrderView),
    pagination: buildPagination({ page, limit, total }),
  });
});

const getOne = asyncHandler(async (req, res) => {
  const order = await findSentOrder(req.params.id);
  const pendingRequest = await stepRequestModel.findPendingForProforma(order.id);
  res.json({ order: { ...toOrderView(order), pendingRequest } });
});

const timeline = asyncHandler(async (req, res) => {
  const order = await findSentOrder(req.params.id);
  const history = await stepHistoryModel.listForProforma(order.id);
  res.json({ timeline: history });
});

// Factory workers request a move (needs approval); admin/supervisor apply it.
const setStep = asyncHandler(async (req, res) => {
  const order = await findSentOrder(req.params.id);
  const { stepId, reason = '', note = '' } = req.body;

  if (req.user.role === 'factory') {
    const request = await orderTrackingService.requestStep(order, stepId, req.user, { reason });
    return res.status(202).json({ request, pending: true });
  }
  const updated = await orderTrackingService.applyStep(order, stepId, req.user, { reason, note });
  res.json({ order: toOrderView(updated), pending: false });
});

// ---- step-change requests (admin/supervisor approval queue) ----

const listRequests = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { data, total } = await stepRequestModel.listPending({ limit, offset });
  res.json({ requests: data, pagination: buildPagination({ page, limit, total }) });
});

const decideRequest = asyncHandler(async (req, res) => {
  const request = await stepRequestModel.findById(req.params.reqId);
  if (!request) throw new ApiError(404, 'Request not found');

  const decision = req.body.decision;
  if (!['approve', 'reject'].includes(decision)) {
    throw new ApiError(400, 'decision must be "approve" or "reject"');
  }
  const updated = await orderTrackingService.decideRequest(request, decision, req.user, req.body.note || '');
  res.json({ request: updated });
});

module.exports = { list, getOne, timeline, setStep, listRequests, decideRequest };
