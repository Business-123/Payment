# Payment Hub

Central payment service. **Only this service talks to Paystack.** Your 10 websites talk to this hub's own API instead — they never see your Paystack secret key, and Paystack never talks to them directly.

```
Site 1 ─┐
Site 2 ─┤
  ...   ├──► Payment Hub (this repo) ──► Paystack
Site 10─┘            ▲
                      └── Paystack webhook comes back here only
```

## 1. Deploy on Railway

1. Push this repo to GitHub, connect it in Railway.
2. Add a **PostgreSQL** plugin in Railway — it auto-fills `DATABASE_URL`.
3. Set these environment variables in Railway:
   - `PAYSTACK_SECRET_KEY` (from your Paystack dashboard, live or test)
   - `PAYSTACK_PUBLIC_KEY`
   - `ADMIN_API_KEY` — generate with `openssl rand -hex 32`, keep it private to you
   - `ALLOWED_ORIGINS` — comma-separated list of your 10 site domains (only needed if calling from browser JS)
   - `HUB_PUBLIC_URL` — the Railway-assigned public URL of this service
4. Railway will run `npx prisma migrate deploy && npm start` automatically (see `railway.json`).
5. In the Paystack Dashboard → Settings → API Keys & Webhooks, set the webhook URL to:
   ```
   https://<your-hub>.up.railway.app/webhook/paystack
   ```

## 2. Register your 10 websites

### Option A — Admin dashboard (easiest)

Visit `https://<your-hub>.up.railway.app/dashboard`, enter your `ADMIN_API_KEY`, and use the form to connect each site. The API key + secret are shown once in a popup — copy them into that site's environment immediately.

### Option B — CLI script

Run this once per site (locally or via Railway's shell):

```bash
HUB_URL=https://<your-hub>.up.railway.app \
ADMIN_API_KEY=<your admin key> \
node src/scripts/createMerchant.js "site1.com" "https://site1.com/webhooks/hub"
```

This returns an `apiKey` and `apiSecret` **shown only once** — store them in that site's own environment variables (`.env`), never commit them.

## 3. How each of your 10 sites calls the hub

### Start a payment

```
POST https://<your-hub>/api/v1/transaction/initialize
Headers:
  Content-Type: application/json
  x-api-key: <that site's apiKey>
  x-signature: HMAC-SHA512( JSON body, that site's apiSecret )  — hex encoded
Body:
  {
    "email": "customer@example.com",
    "amount": 5000,
    "currency": "NGN",
    "redirectUrl": "https://site1.com/order/123/thank-you",
    "metadata": { "orderId": "123" }
  }
```

`redirectUrl` is **required** — it's the page on *your own site* the customer should land on after paying. Paystack only ever redirects the browser to the hub's own `/return/:reference` URL; the hub then verifies the payment and forwards the browser on to this `redirectUrl` with `?reference=...&status=...` appended. This is how the hub knows which of your 10 sites to send the customer back to, since Paystack itself never sees your site URLs.

Response gives `authorizationUrl` — redirect the customer there to pay on Paystack's checkout page.

Node.js example for a merchant site to call this:

```js
const crypto = require('crypto');
const axios = require('axios');

const body = { email: 'customer@example.com', amount: 5000 };
const raw = JSON.stringify(body);
const signature = crypto.createHmac('sha512', process.env.HUB_API_SECRET).update(raw).digest('hex');

const { data } = await axios.post('https://<your-hub>/api/v1/transaction/initialize', body, {
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.HUB_API_KEY,
    'x-signature': signature,
  },
});

// redirect customer to data.data.authorizationUrl
```

### Verify a payment

```
GET https://<your-hub>/api/v1/transaction/verify/:reference
Headers: x-api-key, x-signature (signature over an empty body "")
```

### Receive completion webhook

The hub POSTs to the `webhookUrl` you registered for that site, with header `x-hub-signature`. Verify it the same way the hub verifies Paystack:

```js
const expected = crypto.createHmac('sha512', HUB_API_SECRET).update(rawBody).digest('hex');
if (expected !== req.headers['x-hub-signature']) reject();
```

## 4. Local development

```bash
cp .env.example .env   # fill in real values
npm install
npx prisma migrate dev --name init
npm run dev
```

## Security notes

- Paystack secret key exists **only** in this service's environment.
- Each of your 10 sites gets its own `apiKey`/`apiSecret` pair — revoke one via `PATCH /admin/merchants/:id/toggle` without affecting the others.
- All merchant→hub and hub→merchant traffic is HMAC-signed, not just API-key gated.
- Webhook signature from Paystack is verified before any DB write.
