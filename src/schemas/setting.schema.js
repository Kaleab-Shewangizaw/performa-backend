const { z } = require('zod');

const settingSchema = z.object({
  companyName: z.string().min(1).max(200).optional(),
  companyAddress: z.string().max(500).optional(),
  companyPhone: z.string().max(50).optional(),
  companyEmail: z.string().email().optional().or(z.literal('')),
  companyWebsite: z.string().max(200).optional(),
  logoUrl: z.string().max(100000).optional(),
  currency: z.string().min(1).max(10).optional(),
  defaultVatRate: z.number().min(0).max(100).optional(),
  defaultPaymentTerms: z.string().max(500).optional(),
  defaultValidityDays: z.number().int().min(1).max(365).optional(),
  proformaPrefix: z.string().min(1).max(10).optional(),
});

module.exports = { settingSchema };
