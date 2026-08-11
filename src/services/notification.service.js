const notificationModel = require('../models/notification.model');
const userModel = require('../models/user.model');

async function notify(userId, { type, message, proformaId }) {
  return notificationModel.create({ userId, type, message, proformaId });
}

// Notify every active user in a role (e.g. all factory workers when an order
// arrives, or all admins when a step change is requested).
async function notifyRole(role, payload) {
  const { data: users } = await userModel.list({ role, limit: 500, offset: 0, sort: 'id' });
  const active = users.filter((u) => u.isActive);
  await Promise.all(active.map((u) => notify(u.id, payload)));
  return active.length;
}

module.exports = { notify, notifyRole };
