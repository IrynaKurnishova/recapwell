// Creates the Recapwell "Team" product and its monthly/yearly prices in your Stripe sandbox.
// Safe to run more than once. Usage: npm run stripe:setup
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY must be a sandbox/test key (sk_test_...) in .env.local");
  process.exit(1);
}

const stripe = new Stripe(key);
const PRODUCT_ID = "recapwell_team";
const PRICES = [
  { lookup_key: "recapwell_team_monthly", unit_amount: 2900, interval: "month", nickname: "Team monthly" },
  { lookup_key: "recapwell_team_yearly", unit_amount: 29000, interval: "year", nickname: "Team yearly" },
];

async function ensureProduct() {
  try {
    const product = await stripe.products.retrieve(PRODUCT_ID);
    console.log(`✓ Product exists: ${product.name}`);
    return product;
  } catch (err) {
    if (err?.code !== "resource_missing") throw err;
    const product = await stripe.products.create({
      id: PRODUCT_ID,
      name: "Recapwell Team",
      description: "Up to 15 members, 300 recaps per month and all modules.",
      metadata: { app: "recapwell" },
    });
    console.log(`+ Created product: ${product.name}`);
    return product;
  }
}

async function ensurePrice(product, { lookup_key, unit_amount, interval, nickname }) {
  const existing = await stripe.prices.list({ lookup_keys: [lookup_key], active: true, limit: 1 });
  if (existing.data[0]) {
    console.log(`✓ Price exists: ${lookup_key} (${existing.data[0].id})`);
    return;
  }
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount,
    recurring: { interval },
    lookup_key,
    nickname,
  });
  console.log(`+ Created price: ${lookup_key} (${price.id})`);
}

const product = await ensureProduct();
for (const price of PRICES) await ensurePrice(product, price);
console.log("Done. Prices are found by lookup key, so nothing to copy into .env.local.");
