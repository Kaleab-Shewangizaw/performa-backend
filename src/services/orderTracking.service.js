const ApiError = require('../utils/apiError');
const proformaModel = require('../models/proforma.model');
const orderStepModel = require('../models/orderStep.model');
const stepHistoryModel = require('../models/orderStepHistory.model');

// Reduces a phone number to its comparable core: digits only, last 9 (the
// national significant number for Ethiopian mobiles). Lets a customer type
// +251911223344, 0911223344 or 0911 223 344 and still match the stored value.
function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.slice(-9);
}

// Called when a proforma becomes approved: the order enters the first active
// pipeline step. actorId is null for automatic (auto-approval) transitions.
// No-op when the admin has defined no active steps yet.
async function startTracking(proformaId, actorId = null) {
  const step = await orderStepModel.firstActive();
  if (!step) return null;
  await proformaModel.setCurrentStep(proformaId, step.id);
  await stepHistoryModel.create({
    proformaId,
    stepId: step.id,
    stepName: step.name,
    changedById: actorId,
    note: 'Order approved — tracking started',
  });
  return step;
}

// Called when an approved order is pushed back out of production (admin
// rejecting an already-approved proforma). Clears the pointer, keeps history.
async function stopTracking(proformaId, actorId = null, note = 'Tracking reset') {
  await proformaModel.setCurrentStep(proformaId, null);
  await stepHistoryModel.create({
    proformaId,
    stepId: null,
    stepName: 'Removed from production',
    changedById: actorId,
    note,
  });
}

// Factory worker (or admin) advances an order to a chosen step.
async function setStep(proforma, stepId, actor, note = '') {
  if (proforma.status !== 'approved') {
    throw new ApiError(400, 'Only approved orders can be tracked');
  }
  const step = await orderStepModel.findById(stepId);
  if (!step || !step.isActive) {
    throw new ApiError(400, 'Unknown or inactive step');
  }
  const updated = await proformaModel.setCurrentStep(proforma.id, step.id);
  await stepHistoryModel.create({
    proformaId: proforma.id,
    stepId: step.id,
    stepName: step.name,
    changedById: actor.id,
    note,
  });
  return updated;
}

// Public, unauthenticated lookup. Returns a minimal, safe view or null (the
// controller turns null into a single generic 404 so a wrong number and a
// wrong phone are indistinguishable — no enumeration signal).
async function buildPublicTracking(number, phone) {
  const trimmed = String(number || '').trim();
  const suppliedPhone = normalizePhone(phone);
  if (!trimmed || suppliedPhone.length < 7) return null;

  const row = await proformaModel.findByNumberForTracking(trimmed);
  if (!row) return null;
  if (normalizePhone(row.customerPhone) !== suppliedPhone) return null;

  const inProduction = row.status === 'approved';

  // Build a progress timeline from the active pipeline and this order's history.
  const [steps, history] = await Promise.all([
    orderStepModel.list({ activeOnly: true }),
    stepHistoryModel.listForProforma(row.id),
  ]);
  const firstReachedAt = new Map();
  for (const h of history) {
    if (h.stepId != null && !firstReachedAt.has(h.stepId)) {
      firstReachedAt.set(h.stepId, h.createdAt);
    }
  }

  const timeline = steps.map((s) => ({
    name: s.name,
    reached: firstReachedAt.has(s.id),
    reachedAt: firstReachedAt.get(s.id) || null,
    current: inProduction && s.id === row.currentStepId,
  }));

  const currentStep = timeline.find((s) => s.current) || null;
  const status = inProduction
    ? currentStep?.name || 'In production'
    : 'Order received — under review';

  return {
    proformaNumber: row.proformaNumber,
    projectName: row.projectName || null,
    status,
    inProduction,
    currentStep: currentStep ? { name: currentStep.name } : null,
    steps: timeline,
    updatedAt: row.updatedAt,
  };
}

module.exports = { startTracking, stopTracking, setStep, buildPublicTracking, normalizePhone };
