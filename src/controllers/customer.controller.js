const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const customerModel = require('../models/customer.model');
const { parsePagination, parseSort, buildPagination } = require('../utils/query');

const SORTABLE = {
  fullName: 'full_name',
  companyName: 'company_name',
  city: 'city',
  createdAt: 'created_at',
};

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const sort = parseSort(req.query, SORTABLE);

  const { data, total } = await customerModel.list({
    search: req.query.q,
    city: req.query.city,
    sort,
    limit,
    offset,
  });
  res.json({ customers: data, pagination: buildPagination({ page, limit, total }) });
});

const create = asyncHandler(async (req, res) => {
  const customer = await customerModel.create(req.body, req.user.id);
  res.status(201).json({ customer });
});

const getOne = asyncHandler(async (req, res) => {
  const customer = await customerModel.findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found');
  res.json({ customer });
});

const update = asyncHandler(async (req, res) => {
  const customer = await customerModel.update(req.params.id, req.body);
  if (!customer) throw new ApiError(404, 'Customer not found');
  res.json({ customer });
});

const remove = asyncHandler(async (req, res) => {
  const customer = await customerModel.findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found');

  if (await customerModel.hasProformas(customer.id)) {
    throw new ApiError(400, 'This customer has proformas and cannot be deleted');
  }

  await customerModel.remove(customer.id);
  res.status(204).send();
});

module.exports = { list, create, getOne, update, remove };
