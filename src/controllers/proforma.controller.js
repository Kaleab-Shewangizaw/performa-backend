const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const proformaModel = require('../models/proforma.model');

const PRIVILEGED_ROLES = ['admin', 'manager'];
const APPROVAL_STATUSES = ['approved', 'rejected'];

function isPrivileged(role) {
  return PRIVILEGED_ROLES.includes(role);
}

function assertCanAccess(user, proforma) {
  if (!isPrivileged(user.role) && proforma.owner_id !== user.id) {
    throw new ApiError(403, 'You do not have access to this proforma');
  }
}

const create = asyncHandler(async (req, res) => {
  const proforma = await proformaModel.createProforma({ ...req.body, ownerId: req.user.id });
  res.status(201).json({ proforma });
});

const list = asyncHandler(async (req, res) => {
  const { status } = req.query;
  let ownerId;

  if (isPrivileged(req.user.role)) {
    ownerId = req.query.ownerId || undefined;
  } else {
    ownerId = req.user.id;
  }

  const proformas = await proformaModel.listProformas({ ownerId, status });
  res.json({ proformas });
});

const getOne = asyncHandler(async (req, res) => {
  const proforma = await proformaModel.getProformaById(req.params.id);
  if (!proforma) throw new ApiError(404, 'Proforma not found');
  assertCanAccess(req.user, proforma);
  res.json({ proforma });
});

const update = asyncHandler(async (req, res) => {
  const existing = await proformaModel.getProformaById(req.params.id);
  if (!existing) throw new ApiError(404, 'Proforma not found');
  assertCanAccess(req.user, existing);

  const proforma = await proformaModel.updateProforma(req.params.id, req.body);
  res.json({ proforma });
});

const updateStatus = asyncHandler(async (req, res) => {
  const existing = await proformaModel.getProformaById(req.params.id);
  if (!existing) throw new ApiError(404, 'Proforma not found');
  assertCanAccess(req.user, existing);

  const { status } = req.body;
  if (APPROVAL_STATUSES.includes(status) && !isPrivileged(req.user.role)) {
    throw new ApiError(403, 'Only managers or admins can approve or reject a proforma');
  }

  const proforma = await proformaModel.updateStatus(req.params.id, status);
  res.json({ proforma });
});

const remove = asyncHandler(async (req, res) => {
  const existing = await proformaModel.getProformaById(req.params.id);
  if (!existing) throw new ApiError(404, 'Proforma not found');
  assertCanAccess(req.user, existing);

  await proformaModel.deleteProforma(req.params.id);
  res.status(204).send();
});

module.exports = { create, list, getOne, update, updateStatus, remove };
