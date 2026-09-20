import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { crawlSiteAudit } from "@/lib/site-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const auditSchema = z.object({
  url: z.string().url(),
  max_pages: z.number().int().min(1).max(50).optional().default(20),
});

export async function POST(request: Request) {
  try {
    const parsed = auditSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Provide a valid public URL and max_pages between 1 and 50", 400, "VALIDATION_ERROR");

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const limit = rateLimit(`audit:${user.id}`, 3, 60 * 60_000);
    if (!limit.allowed) return jsonError("Audit limit reached. Try again later.", 429, "RATE_LIMITED");
    if ((await checkCredits(user.id)) < 1) return jsonError("No credits remaining", 402, "INSUFFICIENT_CREDITS");

    const result = await crawlSiteAudit(parsed.data.url, parsed.data.max_pages);
    const admin = createAdminClient();
    const { data: audit, error: insertError } = await admin.from("site_audits").insert({
      user_id: user.id,
      url: result.url,
      pages_crawled: result.summary.pagesCrawled,
      results: result,
    }).select("id, url, pages_crawled, results, created_at").single();
    if (insertError) throw new Error(`Unable to save site audit: ${insertError.message}`);

    const creditsLeft = await deductCredits(user.id);
    const { error: usageError } = await admin.from("usage_logs").insert({
      user_id: user.id,
      action: "site_audit",
      tokens_used: 0,
      cost_usd: 0,
      metadata: { audit_id: audit.id, pages_crawled: result.summary.pagesCrawled },
    });
    if (usageError) console.error("Unable to log site audit usage:", usageError.message);

    return Response.json({ data: { audit, credits_left: creditsLeft } }, { status: 201 });
  } catch (error) {
    console.error("Site audit failed:", error);
    return jsonError(error instanceof Error ? error.message : "Site audit failed", 500, "AUDIT_FAILED");
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase.from("site_audits").select("id, url, pages_crawled, results, created_at").order("created_at", { ascending: false }).limit(20);
    if (error) return jsonError("Unable to load site audits", 500, "AUDIT_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("Site audit history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}