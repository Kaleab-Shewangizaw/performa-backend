const { z } = require('zod');

const ROLES = ['admin', 'manager', 'user'];

const updateRoleSchema = z.object({
  role: z.enum(ROLES),
});

const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(ROLES).default('user'),
});

module.exports = { ROLES, updateRoleSchema, createUserSchema };
