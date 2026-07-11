const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const userModel = require('../models/user.model');
const { hashPassword } = require('../utils/password');

const list = asyncHandler(async (req, res) => {
  const users = await userModel.listUsers();
  res.json({ users });
});

const create = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = await userModel.findByEmail(email);
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const user = await userModel.createUser({ name, email, passwordHash, role });
  res.status(201).json({ user });
});

const getOne = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ user });
});

const updateRole = asyncHandler(async (req, res) => {
  const { role } = req.body;

  if (req.params.id === req.user.id && role !== 'admin') {
    throw new ApiError(400, 'You cannot demote your own account');
  }

  const user = await userModel.updateRole(req.params.id, role);
  if (!user) throw new ApiError(404, 'User not found');
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

module.exports = { list, create, getOne, updateRole, deactivate, reactivate };
