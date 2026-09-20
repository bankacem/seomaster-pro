import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAIJson, callAIWithRetry } from "@/lib/ai";
import { jsonError } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 30;

const competitorSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(3)
    .max(253)
    .refine((value) => {
      try {
        const candidate = value.includes("://") ? value : `https://${value}`;
        const url = new URL(candidate);
        return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".");
      } catch {
        return false;
      }
    }, "Provide a valid domain or URL"),
});

interface Competitor {
  domain: string;
  traffic_estimate: number;
  keywords_overlap: number;
  competition_level: "low" | "medium" | "high";
}

interface CompetitorAnalysis {
  domain: string;
  competitors: Competitor[];
  shared_keywords: string[];
  gaps: string[];
  summary: string;
}

function normalizeDomain(value: string) {
  const candidate = value.includes("://") ? value : `https://${value}`;
  try {
    return new URL(candidate).hostname.replace(/^www\./u, "").toLowerCase();
  } catch {
    return value.toLowerCase().replace(/^www\./u, "");
  }
}

async function generateCompetitorAnalysis(rawDomain: string): Promise<CompetitorAnalysis> {
  const domain = normalizeDomain(rawDomain);

  const schemaDescription = `Return a valid JSON object with this exact structure:
{
  "domain": "string",
  "competitors": [
    {
      "domain": "string",
      "traffic_estimate": "integer >=0",
      "keywords_overlap": "integer >=0",
      "competition_level": "low" | "medium" | "high"
    }
  ],
  "shared_keywords": ["array of up to 10 strings"],
  "gaps": ["array of strings"],
  "summary": "string, 1-2 sentences"
}
Provide up to 5 competitors. Return ONLY valid JSON — no markdown, no code fences, no surrounding prose.`;

  const systemPrompt = `You are a senior competitive SEO analyst. Return JSON only. Numbers are plausible AI estimates, not exact figures from proprietary indexes. ${schemaDescription}`;

  const userPrompt = `Perform an AI-estimated competitive analysis for the domain "${domain}". List up to 5 plausible competitor domains with traffic estimates, keyword overlap counts, and competition level. Provide up to 10 shared keywords and a list of keyword gaps (competitor keywords the target doesn't rank for). End with a short 1-2 sentence summary. Do not claim exact proprietary data; estimates only.`;

  const { data: parsed } = await callAIWithRetry(() =>
    callAIJson<CompetitorAnalysis>(userPrompt, systemPrompt, { temperature: 0.2 })
  );

  parsed.domain = domain;
  parsed.competitors = (parsed.competitors || []).slice(0, 5);
  parsed.shared_keywords = (parsed.shared_keywords || []).slice(0, 10);
  return parsed;
}

export async function POST(request: Request) {
  try {
    const parsed = competitorSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Provide a valid domain or URL", 400, "VALIDATION_ERROR");

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const limit = rateLimit(`competitors:${user.id}`, 10, 60_000);
    if (!limit.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests", code: "RATE_LIMITED" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      });
    }

    const credits = await checkCredits(user.id);
    if (credits < 1) return jsonError("No credits remaining", 402, "INSUFFICIENT_CREDITS");

    const result = await generateCompetitorAnalysis(parsed.data.domain);
    const admin = createAdminClient();
    const { data: record, error: insertError } = await admin
      .from("competitor_analyses")
      .insert({
        user_id: user.id,
        domain: result.domain,
        results: result,
      })
      .select("id, domain, results, created_at")
      .single();
    if (insertError) throw new Error(`Unable to save competitor analysis: ${insertError.message}`);

    const creditsLeft = await deductCredits(user.id);
    const { error: usageError } = await admin.from("usage_logs").insert({
      user_id: user.id,
      action: "competitor_analysis",
      tokens_used: 0,
      cost_usd: 0,
      metadata: { record_id: record.id, domain: result.domain },
    });
    if (usageError) console.error("Unable to log competitor usage:", usageError.message);

    return Response.json({ data: { analysis: record, credits_left: creditsLeft } });
  } catch (error) {
    console.error("Competitor analysis failed:", error);
    return jsonError(error instanceof Error ? error.message : "Competitor analysis failed", 500, "COMPETITOR_FAILED");
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase
      .from("competitor_analyses")
      .select("id, domain, results, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return jsonError("Unable to load competitor analyses", 500, "COMPETITOR_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("Competitor history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
