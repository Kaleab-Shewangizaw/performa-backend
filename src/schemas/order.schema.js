const { z } = require('zod');

// Factory worker advancing an order to a step.
const setStepSchema = z.object({
  stepId: z.number().int().positive(),
  note: z.string().max(1000).optional(),
});

// Public tracking lookup: order/proforma number + the phone on file.
const trackSchema = z.object({
  number: z.string().min(1).max(50),
  phone: z.string().min(1).max(50),
});

module.exports = { setStepSchema, trackSchema };
