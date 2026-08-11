const ApiError = require('../utils/apiError');
const proformaModel = require('../models/proforma.model');
const orderStepModel = require('../models/orderStep.model');
const stepHistoryModel = require('../models/orderStepHistory.model');
const stepRequestModel = require('../models/stepChangeRequest.model');
const notificationService = require('./notification.service');
const activityService = require('./activity.service');

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

// Validates the target step and works out whether the move is a backward one
// (to an earlier stage), which always requires a customer-visible reason.
async function resolveMove(proforma, toStepId, reason) {
  if (proforma.status !== 'approved' || !proforma.currentStepId) {
    throw new ApiError(400, 'Only orders in production can be moved');
  }
  const toStep = await orderStepModel.findById(toStepId);
  if (!toStep || !toStep.isActive) {
    throw new ApiError(400, 'Unknown or inactive step');
  }
  const fromStep = await orderStepModel.findById(proforma.currentStepId);
  const isBackward = !!fromStep && toStep.position < fromStep.position;
  if (isBackward && !String(reason || '').trim()) {
    throw new ApiError(400, 'Moving an order back to an earlier stage requires a reason the customer will see');
  }
  return { toStep, fromStep, isBackward };
}

// Applies a stage move directly (admin/supervisor, or when approving a request).
async function applyStep(proforma, toStepId, actor, { reason = '', note = '' } = {}) {
  const { toStep, isBackward } = await resolveMove(proforma, toStepId, reason);
  const cleanReason = isBackward ? String(reason).trim() : '';

  const updated = await proformaModel.setCurrentStep(proforma.id, toStep.id);
  await stepHistoryModel.create({
    proformaId: proforma.id,
    stepId: toStep.id,
    stepName: toStep.name,
    changedById: actor.id,
    note,
    reason: cleanReason,
  });
  await activityService.record(actor.id, isBackward ? 'order.step_reverted' : 'order.step_moved', {
    entityType: 'proforma',
    entityId: proforma.id,
    summary: `${actor.name} moved ${proforma.proformaNumber} to "${toStep.name}"`
      + (isBackward ? ` (back — reason: ${cleanReason})` : ''),
  });
  return updated;
}

// A factory worker proposes a stage move. The order does not move until an
// admin/supervisor approves the request.
async function requestStep(proforma, toStepId, actor, { reason = '' } = {}) {
  const existing = await stepRequestModel.findPendingForProforma(proforma.id);
  if (existing) {
    throw new ApiError(400, 'This order already has a pending request awaiting approval');
  }
  if (Number(toStepId) === proforma.currentStepId) {
    throw new ApiError(400, 'The order is already at this stage');
  }
  const { toStep, isBackward } = await resolveMove(proforma, toStepId, reason);

  const request = await stepRequestModel.create({
    proformaId: proforma.id,
    fromStepId: proforma.currentStepId,
    toStepId: toStep.id,
    requestedBy: actor.id,
    reason: isBackward ? String(reason).trim() : '',
  });

  const payload = {
    type: 'order_step_requested',
    message: `${actor.name} requested moving ${proforma.proformaNumber} to "${toStep.name}"`,
    proformaId: proforma.id,
  };
  await notificationService.notifyRole('admin', payload);
  await notificationService.notifyRole('supervisor', payload);
  await activityService.record(actor.id, 'order.step_requested', {
    entityType: 'proforma',
    entityId: proforma.id,
    summary: `${actor.name} requested moving ${proforma.proformaNumber} to "${toStep.name}"`,
  });
  return request;
}

// Admin/supervisor approves or rejects a pending request.
async function decideRequest(request, decision, actor, note = '') {
  if (request.status !== 'pending') {
    throw new ApiError(400, 'This request has already been decided');
  }
  const requesterId = request.requestedBy?.id || null;

  if (decision === 'approve') {
    const proforma = await proformaModel.findById(request.proformaId);
    if (!proforma || proforma.status !== 'approved' || !proforma.currentStepId) {
      throw new ApiError(400, 'This order is no longer in production');
    }
    await applyStep(proforma, request.toStepId, actor, { reason: request.reason, note });
    const updated = await stepRequestModel.decide(request.id, {
      status: 'approved', decidedBy: actor.id, decisionNote: note,
    });
    if (requesterId) {
      await notificationService.notify(requesterId, {
        type: 'order_step_approved',
        message: `Your move of ${request.proformaNumber} to "${request.toStepName}" was approved`,
        proformaId: request.proformaId,
      });
    }
    return updated;
  }

  const updated = await stepRequestModel.decide(request.id, {
    status: 'rejected', decidedBy: actor.id, decisionNote: note,
  });
  if (requesterId) {
    await notificationService.notify(requesterId, {
      type: 'order_step_rejected',
      message: `Your move of ${request.proformaNumber} to "${request.toStepName}" was declined`
        + (note ? `: ${note}` : ''),
      proformaId: request.proformaId,
    });
  }
  await activityService.record(actor.id, 'order.step_request_rejected', {
    entityType: 'proforma',
    entityId: request.proformaId,
    summary: `${actor.name} declined moving ${request.proformaNumber} to "${request.toStepName}"`
      + (note ? `: ${note}` : ''),
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
  const reasonByStep = new Map();
  for (const h of history) {
    if (h.stepId != null && !firstReachedAt.has(h.stepId)) {
      firstReachedAt.set(h.stepId, h.createdAt);
    }
    // Latest customer-visible reason recorded against a step (a backward move).
    if (h.stepId != null && h.reason) reasonByStep.set(h.stepId, h.reason);
  }

  const timeline = steps.map((s) => ({
    name: s.name,
    reached: firstReachedAt.has(s.id),
    reachedAt: firstReachedAt.get(s.id) || null,
    current: inProduction && s.id === row.currentStepId,
    reason: reasonByStep.get(s.id) || null,
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
    currentStep: currentStep ? { name: currentStep.name, reason: currentStep.reason } : null,
    steps: timeline,
    updatedAt: row.updatedAt,
  };
}

module.exports = {
  startTracking,
  stopTracking,
  applyStep,
  requestStep,
  decideRequest,
  buildPublicTracking,
  normalizePhone,
};
