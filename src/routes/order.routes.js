const { Router } = require('express');
const controller = require('../controllers/order.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { parseId } = require('../middleware/parseId');
const { setStepSchema, decideRequestSchema } = require('../schemas/order.schema');

const router = Router();

// Factory workers, supervisors and admins all work the production queue
// (factory requests moves; supervisor/admin apply and approve them).
router.use(requireAuth, requireRole('factory', 'supervisor', 'admin'));

router.get('/', controller.list);

// Step-change approval queue — registered before '/:id' so it isn't captured
// as an order id. Only supervisors/admins decide requests.
router.get('/requests', requireRole('supervisor', 'admin'), controller.listRequests);
router.post(
  '/requests/:reqId/decision',
  requireRole('supervisor', 'admin'),
  parseId('reqId'),
  validate(decideRequestSchema),
  controller.decideRequest
);

router.use('/:id', parseId());
router.get('/:id', controller.getOne);
router.get('/:id/timeline', controller.timeline);
router.post('/:id/step', validate(setStepSchema), controller.setStep);

module.exports = router;
