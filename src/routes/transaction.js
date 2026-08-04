const express = require('express');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');
const merchantAuth = require('../middleware/merchantAuth');
const paystack = require('../services/paystack');

const router = express.Router();
router.use(merchantAuth);

// POST /api/v1/transaction/initialize
// Body: { email, amount (in NAIRA, not kobo), currency?, metadata? }
// This is the ONLY endpoint your sites need to start a payment. The hub talks to
// Paystack on your site's behalf and returns a checkout URL to redirect the customer to.
router.post('/initialize', async (req, res, next) => {
  try {
    const { email, amount, currency = 'GHS', metadata, redirectUrl } = req.body;

    if (!email || !amount) {
      return res.status(400).json({ status: false, message: 'email and amount are required' });
    }

    if (!redirectUrl) {
      return res.status(400).json({
        status: false,
        message: 'redirectUrl is required — the page on YOUR site the customer should land on after payment (e.g. https://site1.com/order/123/thank-you)',
      });
    }

    const amountKobo = Math.round(Number(amount) * 100);
    if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
      return res.status(400).json({ status: false, message: 'amount must be a positive number' });
    }

    // Reference is namespaced per merchant so 10 sites can never collide with each other.
    const reference = `${req.merchant.name.replace(/[^a-zA-Z0-9]/g, '')}_${uuidv4()}`;

    const callbackUrl = `${process.env.HUB_PUBLIC_URL || ''}/api/v1/transaction/return/${reference}`;

    const paystackResp = await paystack.initializeTransaction({
      email,
      amountKobo,
      reference,
      callbackUrl,
      metadata: { ...metadata, merchantId: req.merchant.id, merchantName: req.merchant.name },
    });

    if (!paystackResp.status) {
      return res.status(502).json({ status: false, message: 'Paystack rejected the request', detail: paystackResp.message });
    }

    await prisma.transaction.create({
      data: {
        reference,
        merchantId: req.merchant.id,
        amountKobo: BigInt(amountKobo),
        currency,
        email,
        status: 'PENDING',
        paystackAccessCode: paystackResp.data.access_code,
        authorizationUrl: paystackResp.data.authorization_url,
        redirectUrl,
        metadata: metadata || {},
      },
    });

    res.status(201).json({
      status: true,
      message: 'Transaction initialized',
      data: {
        reference,
        authorizationUrl: paystackResp.data.authorization_url,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/transaction/verify/:reference
// Your site calls this to confirm final status before granting access/shipping/etc.
// Only returns transactions that belong to the calling merchant.
router.get('/verify/:reference', async (req, res, next) => {
  try {
    const { reference } = req.params;

    const txn = await prisma.transaction.findUnique({ where: { reference } });
    if (!txn || txn.merchantId !== req.merchant.id) {
      return res.status(404).json({ status: false, message: 'Transaction not found' });
    }

    // Re-verify against Paystack directly rather than trusting only local DB state,
    // in case a webhook hasn't arrived yet.
    const paystackResp = await paystack.verifyTransaction(reference);
    const paystackStatus = paystackResp?.data?.status; // 'success' | 'failed' | 'abandoned'

    const statusMap = { success: 'SUCCESS', failed: 'FAILED', abandoned: 'ABANDONED' };
    const newStatus = statusMap[paystackStatus] || txn.status;

    if (newStatus !== txn.status) {
      await prisma.transaction.update({ where: { reference }, data: { status: newStatus } });
    }

    res.json({
      status: true,
      data: {
        reference,
        status: newStatus,
        amount: Number(txn.amountKobo) / 100,
        currency: txn.currency,
        email: txn.email,
        paidAt: paystackResp?.data?.paid_at || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
