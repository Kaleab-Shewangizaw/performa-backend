const { Router } = require('express');

const router = Router();

router.use('/health', require('./health.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/proformas', require('./proforma.routes'));

module.exports = router;
