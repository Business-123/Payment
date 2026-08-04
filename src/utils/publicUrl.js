/**
 * HUB_PUBLIC_URL must be the real, publicly-reachable HTTPS URL of this hub
 * deployment (e.g. https://payment-hub.up.railway.app). It gets stitched into
 * the `callback_url` we hand to Paystack — if it's missing or malformed, Paystack
 * still accepts it at checkout-start time, but has nowhere real to send the
 * customer's browser back to once they've paid. They end up stranded on
 * Paystack's own domain, which looks like "the callback isn't working" with no
 * error anywhere to explain why.
 *
 * We validate this once at startup so a bad deploy fails immediately and loudly,
 * instead of failing silently for every customer at the worst possible moment.
 */
function getHubPublicUrl() {
  const raw = (process.env.HUB_PUBLIC_URL || '').trim();

  if (!raw) {
    throw new Error(
      'HUB_PUBLIC_URL is not set. It must be this service\'s own public HTTPS URL ' +
      '(e.g. https://payment-hub.up.railway.app) — Paystack needs it to redirect ' +
      'customers back after checkout. Set it in the environment and redeploy.'
    );
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `HUB_PUBLIC_URL is not a valid absolute URL: "${raw}". ` +
      'It must look like https://payment-hub.up.railway.app (no trailing slash needed).'
    );
  }

  if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    throw new Error(
      `HUB_PUBLIC_URL must be https:// in production, got "${raw}". ` +
      'Paystack redirects will fail or be flagged insecure otherwise.'
    );
  }

  // Strip any trailing slash so we never accidentally produce a double slash
  // when we append a path to it.
  return raw.replace(/\/+$/, '');
}

/**
 * Validates a merchant-supplied redirectUrl at /initialize time (fail fast,
 * with a clear 400) rather than only discovering it's broken later in
 * transactionReturn.js, after the customer has already paid.
 */
function assertValidRedirectUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`redirectUrl is not a valid absolute URL: "${raw}"`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`redirectUrl must be http:// or https://, got "${raw}"`);
  }
  return raw;
}

module.exports = { getHubPublicUrl, assertValidRedirectUrl };
