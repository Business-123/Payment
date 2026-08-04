const express = require('express');
const prisma = require('../config/prisma');
const paystack = require('../services/paystack');

const router = express.Router();

// GET /api/v1/transaction/return/:reference
// This is the exact URL set as `callback_url` when initializing with Paystack, so
// Paystack redirects the CUSTOMER'S BROWSER here after checkout — success or failure.
//
// No auth headers arrive with a browser redirect (there's no JS running to sign anything),
// so this route is intentionally public. It only ever forwards the browser onward to the
// redirectUrl the merchant site itself supplied when it called /initialize — it never
// exposes Paystack secrets or lets the caller redirect anywhere arbitrary beyond that.
router.get('/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const txn = await prisma.transaction.findUnique({ where: { reference } });

    if (!txn || !txn.redirectUrl) {
      return res.status(404).send('Transaction not found.');
    }

    // Always re-verify with Paystack directly rather than trusting the redirect alone —
    // a customer could reach this URL without ever actually completing payment.
    const paystackResp = await paystack.verifyTransaction(reference);
    const paystackStatus = paystackResp?.data?.status;
    const statusMap = { success: 'SUCCESS', failed: 'FAILED', abandoned: 'ABANDONED' };
    const newStatus = statusMap[paystackStatus] || txn.status;

    if (newStatus !== txn.status) {
      await prisma.transaction.update({ where: { reference }, data: { status: newStatus } });
    }

    const url = new URL(txn.redirectUrl);
    url.searchParams.set('reference', reference);
    url.searchParams.set('status', newStatus);

    // The ONLY point in the whole system where the hub forwards the browser to one
    // of your 10 sites. Paystack itself never sees site1.com, site2.com, etc.
    return res.redirect(302, url.toString());
  } catch (err) {
    console.error('Return handler error for', req.params.reference, err.message);
    res.status(500).send(
      `Something went wrong confirming your payment. Please contact support with reference: ${req.params.reference}`
    );
  }
});

module.exports = router;
