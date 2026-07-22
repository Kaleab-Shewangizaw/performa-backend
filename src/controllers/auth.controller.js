const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const userModel = require('../models/user.model');
const refreshTokenModel = require('../models/refreshToken.model');
const { hashPassword, comparePassword, hashToken } = require('../utils/password');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const env = require('../config/env');

function serializeUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

function expiresInMs(expiresIn) {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return value * unit;
}

async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await refreshTokenModel.store({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + expiresInMs(env.jwt.refreshExpiresIn)),
  });

  return { accessToken, refreshToken };
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (await userModel.existsByEmail(email)) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  // First registered user becomes admin so the system can be bootstrapped;
  // everyone after that starts as sales.
  const isFirstUser = (await userModel.count()) === 0;
  const passwordHash = await hashPassword(password);
  const user = await userModel.create({
    name,
    email,
    passwordHash,
    role: isFirstUser ? 'admin' : 'sales',
  });
  const tokens = await issueTokens(user);

  res.status(201).json({ user, ...tokens });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await userModel.findByEmailWithPassword(email);
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const tokens = await issueTokens(user);
  res.json({ user: serializeUser(user), ...tokens });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await refreshTokenModel.findActiveByHash(tokenHash);
  if (!stored) {
    throw new ApiError(401, 'Refresh token has been revoked or is invalid');
  }

  const user = await userModel.findById(payload.sub);
  if (!user || !user.isActive) {
    throw new ApiError(401, 'User no longer exists or is inactive');
  }

  await refreshTokenModel.revokeByHash(tokenHash);
  const tokens = await issueTokens(user);

  res.json({ user, ...tokens });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await refreshTokenModel.revokeByHash(hashToken(refreshToken));
  }
  res.status(204).send();
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

module.exports = { register, login, refresh, logout, me };
