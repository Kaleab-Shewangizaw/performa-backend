const { Router } = require('express');
const controller = require('../controllers/notification.controller');
const { requireAuth } = require('../middleware/auth');
const { parseId } = require('../middleware/parseId');

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/read-all', controller.markAllRead);
router.post('/:id/read', parseId(), controller.markRead);

module.exports = router;
