const { Router } = require('express');
const controller = require('../controllers/orderStep.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { parseId } = require('../middleware/parseId');
const { createOrderStepSchema, updateOrderStepSchema } = require('../schemas/orderStep.schema');

const router = Router();

router.use(requireAuth);

// Any authenticated user can read the pipeline (factory UIs need it).
router.get('/', controller.list);

// Only admins manage the pipeline.
router.post('/', requireRole('admin'), validate(createOrderStepSchema), controller.create);

router.use('/:id', parseId());
router.put('/:id', requireRole('admin'), validate(updateOrderStepSchema), controller.update);
router.delete('/:id', requireRole('admin'), controller.remove);

module.exports = router;
