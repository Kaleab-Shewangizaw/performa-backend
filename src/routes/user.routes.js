const { Router } = require('express');
const controller = require('../controllers/user.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { updateRoleSchema, createUserSchema } = require('../schemas/user.schema');

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', controller.list);
router.post('/', validate(createUserSchema), controller.create);
router.get('/:id', controller.getOne);
router.patch('/:id/role', validate(updateRoleSchema), controller.updateRole);
router.post('/:id/deactivate', controller.deactivate);
router.post('/:id/reactivate', controller.reactivate);

module.exports = router;
