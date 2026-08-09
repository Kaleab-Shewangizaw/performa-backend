const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const orderTrackingService = require('../services/orderTracking.service');

// Public, unauthenticated. A miss on the number OR the phone returns the same
// generic 404 so the endpoint can't be used to confirm which numbers exist.
const track = asyncHandler(async (req, res) => {
  const { number, phone } = req.body;
  const result = await orderTrackingService.buildPublicTracking(number, phone);
  if (!result) {
    throw new ApiError(404, 'No order found for that number and phone');
  }
  res.json({ tracking: result });
});

module.exports = { track };
