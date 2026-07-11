const { Router } = require('express');
const controller = require('../controllers/proforma.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { proformaSchema, statusSchema } = require('../schemas/proforma.schema');

const router = Router();

router.use(requireAuth, requireRole('admin', 'manager', 'user'));

router.post('/', validate(proformaSchema), controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.put('/:id', validate(proformaSchema), controller.update);
router.patch('/:id/status', validate(statusSchema), controller.updateStatus);
router.delete('/:id', controller.remove);

module.exports = router;
