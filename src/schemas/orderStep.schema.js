const { z } = require('zod');

const createOrderStepSchema = z.object({
  name: z.string().min(1).max(100),
  position: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

const updateOrderStepSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  position: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

module.exports = { createOrderStepSchema, updateOrderStepSchema };
