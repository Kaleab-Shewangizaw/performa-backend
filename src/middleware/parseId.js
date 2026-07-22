const ApiError = require('../utils/apiError');

// Validates a numeric route param and replaces it with a real number,
// so models never receive "abc" (or SQL) where an integer id is expected.
const parseId = (param = 'id') => (req, res, next) => {
  const raw = req.params[param];
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    return next(new ApiError(400, `Invalid ${param}`));
  }
  req.params[param] = value;
  next();
};

module.exports = { parseId };
