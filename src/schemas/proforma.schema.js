const { z } = require('zod');
const { thicknessEnum } = require('./product.schema');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const itemSchema = z.object({
  productId: objectId,
  width: z.number().positive().max(100),
  height: z.number().positive().max(100),
  thickness: thicknessEnum,
  quantity: z.number().int().positive().max(100000),
  unitPrice: z.number().nonnegative().optional(),
});

const proformaSchema = z.object({
  customerId: objectId,
  issueDate: z.string().date().optional(),
  expiryDate: z.string().date().optional(),
  items: z.array(itemSchema).min(1),
  discount: z.number().nonnegative().default(0),
  vatRate: z.number().min(0).max(100).optional(),
  paymentTerms: z.string().max(500).optional(),
  deliveryTime: z.string().max(300).optional(),
  validityPeriod: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
  asDraft: z.boolean().optional().default(false),
  submit: z.boolean().optional().default(false),
});

const approveSchema = z.object({
  comment: z.string().max(1000).optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(3, 'A rejection reason is required').max(1000),
});

module.exports = { proformaSchema, approveSchema, rejectSchema };
