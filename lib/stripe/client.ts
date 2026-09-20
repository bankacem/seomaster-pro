import Stripe from "stripe";

let stripe: Stripe | undefined;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}