const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const Product = require('../models/product.model');
const Proforma = require('../models/proforma.model');
const { parsePagination, parseSort, paginatedList, escapeRegex } = require('../utils/query');
const { STONE_CATEGORIES, FINISHES, THICKNESS_OPTIONS } = require('../utils/constants');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query, ['name', 'stoneCategory', 'defaultUnitPrice', 'createdAt']);

  const filter = {};
  if (req.query.stoneCategory) filter.stoneCategory = req.query.stoneCategory;
  if (req.query.finish) filter.finish = req.query.finish;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { stoneColor: rx }];
  }

  const { data, pagination } = await paginatedList(Product, { filter, sort, page, limit, skip });
  res.json({ products: data, pagination });
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
  const product = await Product.create(req.body);
  res.status(201).json({ product });
});

const getOne = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({ product });
});

const update = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({ product });
});

const remove = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');

  const used = await Proforma.exists({ 'items.product': product._id });
  if (used) {
    // Keep referenced products for historical proformas; just retire them.
    product.status = 'inactive';
    await product.save();
    return res.json({
      product,
      message: 'Product is referenced by proformas and was deactivated instead of deleted',
    });
  }

  await product.deleteOne();
  res.status(204).send();
});

module.exports = { list, meta, create, getOne, update, remove };
