const Notification = require('../models/notification.model');

async function notify(userId, { type, message, proforma }) {
  return Notification.create({ user: userId, type, message, proforma });
}

module.exports = { notify };
