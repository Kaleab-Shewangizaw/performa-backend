const { Router } = require('express');
const controller = require('../controllers/product.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { parseId } = require('../middleware/parseId');
const { productSchema } = require('../schemas/product.schema');

const router = Router();

// Everyone authenticated can browse the catalog; only admin manages it.
router.use(requireAuth);

router.get('/meta', controller.meta);
router.get('/', controller.list);
router.post('/', requireRole('admin'), validate(productSchema), controller.create);

router.use('/:id', parseId());
router.get('/:id', controller.getOne);
router.put('/:id', requireRole('admin'), validate(productSchema), controller.update);
router.delete('/:id', requireRole('admin'), controller.remove);

module.exports = router;
