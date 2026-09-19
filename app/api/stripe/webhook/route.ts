import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !signature || !webhookSecret) {
    return Response.json({ error: "Stripe webhook is not configured" }, { status: 400 });
  }

  try {
    const payload = await request.text();
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    switch (event.type) {
      case "checkout.session.completed":
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "invoice.payment_failed":
        console.error("Stripe event received", event.type, event.id);
        // Persist subscription state in Supabase here when billing tables are configured.
        break;
      default:
        break;
    }
    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Stripe webhook failed", error);
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }
}
