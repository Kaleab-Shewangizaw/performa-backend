const ApiError = require('../utils/apiError');

// Minimal in-memory fixed-window rate limiter. No external dependency and no
// shared store — fine for a single-process deployment (cPanel/Passenger). If
// this ever runs multi-process, swap in a Redis-backed limiter.
//
// Guards the public tracking endpoint against brute-forcing the number+phone
// pair. Keyed by client IP; honours X-Forwarded-For only if the app is
// configured with `trust proxy`, so it can't be spoofed otherwise.
function rateLimit({ windowMs = 60_000, max = 20 } = {}) {
  const hits = new Map(); // key -> { count, resetAt }

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';

    let entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    // Opportunistic cleanup so the map can't grow unbounded.
    if (hits.size > 5000) {
      for (const [k, v] of hits) {
        if (now >= v.resetAt) hits.delete(k);
      }
    }

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return next(new ApiError(429, 'Too many requests. Please try again shortly.'));
    }
    next();
  };
}

module.exports = { rateLimit };
