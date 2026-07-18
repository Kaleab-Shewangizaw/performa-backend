const { Router } = require('express');
const controller = require('../controllers/setting.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { settingSchema } = require('../schemas/setting.schema');

const router = Router();

router.use(requireAuth);

// Everyone can read company settings (needed to render proformas);
// only admin can change them.
router.get('/', controller.get);
router.put('/', requireRole('admin'), validate(settingSchema), controller.update);

module.exports = router;
