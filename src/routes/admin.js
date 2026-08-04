const express = require('express');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();
router.use(adminAuth);

function generateKeyPair() {
  const apiKey = 'hub_pk_' + crypto.randomBytes(16).toString('hex');
  const apiSecret = 'hub_sk_' + crypto.randomBytes(32).toString('hex');
  return { apiKey, apiSecret };
}

// Register one of your 10 websites. Call this once per site, save the returned
// apiKey + apiSecret into that site's environment variables (never commit them).
router.post('/merchants', async (req, res, next) => {
  try {
    const { name, webhookUrl } = req.body;
    if (!name || !webhookUrl) {
      return res.status(400).json({ status: false, message: 'name and webhookUrl are required' });
    }

    const { apiKey, apiSecret } = generateKeyPair();

    const merchant = await prisma.merchant.create({
      data: { name, webhookUrl, apiKey, apiSecret },
    });

    // apiSecret is only ever shown once, right here — store it safely on the merchant site now.
    res.status(201).json({
      status: true,
      message: 'Merchant registered. Store apiSecret now — it will not be shown again.',
      data: {
        id: merchant.id,
        name: merchant.name,
        apiKey: merchant.apiKey,
        apiSecret: merchant.apiSecret,
        webhookUrl: merchant.webhookUrl,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/merchants', async (req, res, next) => {
  try {
    const merchants = await prisma.merchant.findMany({
      select: { id: true, name: true, apiKey: true, webhookUrl: true, isActive: true, createdAt: true },
    });
    res.json({ status: true, data: merchants });
  } catch (err) {
    next(err);
  }
});

router.patch('/merchants/:id/toggle', async (req, res, next) => {
  try {
    const merchant = await prisma.merchant.findUnique({ where: { id: req.params.id } });
    if (!merchant) return res.status(404).json({ status: false, message: 'Not found' });

    const updated = await prisma.merchant.update({
      where: { id: req.params.id },
      data: { isActive: !merchant.isActive },
    });
    res.json({ status: true, data: { id: updated.id, isActive: updated.isActive } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
