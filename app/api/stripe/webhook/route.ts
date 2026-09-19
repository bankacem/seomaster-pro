import Stripe from "stripe";
import { markSubscriptionPastDue, syncSubscription } from "@/lib/stripe/helpers";
import { getStripe } from "@/lib/stripe/client";
import { jsonError } from "@/lib/utils";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return jsonError("Stripe webhook is not configured", 500, "WEBHOOK_CONFIG_ERROR");

  try {
    const payload = await request.text();
    const event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subscription = await getStripe().subscriptions.retrieve(session.subscription.toString());
          await syncSubscription(subscription, session.metadata?.userId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) await markSubscriptionPastDue(customerId);
        break;
      }
      default:
        break;
    }

    return Response.json({ data: { received: true } });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return jsonError("Invalid Stripe signature", 400, "INVALID_SIGNATURE");
    }
    console.error("Stripe webhook failed:", error);
    return jsonError("Webhook processing failed", 500, "WEBHOOK_FAILED");
  }
}