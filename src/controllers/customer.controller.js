const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const Customer = require('../models/customer.model');
const Proforma = require('../models/proforma.model');
const { parsePagination, parseSort, paginatedList, escapeRegex } = require('../utils/query');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query, ['fullName', 'companyName', 'city', 'createdAt']);

  const filter = {};
  if (req.query.city) filter.city = new RegExp(`^${escapeRegex(req.query.city)}$`, 'i');
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ fullName: rx }, { companyName: rx }, { phone: rx }, { email: rx }];
  }

  const { data, pagination } = await paginatedList(Customer, { filter, sort, page, limit, skip });
  res.json({ customers: data, pagination });
});

const create = asyncHandler(async (req, res) => {
  const customer = await Customer.create({ ...req.body, createdBy: req.user.id });
  res.status(201).json({ customer });
});

const getOne = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found');
  res.json({ customer });
});

const update = asyncHandler(async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!customer) throw new ApiError(404, 'Customer not found');
  res.json({ customer });
});

const remove = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found');

  const used = await Proforma.exists({ customer: customer._id });
  if (used) {
    throw new ApiError(400, 'This customer has proformas and cannot be deleted');
  }

  await customer.deleteOne();
  res.status(204).send();
});

module.exports = { list, create, getOne, update, remove };
