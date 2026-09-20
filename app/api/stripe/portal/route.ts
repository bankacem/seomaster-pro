import { getAuthenticatedUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe/client";
import { getAppUrl, jsonError } from "@/lib/utils";

export async function POST() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const { data: profile, error } = await supabase.from("profiles").select("stripe_customer_id").eq("id", user.id).single();
    if (error) return jsonError("Billing profile not found", 404, "CUSTOMER_NOT_FOUND");
    if (!profile.stripe_customer_id) return jsonError("No Stripe customer exists yet", 404, "CUSTOMER_NOT_FOUND");

    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: getAppUrl(),
    });
    return Response.json({ data: { url: session.url } });
  } catch (error) {
    console.error("Billing portal creation failed:", error);
    return jsonError(error instanceof Error ? error.message : "Unable to create billing portal session", 500, "PORTAL_FAILED");
  }
}