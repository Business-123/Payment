require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const adminRoutes = require('./routes/admin');
const transactionRoutes = require('./routes/transaction');
const transactionReturnRoutes = require('./routes/transactionReturn');
const paystackWebhookRoutes = require('./routes/paystackWebhook');
const { getHubPublicUrl } = require('./utils/publicUrl');

// Fail fast and loudly at boot if HUB_PUBLIC_URL is missing/malformed, rather than
// silently sending Paystack a broken callback_url on every single payment attempt.
getHubPublicUrl();

const app = express();

// Railway (and most PaaS) sit behind a reverse proxy that sets X-Forwarded-For.
// Without this, express-rate-limit can't safely determine the real client IP.
app.set('trust proxy', 1);


// CSP disabled because the dashboard is a single self-contained HTML file with an
// inline <script>; helmet's default CSP blocks inline scripts. Other helmet
// protections (X-Frame-Options, etc.) stay on. The dashboard itself is still gated
// by the admin key, and every write it makes goes through the same authenticated
// /admin/* endpoints as the CLI script.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
  })
);

// Basic rate limiting across the whole API — tune per your traffic.
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Capture the raw body on every request BEFORE it's parsed, because both merchant
// signature verification and Paystack's webhook signature verification need the
// exact raw bytes that were sent — not a re-serialized version of the parsed JSON.
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);

app.get('/health', (req, res) => res.json({ status: true, message: 'Payment hub is running' }));

// Public-facing landing page (DataLix). This is a plain static site — it makes no
// calls into the hub's API or database, and has no knowledge of merchants, keys,
// or transactions. It's served here purely so the hub's root URL shows something
// other than a 404; it is not part of the payment/admin system in any way.
app.use('/', express.static(path.join(__dirname, '../public/site')));

// Admin dashboard UI — visit https://<your-hub>/1234567890 to generate/manage API keys
// for your 10 sites without touching curl or Postman. It only calls the same
// authenticated /admin/* endpoints below, using the admin key you type into it.
// Note: this path is only "security by obscurity" — the real protection is still the
// x-admin-key check on every /admin/* request. Anyone who guesses/finds this path
// still can't do anything without the admin key.
app.use('/1234567890', express.static(path.join(__dirname, '../public/admin')));

app.use('/admin', adminRoutes);
// Public browser-redirect route — mounted BEFORE the signature-authenticated router
// so /return/:reference is never caught by merchantAuth (a browser can't sign requests).
app.use('/api/v1/transaction/return', transactionReturnRoutes);
app.use('/api/v1/transaction', transactionRoutes);
app.use('/webhook/paystack', paystackWebhookRoutes);

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    status: false,
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Payment hub listening on port ${PORT}`);
});

module.exports = app;
