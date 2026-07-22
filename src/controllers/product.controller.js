const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const productModel = require('../models/product.model');
const { parsePagination, parseSort, buildPagination } = require('../utils/query');
const { STONE_CATEGORIES, FINISHES, THICKNESS_OPTIONS } = require('../utils/constants');

const SORTABLE = {
  name: 'name',
  stoneCategory: 'stone_category',
  defaultUnitPrice: 'default_unit_price',
  createdAt: 'created_at',
};

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const sort = parseSort(req.query, SORTABLE);

  const { data, total } = await productModel.list({
    search: req.query.q,
    stoneCategory: req.query.stoneCategory,
    finish: req.query.finish,
    status: req.query.status,
    sort,
    limit,
    offset,
  });
  res.json({ products: data, pagination: buildPagination({ page, limit, total }) });
});

// Enum values the frontend needs to build product/proforma forms
const meta = asyncHandler(async (req, res) => {
  res.json({
    stoneCategories: STONE_CATEGORIES,
    finishes: FINISHES,
    thicknessOptions: THICKNESS_OPTIONS,
  });
});

const create = asyncHandler(async (req, res) => {
  const product = await productModel.create(req.body);
  res.status(201).json({ product });
});

const getOne = asyncHandler(async (req, res) => {
  const product = await productModel.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({ product });
});

const update = asyncHandler(async (req, res) => {
  const product = await productModel.update(req.params.id, req.body);
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({ product });
});

const remove = asyncHandler(async (req, res) => {
  const product = await productModel.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');

  if (await productModel.isUsedInProformas(product.id)) {
    // Keep referenced products for historical proformas; just retire them.
    const deactivated = await productModel.setStatus(product.id, 'inactive');
    return res.json({
      product: deactivated,
      message: 'Product is referenced by proformas and was deactivated instead of deleted',
    });
  }

  await productModel.remove(product.id);
  res.status(204).send();
});

module.exports = { list, meta, create, getOne, update, remove };
