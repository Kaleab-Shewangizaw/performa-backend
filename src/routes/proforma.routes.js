const { Router } = require('express');
const controller = require('../controllers/proforma.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { parseId } = require('../middleware/parseId');
const { proformaSchema, approveSchema, rejectSchema } = require('../schemas/proforma.schema');

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/', requireRole('sales', 'admin'), validate(proformaSchema), controller.create);

router.use('/:id', parseId());
router.get('/:id', controller.getOne);
router.get('/:id/history', controller.history);
router.get('/:id/pdf', controller.pdf);
router.put('/:id', requireRole('sales', 'supervisor', 'admin'), validate(proformaSchema), controller.update);
router.post('/:id/submit', requireRole('sales', 'admin'), controller.submit);
router.post('/:id/approve', requireRole('supervisor', 'admin'), validate(approveSchema), controller.approve);
router.post('/:id/reject', requireRole('supervisor', 'admin'), validate(rejectSchema), controller.reject);
router.delete('/:id', requireRole('sales', 'admin'), controller.remove);

module.exports = router;
