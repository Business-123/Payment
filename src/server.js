require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const adminRoutes = require('./routes/admin');
const transactionRoutes = require('./routes/transaction');
const transactionReturnRoutes = require('./routes/transactionReturn');
const paystackWebhookRoutes = require('./routes/paystackWebhook');

const app = express();

app.use(helmet());
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
