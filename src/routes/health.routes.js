const { Router } = require('express');
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  })
);

module.exports = router;
