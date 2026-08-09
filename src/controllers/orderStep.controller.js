const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const orderStepModel = require('../models/orderStep.model');

const list = asyncHandler(async (req, res) => {
  // Factory/sales UIs pass ?activeOnly=true; admins see everything to manage it.
  const activeOnly = req.query.activeOnly === 'true';
  const steps = await orderStepModel.list({ activeOnly });
  res.json({ steps });
});

const create = asyncHandler(async (req, res) => {
  const step = await orderStepModel.create(req.body);
  res.status(201).json({ step });
});

const update = asyncHandler(async (req, res) => {
  const existing = await orderStepModel.findById(req.params.id);
  if (!existing) throw new ApiError(404, 'Step not found');
  const step = await orderStepModel.update(req.params.id, req.body);
  res.json({ step });
});

const remove = asyncHandler(async (req, res) => {
  const existing = await orderStepModel.findById(req.params.id);
  if (!existing) throw new ApiError(404, 'Step not found');
  // Soft-deletes (deactivates) when orders/history reference the step.
  const step = await orderStepModel.remove(req.params.id);
  res.json({ deleted: step === null, step });
});

module.exports = { list, create, update, remove };
