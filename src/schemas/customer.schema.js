const { z } = require('zod');

const customerSchema = z.object({
  fullName: z.string().min(1).max(200),
  companyName: z.string().max(200).optional().default(''),
  phone: z.string().min(3).max(50),
  email: z.string().email().optional().or(z.literal('')).default(''),
  address: z.string().max(500).optional().default(''),
  city: z.string().max(100).optional().default(''),
  taxNumber: z.string().max(100).optional().default(''),
  notes: z.string().max(2000).optional().default(''),
});

module.exports = { customerSchema };
