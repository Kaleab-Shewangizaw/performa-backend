const { z } = require('zod');
const {
  STONE_CATEGORIES,
  FINISHES,
  THICKNESS_OPTIONS,
  PRODUCT_STATUSES,
} = require('../utils/constants');

const thicknessEnum = z
  .number()
  .refine((v) => THICKNESS_OPTIONS.includes(v), {
    message: `Thickness must be one of: ${THICKNESS_OPTIONS.join(', ')} mm`,
  });

const productSchema = z.object({
  name: z.string().min(1).max(200),
  stoneCategory: z.enum(STONE_CATEGORIES),
  stoneColor: z.string().min(1).max(100),
  finish: z.enum(FINISHES),
  thicknessOptions: z.array(thicknessEnum).min(1),
  defaultUnitPrice: z.number().nonnegative(),
  status: z.enum(PRODUCT_STATUSES).default('active'),
  // Pre-cleared products let a proforma skip the approval chain.
  allowsDirectApproval: z.boolean().optional().default(false),
});

module.exports = { productSchema, thicknessEnum };
