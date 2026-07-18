const asyncHandler = require('../utils/asyncHandler');
const Setting = require('../models/setting.model');

const get = asyncHandler(async (req, res) => {
  const settings = await Setting.get();
  res.json({ settings });
});

const update = asyncHandler(async (req, res) => {
  const settings = await Setting.get();
  Object.assign(settings, req.body);
  await settings.save();
  res.json({ settings });
});

module.exports = { get, update };
