const { z } = require('zod');
const { thicknessEnum } = require('./product.schema');
const { ITEM_TYPES } = require('../utils/constants');

// Postgres SERIAL ids arrive as numbers, but query/body values may be strings.
const id = z.coerce.number().int().positive();

// An item is either cut stone priced per m2, or edge work priced per linear metre.
const itemSchema = z
  .object({
    itemType: z.enum(ITEM_TYPES).default('area'),
    description: z.string().min(1, 'Description is required').max(200),
    productId: id.optional().nullable(),
    length: z.number().positive().max(10000),
    width: z.number().positive().max(100).optional().nullable(),
    thickness: thicknessEnum.optional().nullable(),
    quantity: z.number().int().positive().max(100000).default(1),
    unitPrice: z.number().nonnegative(),
    remark: z.string().max(300).optional().default(''),
  })
  .superRefine((item, ctx) => {
    if (item.itemType === 'area') {
      if (item.width == null) {
        ctx.addIssue({ code: 'custom', path: ['width'], message: 'Width is required for area items' });
      }
      if (item.thickness == null) {
        ctx.addIssue({ code: 'custom', path: ['thickness'], message: 'Thickness is required for area items' });
      }
    }
  });

const proformaSchema = z.object({
  customerId: id,
  orderNumber: z.string().max(50).optional().default(''),
  materialType: z.string().max(200).optional().default(''),
  orderedBy: z.string().max(200).optional().default(''),
  orderedDate: z.string().date().optional().nullable(),
  projectName: z.string().max(200).optional().default(''),
  issueDate: z.string().date().optional(),
  expiryDate: z.string().date().optional(),
  items: z.array(itemSchema).min(1),
  discount: z.number().nonnegative().default(0),
  vatRate: z.number().min(0).max(100).optional(),
  paymentTerms: z.string().max(500).optional(),
  deliveryTime: z.string().max(300).optional(),
  validityPeriod: z.string().max(300).optional(),
  totalWeight: z.string().max(100).optional().default(''),
  remark: z.string().max(1000).optional().default(''),
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
