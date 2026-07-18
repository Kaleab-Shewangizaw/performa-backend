const { z } = require('zod');
const { ROLES } = require('../utils/constants');

const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(ROLES),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(200).optional(),
  role: z.enum(ROLES).optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(ROLES),
});

module.exports = { createUserSchema, updateUserSchema, updateRoleSchema };
