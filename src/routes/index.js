const { Router } = require('express');

const router = Router();

router.use('/health', require('./health.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/customers', require('./customer.routes'));
router.use('/products', require('./product.routes'));
router.use('/proformas', require('./proforma.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/settings', require('./setting.routes'));
router.use('/order-steps', require('./orderStep.routes'));
router.use('/orders', require('./order.routes'));
router.use('/track', require('./tracking.routes'));
router.use('/activity', require('./activity.routes'));

module.exports = router;
