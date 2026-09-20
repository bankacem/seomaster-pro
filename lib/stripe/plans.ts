import type { Plan } from "@/lib/types";

export const PLAN_CONFIG: Record<Plan, { name: string; credits: number; priceId?: string }> = {
  free: { name: "Free", credits: 5 },
  pro: { name: "Pro", credits: 100, priceId: process.env.STRIPE_PRICE_PRO },
  enterprise: { name: "Enterprise", credits: 1000, priceId: process.env.STRIPE_PRICE_ENTERPRISE },
};

export function getPlanForPrice(priceId: string | null | undefined): Plan {
  if (priceId && priceId === PLAN_CONFIG.enterprise.priceId) return "enterprise";
  if (priceId && priceId === PLAN_CONFIG.pro.priceId) return "pro";
  return "free";
}