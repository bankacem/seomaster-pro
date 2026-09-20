import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { getOrCreateCustomer } from "@/lib/stripe/helpers";
import { getStripe } from "@/lib/stripe/client";
import { PLAN_CONFIG } from "@/lib/stripe/plans";
import { getAppUrl, jsonError } from "@/lib/utils";

const checkoutSchema = z.object({ priceId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const parsed = checkoutSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("priceId is required", 400, "VALIDATION_ERROR");

    const { user } = await getAuthenticatedUser();
    if (!user || !user.email) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const isKnownPrice = Object.values(PLAN_CONFIG).some((plan) => plan.priceId === parsed.data.priceId);
    if (!isKnownPrice) return jsonError("Unknown subscription price", 400, "INVALID_PRICE");

    const customerId = await getOrCreateCustomer(user.id, user.email);
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: parsed.data.priceId, quantity: 1 }],
      success_url: `${getAppUrl()}/api/user/me?checkout=success`,
      cancel_url: `${getAppUrl()}/api/user/me?checkout=cancelled`,
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
    });
    if (!session.url) return jsonError("Stripe did not return a checkout URL", 500, "CHECKOUT_URL_MISSING");
    return Response.json({ data: { url: session.url } });
  } catch (error) {
    console.error("Checkout session creation failed:", error);
    return jsonError(error instanceof Error ? error.message : "Unable to create checkout session", 500, "CHECKOUT_FAILED");
  }
}