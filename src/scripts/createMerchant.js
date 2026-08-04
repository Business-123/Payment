/**
 * Convenience CLI to register one of your 10 sites against a running hub instance.
 *
 * Usage:
 *   HUB_URL=https://your-hub.up.railway.app \
 *   ADMIN_API_KEY=xxxx \
 *   node src/scripts/createMerchant.js "site1.com" "https://site1.com/webhooks/hub"
 */
const axios = require('axios');

async function main() {
  const [, , name, webhookUrl] = process.argv;
  const HUB_URL = process.env.HUB_URL;
  const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

  if (!name || !webhookUrl || !HUB_URL || !ADMIN_API_KEY) {
    console.error('Usage: HUB_URL=... ADMIN_API_KEY=... node createMerchant.js <name> <webhookUrl>');
    process.exit(1);
  }

  const { data } = await axios.post(
    `${HUB_URL}/admin/merchants`,
    { name, webhookUrl },
    { headers: { 'x-admin-key': ADMIN_API_KEY } }
  );

  console.log(JSON.stringify(data, null, 2));
  console.log('\nSave apiKey + apiSecret into that site\'s environment now — the secret will not be shown again.');
}

main().catch((err) => {
  console.error(err.response?.data || err.message);
  process.exit(1);
});
