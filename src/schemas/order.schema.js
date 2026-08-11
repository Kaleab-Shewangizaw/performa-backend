const { z } = require('zod');

// Factory worker requesting, or admin/supervisor applying, a stage move.
// `reason` is required by the API when the move is backward (checked server-side).
const setStepSchema = z.object({
  stepId: z.number().int().positive(),
  reason: z.string().max(500).optional(),
  note: z.string().max(1000).optional(),
});

// Admin/supervisor deciding a pending step-change request.
const decideRequestSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(500).optional(),
});

// Public tracking lookup: order/proforma number + the phone on file.
const trackSchema = z.object({
  number: z.string().min(1).max(50),
  phone: z.string().min(1).max(50),
});

module.exports = { setStepSchema, decideRequestSchema, trackSchema };
