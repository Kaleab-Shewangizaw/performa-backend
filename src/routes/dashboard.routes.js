const { Router } = require('express');
const controller = require('../controllers/dashboard.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = Router();

router.use(requireAuth);

router.get('/sales', requireRole('sales', 'admin'), controller.sales);
router.get('/supervisor', requireRole('supervisor', 'admin'), controller.supervisor);
router.get('/admin', requireRole('admin'), controller.admin);

module.exports = router;
