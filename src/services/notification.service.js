const notificationModel = require('../models/notification.model');

async function notify(userId, { type, message, proformaId }) {
  return notificationModel.create({ userId, type, message, proformaId });
}

module.exports = { notify };
