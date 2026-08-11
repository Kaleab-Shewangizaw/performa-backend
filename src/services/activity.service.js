const activityLogModel = require('../models/activityLog.model');

// Fire-and-forget audit write. Never let a logging failure break the action
// that is being logged, so errors are swallowed (and surfaced to the console).
async function record(actorId, action, { entityType = '', entityId = null, summary = '' } = {}) {
  try {
    await activityLogModel.create({ actorId, action, entityType, entityId, summary });
  } catch (err) {
    console.error('activity log write failed:', err.message);
  }
}

module.exports = { record };
