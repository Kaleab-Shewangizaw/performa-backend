const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const proformaModel = require('../models/proforma.model');
const stepHistoryModel = require('../models/orderStepHistory.model');
const orderTrackingService = require('../services/orderTracking.service');
const { toOrderView } = require('../utils/orderView');
const { parsePagination, parseSort, buildPagination } = require('../utils/query');

const SORTABLE = {
  proformaNumber: 'p.proforma_number',
  issueDate: 'p.issue_date',
  updatedAt: 'p.updated_at',
  createdAt: 'p.created_at',
};

// An order is an approved proforma. Anything not yet approved is not an order,
// so the factory queue never exposes it.
async function findApprovedOrder(id) {
  const proforma = await proformaModel.findById(id);
  if (!proforma || proforma.status !== 'approved') {
    throw new ApiError(404, 'Order not found');
  }
  return proforma;
}

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const sort = parseSort(req.query, SORTABLE, 'p.updated_at DESC');

  const { data, total } = await proformaModel.list({
    status: 'approved',
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
  const order = await findApprovedOrder(req.params.id);
  res.json({ order: toOrderView(order) });
});

const timeline = asyncHandler(async (req, res) => {
  const order = await findApprovedOrder(req.params.id);
  const history = await stepHistoryModel.listForProforma(order.id);
  res.json({ timeline: history });
});

const setStep = asyncHandler(async (req, res) => {
  const order = await findApprovedOrder(req.params.id);
  const updated = await orderTrackingService.setStep(
    order,
    req.body.stepId,
    req.user,
    req.body.note || ''
  );
  res.json({ order: toOrderView(updated) });
});

module.exports = { list, getOne, timeline, setStep };
