const prisma = require('../config/prisma');
const { computeSignature, safeCompare } = require('../utils/signature');

/**
 * Authenticates a request coming from one of your 10 websites.
 * Requires headers:
 *   x-api-key:   the merchant's public-ish identifier
 *   x-signature: HMAC-SHA512( raw JSON body, merchant's api_secret )
 *
 * Attaches req.merchant on success.
 */
async function merchantAuth(req, res, next) {
  try {
    const apiKey = req.header('x-api-key');
    const signature = req.header('x-signature');

    if (!apiKey || !signature) {
      return res.status(401).json({ status: false, message: 'Missing x-api-key or x-signature header' });
    }

    const merchant = await prisma.merchant.findUnique({ where: { apiKey } });

    if (!merchant || !merchant.isActive) {
      return res.status(401).json({ status: false, message: 'Invalid or inactive API key' });
    }

    // req.rawBody is captured in server.js via express.json's verify hook.
    const expectedSignature = computeSignature(merchant.apiSecret, req.rawBody || '');

    if (!safeCompare(signature, expectedSignature)) {
      return res.status(401).json({ status: false, message: 'Signature verification failed' });
    }

    req.merchant = merchant;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = merchantAuth;
