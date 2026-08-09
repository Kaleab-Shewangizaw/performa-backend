const { Router } = require('express');
const controller = require('../controllers/order.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { parseId } = require('../middleware/parseId');
const { setStepSchema } = require('../schemas/order.schema');

const router = Router();

// Factory workers and admins work the production queue.
router.use(requireAuth, requireRole('factory', 'admin'));

router.get('/', controller.list);

router.use('/:id', parseId());
router.get('/:id', controller.getOne);
router.get('/:id/timeline', controller.timeline);
router.post('/:id/step', validate(setStepSchema), controller.setStep);

module.exports = router;
