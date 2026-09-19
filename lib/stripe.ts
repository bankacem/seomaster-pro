import Stripe from "stripe";
export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
export function getStripePriceId(plan: "pro" | "enterprise"): string | undefined { return plan === "pro" ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_ENTERPRISE_PRICE_ID; }
