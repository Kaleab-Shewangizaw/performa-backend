const { z } = require('zod');

// Postgres SERIAL ids arrive as numbers, but query/body values may be strings.
const id = z.coerce.number().int().positive();

// One shape for every line. A width makes it cut stone priced per m²; leaving
// the width out makes it edge work (bullnose, groove) priced per linear metre,
// exactly as those rows read on the company's spreadsheet.
const itemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(200),
  productId: id.optional().nullable(),
  length: z.number().positive().max(10000),
  width: z.number().positive().max(100).optional().nullable(),
  // Millimetres, typed freely — the product's sizes are only suggestions.
  thickness: z.number().positive().max(1000).optional().nullable(),
  quantity: z.number().int().positive().max(100000).default(1),
  unitPrice: z.number().nonnegative(),
  remark: z.string().max(300).optional().default(''),
});

const proformaSchema = z.object({
  customerId: id,
  orderNumber: z.string().max(50).optional().default(''),
  // The stone for the whole order; applied to every line that doesn't name its own.
  materialProductId: id.optional().nullable(),
  materialType: z.string().max(200).optional().default(''),
  orderedBy: z.string().max(200).optional().default(''),
  orderedDate: z.string().date().optional().nullable(),
  projectName: z.string().max(200).optional().default(''),
  issueDate: z.string().date().optional(),
  expiryDate: z.string().date().optional(),
  items: z.array(itemSchema).min(1),
  discount: z.number().nonnegative().default(0),
  // Any positive value is normalised to the company's standard rate; 0 waives
  // VAT for the customer. Those are the only two outcomes.
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
