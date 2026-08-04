const crypto = require('crypto');

/**
 * Computes an HMAC-SHA512 signature over a JSON payload using a merchant's secret.
 * Your 10 sites must compute this same signature when calling the hub.
 *
 * Node.js example a merchant site would use:
 *   const crypto = require('crypto');
 *   const body = JSON.stringify(payload); // must match EXACTLY what's sent
 *   const signature = crypto.createHmac('sha512', API_SECRET).update(body).digest('hex');
 *   // send as header: x-signature: signature
 *   //                  x-api-key: apiKey
 */
function computeSignature(secret, rawBody) {
  return crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
}

/**
 * Timing-safe comparison to avoid signature-comparison timing attacks.
 */
function safeCompare(a, b) {
  const bufA = Buffer.from(a || '', 'utf8');
  const bufB = Buffer.from(b || '', 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { computeSignature, safeCompare };
