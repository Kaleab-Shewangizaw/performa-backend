const { Router } = require('express');
const controller = require('../controllers/user.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { parseId } = require('../middleware/parseId');
const { createUserSchema, updateUserSchema } = require('../schemas/user.schema');

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', controller.list);
router.post('/', validate(createUserSchema), controller.create);

router.use('/:id', parseId());
router.get('/:id', controller.getOne);
router.put('/:id', validate(updateUserSchema), controller.update);
router.post('/:id/deactivate', controller.deactivate);
router.post('/:id/reactivate', controller.reactivate);

module.exports = router;
