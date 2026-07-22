const ApiError = require('../utils/apiError');

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' });
}

function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  // Postgres error codes
  switch (err.code) {
    case '23505': // unique_violation
      return res.status(409).json({ error: 'A record with these details already exists' });
    case '23503': // foreign_key_violation
      return res.status(400).json({ error: 'Referenced record does not exist or is still in use' });
    case '23514': // check_violation
      return res.status(400).json({ error: 'A value is outside the allowed range' });
    case '22P02': // invalid_text_representation
      return res.status(400).json({ error: 'Invalid value format' });
    default:
      break;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { notFoundHandler, errorHandler };
