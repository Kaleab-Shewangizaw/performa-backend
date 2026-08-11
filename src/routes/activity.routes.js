const { Router } = require('express');
const controller = require('../controllers/activity.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = Router();

// The activity log is an admin oversight tool.
router.use(requireAuth, requireRole('admin'));

router.get('/', controller.list);

module.exports = router;
