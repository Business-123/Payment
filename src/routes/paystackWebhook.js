const express = require('express');
const axios = require('axios');
const prisma = require('../config/prisma');
const paystack = require('../services/paystack');
const { computeSignature } = require('../utils/signature');

const router = express.Router();

// POST /webhook/paystack
// Set this exact URL in your Paystack Dashboard -> Settings -> API Keys & Webhooks.
// This is the ONLY place Paystack ever sends data to. Your 10 sites never appear here.
router.post('/', async (req, res, next) => {
  try {
    const signature = req.header('x-paystack-signature');
    const rawBody = req.rawBody || '';

    if (!signature || !paystack.isValidPaystackWebhook(rawBody, signature)) {
      return res.status(401).json({ status: false, message: 'Invalid signature' });
    }

    // Acknowledge immediately — Paystack expects a fast 200. Do the heavy work after.
    res.status(200).json({ status: true });

    const event = req.body;

    await prisma.webhookEvent.create({
      data: { eventType: event.event, reference: event?.data?.reference, rawPayload: JSON.stringify(event) },
    });

    if (event.event !== 'charge.success') return; // only care about successful charges here

    const reference = event.data.reference;
    const txn = await prisma.transaction.findUnique({ where: { reference }, include: { merchant: true } });
    if (!txn) return;

    const newStatus = event.data.status === 'success' ? 'SUCCESS' : 'FAILED';

    await prisma.transaction.update({
      where: { reference },
      data: { status: newStatus },
    });

    // Notify the merchant site's own webhook, signed with THEIR secret so they can
    // verify it came from the hub (mirrors how Paystack signs webhooks to us).
    const payload = {
      event: 'transaction.completed',
      reference,
      status: newStatus,
      amount: Number(txn.amountKobo) / 100,
      currency: txn.currency,
      email: txn.email,
      // metadata is stored as a JSON string (SQLite has no native Json type) — parse
      // it back to an object so merchant sites receive the same shape they sent in.
      metadata: txn.metadata ? JSON.parse(txn.metadata) : {},
    };
    const body = JSON.stringify(payload);
    const sig = computeSignature(txn.merchant.apiSecret, body);

    try {
      await axios.post(txn.merchant.webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json', 'x-hub-signature': sig },
        timeout: 10000,
      });
      await prisma.transaction.update({ where: { reference }, data: { merchantNotified: true } });
    } catch (notifyErr) {
      // If the merchant site is briefly down, the site can still call
      // GET /api/v1/transaction/verify/:reference itself to reconcile.
      console.error(`Failed to notify merchant ${txn.merchant.name} for ${reference}:`, notifyErr.message);
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
