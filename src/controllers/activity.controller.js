const asyncHandler = require('../utils/asyncHandler');
const activityLogModel = require('../models/activityLog.model');
const { parsePagination, buildPagination } = require('../utils/query');

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 30 });
  const { data, total } = await activityLogModel.list({
    action: req.query.action,
    limit,
    offset,
  });
  res.json({ activity: data, pagination: buildPagination({ page, limit, total }) });
});

module.exports = { list };
