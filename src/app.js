const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const env = require('./config/env');

const app = express();

// Behind Apache/Passenger (cPanel) the app is proxied, so trust the first hop
// for correct protocol/IP.
app.set('trust proxy', 1);

// helmet with a CSP that fits this app: the SPA loads its own JS/CSS, renders
// base64 (data:) logos, and opens generated PDFs as blob: URLs; some UI libs
// inject <style> at runtime, so inline styles are allowed.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        baseUri: ["'self'"],
      },
    },
    // Allow the app to open its own blob: PDF in a new tab.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);

// Same-origin by default (the app serves its own SPA); restrict only when a
// split deployment sets CORS_ORIGIN.
app.use(
  cors(
    env.corsOrigin
      ? { origin: env.corsOrigin.split(',').map((s) => s.trim()), credentials: true }
      : { origin: true, credentials: true }
  )
);

// Settings can carry a base64 logo, so allow a generous JSON body.
app.use(express.json({ limit: '2mb' }));

if (env.nodeEnv !== 'test') {
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
}

// API responses must never be cached — not by the browser, a CDN, or the
// LiteSpeed cache many cPanel servers run. Without this, a create/update
// writes to the DB but the next read is served from a stale cached copy, so
// the UI "never changes" (and shows the same stale data to everyone).
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use('/api', routes);

// Single-app deployment: when a built frontend is present, serve it. The API is
// mounted above, so /api/* is never shadowed by the SPA fallback.
const clientDir = path.resolve(__dirname, '..', env.clientDir);
const indexHtml = path.join(clientDir, 'index.html');

if (fs.existsSync(indexHtml)) {
  // Hashed assets can cache hard; index.html must not, so new deploys are seen.
  app.use(express.static(clientDir, { index: false, maxAge: '1y', etag: true }));

  // SPA fallback. Express 5's path parser rejects a bare '*', so this is a
  // path-less middleware that only handles non-API GETs that reached this far.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
