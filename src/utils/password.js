const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const env = require('../config/env');

function hashPassword(plain) {
  return bcrypt.hash(plain, env.bcryptSaltRounds);
}

function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { hashPassword, comparePassword, hashToken };
