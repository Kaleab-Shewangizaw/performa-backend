const asyncHandler = require('../utils/asyncHandler');
const notificationModel = require('../models/notification.model');
const { parsePagination, buildPagination } = require('../utils/query');

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);

  const { data, total, unreadCount } = await notificationModel.listForUser({
    userId: req.user.id,
    unreadOnly: req.query.unread === 'true',
    limit,
    offset,
  });

  res.json({
    notifications: data,
    unreadCount,
    pagination: buildPagination({ page, limit, total }),
  });
});

const markRead = asyncHandler(async (req, res) => {
  await notificationModel.markRead(req.params.id, req.user.id);
  res.status(204).send();
});

const markAllRead = asyncHandler(async (req, res) => {
  await notificationModel.markAllRead(req.user.id);
  res.status(204).send();
});

module.exports = { list, markRead, markAllRead };
