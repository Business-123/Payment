const axios = require('axios');
const crypto = require('crypto');

// This is the ONLY module in the entire system that ever talks to Paystack.
// Your 10 merchant sites never see this key and never call Paystack directly.

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const paystackClient = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

/**
 * Initializes a transaction with Paystack and returns the authorization URL
 * that the end customer should be redirected to.
 */
async function initializeTransaction({ email, amountKobo, reference, callbackUrl, metadata }) {
  const { data } = await paystackClient.post('/transaction/initialize', {
    email,
    amount: amountKobo, // Paystack expects the smallest currency unit (kobo/cents)
    reference,
    callback_url: callbackUrl,
    metadata,
  });
  return data; // { status, message, data: { authorization_url, access_code, reference } }
}

/**
 * Verifies a transaction's true status directly with Paystack.
 * Always trust this over webhook payloads alone — webhooks can be replayed/delayed.
 */
async function verifyTransaction(reference) {
  const { data } = await paystackClient.get(`/transaction/verify/${encodeURIComponent(reference)}`);
  return data; // { status, message, data: { status: 'success'|'failed'|..., amount, ... } }
}

/**
 * Validates that an incoming webhook actually originated from Paystack by
 * recomputing the HMAC-SHA512 signature over the raw request body.
 */
function isValidPaystackWebhook(rawBody, paystackSignatureHeader) {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');
  return hash === paystackSignatureHeader;
}

module.exports = { initializeTransaction, verifyTransaction, isValidPaystackWebhook };
