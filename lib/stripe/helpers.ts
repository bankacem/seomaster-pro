import type Stripe from "stripe";
import { addCredits } from "@/lib/credits";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { getPlanForPrice, PLAN_CONFIG } from "@/lib/stripe/plans";
import type { Plan } from "@/lib/types";

export async function getOrCreateCustomer(userId: string, email: string) {
  const admin = createAdminClient();
  const { data: profile, error } = await admin.from("profiles").select("stripe_customer_id").eq("id", userId).single();
  if (error) throw new Error(`Unable to load billing profile: ${error.message}`);
  if (profile.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await getStripe().customers.create({ email, metadata: { userId } });
  const { error: updateError } = await admin.from("profiles").update({ stripe_customer_id: customer.id }).eq("id", userId);
  if (updateError) throw new Error(`Unable to save Stripe customer: ${updateError.message}`);
  return customer.id;
}

export async function updateUserPlan(userId: string, plan: Plan, credits: number) {
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ plan, credits }).eq("id", userId);
  if (error) throw new Error(`Unable to update user plan: ${error.message}`);
}

export async function syncSubscription(subscription: Stripe.Subscription, userId?: string) {
  const admin = createAdminClient();
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const resolvedUserId = userId || subscription.metadata.userId;
  if (!resolvedUserId) {
    const { data: profile } = await admin.from("profiles").select("id").eq("stripe_customer_id", customerId).single();
    if (!profile) throw new Error("Stripe subscription is not linked to a user");
    userId = profile.id;
  } else {
    userId = resolvedUserId;
  }
  const ownerId = userId;
  if (!ownerId) throw new Error("Stripe subscription is not linked to a user");

  const priceId = subscription.items.data[0]?.price.id;
  const plan = subscription.status === "canceled" ? "free" : getPlanForPrice(priceId);
  const existing = await admin.from("subscriptions").select("plan").eq("stripe_subscription_id", subscription.id).maybeSingle();
  const wasSamePlan = existing.data?.plan === plan;
  const periodStart = subscription.items.data[0]?.current_period_start;
  const periodEnd = subscription.items.data[0]?.current_period_end;

  const { error } = await admin.from("subscriptions").upsert({
    user_id: ownerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId || "",
    plan,
    status: subscription.status,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
  }, { onConflict: "stripe_subscription_id" });
  if (error) throw new Error(`Unable to sync subscription: ${error.message}`);

  if (!wasSamePlan || plan === "free") {
    await updateUserPlan(ownerId, plan, PLAN_CONFIG[plan].credits);
  }
}

export async function markSubscriptionPastDue(customerId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("stripe_customer_id", customerId).single();
  if (!profile) return;
  await admin.from("subscriptions").update({ status: "past_due" }).eq("user_id", profile.id).eq("status", "active");
}