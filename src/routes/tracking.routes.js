const { Router } = require('express');
const controller = require('../controllers/tracking.controller');
const { validate } = require('../middleware/validate');
const { rateLimit } = require('../middleware/rateLimit');
const { trackSchema } = require('../schemas/order.schema');

const router = Router();

// PUBLIC — no auth. Rate-limited to blunt brute-forcing of the number+phone
// pair. This is the only endpoint the customer.shrubsma.com page calls.
router.post('/', rateLimit({ windowMs: 60_000, max: 20 }), validate(trackSchema), controller.track);

module.exports = router;
