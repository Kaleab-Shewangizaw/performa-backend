const asyncHandler = require('../utils/asyncHandler');
const settingModel = require('../models/setting.model');

const get = asyncHandler(async (req, res) => {
  const settings = await settingModel.get();
  res.json({ settings });
});

const update = asyncHandler(async (req, res) => {
  const settings = await settingModel.update(req.body);
  res.json({ settings });
});

module.exports = { get, update };
