const ApiError = require('../utils/apiError');

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' });
}

function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  // MySQL / MariaDB driver error codes
  switch (err.code) {
    case 'ER_DUP_ENTRY':
      return res.status(409).json({ error: 'A record with these details already exists' });
    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2':
      return res.status(400).json({ error: 'Referenced record does not exist' });
    case 'ER_ROW_IS_REFERENCED':
    case 'ER_ROW_IS_REFERENCED_2':
      return res.status(400).json({ error: 'This record is still in use and cannot be removed' });
    case 'ER_DATA_TOO_LONG':
      return res.status(400).json({ error: 'A value is too long' });
    case 'WARN_DATA_TRUNCATED':
    case 'ER_TRUNCATED_WRONG_VALUE':
      return res.status(400).json({ error: 'A value has the wrong format' });
    default:
      break;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { notFoundHandler, errorHandler };
