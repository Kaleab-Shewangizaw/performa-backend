const { z } = require('zod');

const itemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

const proformaSchema = z.object({
  title: z.string().min(1).max(300),
  clientName: z.string().min(1).max(300),
  clientEmail: z.string().email().optional(),
  clientAddress: z.string().max(500).optional(),
  issueDate: z.string().date().optional(),
  dueDate: z.string().date().optional(),
  currency: z.string().length(3).optional(),
  taxRate: z.number().min(0).max(100).default(0),
  notes: z.string().max(2000).optional(),
  items: z.array(itemSchema).min(1),
});

const statusSchema = z.object({
  status: z.enum(['draft', 'sent', 'approved', 'rejected', 'cancelled']),
});

module.exports = { proformaSchema, statusSchema };
