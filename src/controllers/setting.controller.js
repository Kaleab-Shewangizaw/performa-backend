const asyncHandler = require('../utils/asyncHandler');
const settingModel = require('../models/setting.model');

const get = asyncHandler(async (req, res) => {
  const settings = await settingModel.get();
  res.json({ settings });
});

// Unauthenticated branding for the login screen: name and logo only.
const publicBranding = asyncHandler(async (req, res) => {
  const { companyName, logoUrl } = await settingModel.get();
  res.json({ branding: { companyName, logoUrl } });
});

const update = asyncHandler(async (req, res) => {
  const settings = await settingModel.update(req.body);
  res.json({ settings });
});

module.exports = { get, publicBranding, update };
