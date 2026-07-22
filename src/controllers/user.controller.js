const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const userModel = require('../models/user.model');
const { hashPassword } = require('../utils/password');
const { parsePagination, parseSort, buildPagination } = require('../utils/query');

const SORTABLE = {
  name: 'name',
  email: 'email',
  role: 'role',
  createdAt: 'created_at',
};

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const sort = parseSort(req.query, SORTABLE);

  const { data, total } = await userModel.list({
    role: req.query.role,
    search: req.query.q,
    sort,
    limit,
    offset,
  });
  res.json({ users: data, pagination: buildPagination({ page, limit, total }) });
});

const create = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (await userModel.existsByEmail(email)) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const user = await userModel.create({ name, email, passwordHash, role });
  res.status(201).json({ user });
});

const getOne = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ user });
});

const update = asyncHandler(async (req, res) => {
  const existing = await userModel.findById(req.params.id);
  if (!existing) throw new ApiError(404, 'User not found');

  const { name, email, password, role } = req.body;
  if (role && existing.id === req.user.id && role !== 'admin') {
    throw new ApiError(400, 'You cannot demote your own account');
  }
  if (email && email.toLowerCase() !== existing.email && (await userModel.existsByEmail(email))) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const user = await userModel.update(existing.id, {
    name,
    email,
    role,
    passwordHash: password ? await hashPassword(password) : undefined,
  });
  res.json({ user });
});

const deactivate = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  const user = await userModel.setActive(req.params.id, false);
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ user });
});

const reactivate = asyncHandler(async (req, res) => {
  const user = await userModel.setActive(req.params.id, true);
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ user });
});

module.exports = { list, create, getOne, update, deactivate, reactivate };
