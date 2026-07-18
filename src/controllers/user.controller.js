const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/user.model');
const { hashPassword } = require('../utils/password');
const { parsePagination, parseSort, paginatedList, escapeRegex } = require('../utils/query');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query, ['name', 'email', 'role', 'createdAt']);

  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const { data, pagination } = await paginatedList(User, { filter, sort, page, limit, skip });
  res.json({ users: data, pagination });
});

const create = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ name, email, passwordHash, role });
  res.status(201).json({ user });
});

const getOne = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ user });
});

const update = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  const { name, email, password, role } = req.body;
  if (role && user.id === req.user.id && role !== 'admin') {
    throw new ApiError(400, 'You cannot demote your own account');
  }
  if (email && email.toLowerCase() !== user.email) {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) throw new ApiError(409, 'An account with this email already exists');
    user.email = email;
  }
  if (name) user.name = name;
  if (role) user.role = role;
  if (password) user.passwordHash = await hashPassword(password);

  await user.save();
  res.json({ user });
});

const deactivate = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ user });
});

const reactivate = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ user });
});

module.exports = { list, create, getOne, update, deactivate, reactivate };
