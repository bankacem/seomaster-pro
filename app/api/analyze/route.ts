import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { analyzeArticle } from "@/lib/seo-agent";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils";

const analyzeSchema = z.object({
  content: z.string().trim().min(100).max(40_000),
  url: z.string().url().optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = analyzeSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Content must be between 100 and 40,000 characters", 400, "VALIDATION_ERROR");

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const limit = rateLimit(user.id, 10, 60_000);
    if (!limit.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests", code: "RATE_LIMITED" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      });
    }

    const credits = await checkCredits(user.id);
    if (credits < 1) return jsonError("No credits remaining", 402, "INSUFFICIENT_CREDITS");

    const result = await analyzeArticle(parsed.data.content);
    const admin = createAdminClient();
    const { data: analysis, error: insertError } = await admin.from("analyses").insert({
      user_id: user.id,
      content: parsed.data.content,
      url: parsed.data.url || null,
      score: result.score,
      results: result,
      tokens_used: 0,
    }).select("id, score, results, created_at, content, url").single();
    if (insertError) throw new Error(`Unable to save analysis: ${insertError.message}`);

    const creditsLeft = await deductCredits(user.id);
    const { error: usageError } = await admin.from("usage_logs").insert({
      user_id: user.id,
      action: "article_analysis",
      tokens_used: 0,
      cost_usd: 0,
      metadata: { analysis_id: analysis.id },
    });
    if (usageError) throw new Error(`Unable to log usage: ${usageError.message}`);

    return Response.json({ data: { analysis, credits_left: creditsLeft } });
  } catch (error) {
    console.error("Article analysis failed:", error);
    return jsonError(error instanceof Error ? error.message : "Analysis failed", 500, "ANALYSIS_FAILED");
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase
      .from("analyses")
      .select("id, url, score, results, created_at, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return jsonError("Unable to load analyses", 500, "ANALYSIS_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("Analyses history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
