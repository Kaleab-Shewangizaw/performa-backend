const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { query } = require('../config/db');

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  })
);

module.exports = router;
