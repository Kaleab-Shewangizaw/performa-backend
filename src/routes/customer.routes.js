const { Router } = require('express');
const controller = require('../controllers/customer.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { parseId } = require('../middleware/parseId');
const { customerSchema } = require('../schemas/customer.schema');

const router = Router();

// All roles can view customers; sales and admin manage them.
router.use(requireAuth);

router.get('/', controller.list);
router.post('/', requireRole('sales', 'admin'), validate(customerSchema), controller.create);

router.use('/:id', parseId());
router.get('/:id', controller.getOne);
router.put('/:id', requireRole('sales', 'admin'), validate(customerSchema), controller.update);
router.delete('/:id', requireRole('admin'), controller.remove);

module.exports = router;
