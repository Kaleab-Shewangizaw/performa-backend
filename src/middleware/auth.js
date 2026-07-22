const ApiError = require('../utils/apiError');
const { verifyAccessToken } = require('../utils/jwt');
const userModel = require('../models/user.model');
const asyncHandler = require('../utils/asyncHandler');

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'Missing or invalid Authorization header');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired access token');
  }

  const user = await userModel.findById(payload.sub);
  if (!user || !user.isActive) {
    throw new ApiError(401, 'User no longer exists or is inactive');
  }

  req.user = user;
  next();
});

module.exports = { requireAuth };
