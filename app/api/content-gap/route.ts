import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAIJson, callAIWithRetry } from "@/lib/ai";
import { jsonError } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 45;

const contentGapSchema = z.object({
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
  competitors: z
    .array(z.string().trim().min(3).max(253))
    .min(1, "At least one competitor is required")
    .max(5, "Maximum 5 competitors"),
});

type Intent = "informational" | "commercial" | "transactional";
type RecommendedAction = "create-new" | "optimize-existing" | "monitor";

interface ContentGap {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  cpc: number;
  intent: Intent;
  competitorsRanking: string[];
  recommendedAction: RecommendedAction;
}

interface ContentGapResult {
  domain: string;
  competitors: string[];
  gaps: ContentGap[];
  summary: string;
  totalOpportunityScore: number;
}

interface ContentGapRecord {
  id: string;
  domain: string;
  results: ContentGapResult;
  created_at: string;
}

function normalizeDomain(value: string) {
  const candidate = value.includes("://") ? value : `https://${value}`;
  try {
    return new URL(candidate).hostname.replace(/^www\./u, "").toLowerCase();
  } catch {
    return value.toLowerCase().replace(/^www\./u, "");
  }
}

async function generateContentGap(
  rawDomain: string,
  rawCompetitors: string[]
): Promise<ContentGapResult> {
  const domain = normalizeDomain(rawDomain);
  const competitors = rawCompetitors.map(normalizeDomain).filter((c) => c && c !== domain).slice(0, 5);
  if (competitors.length === 0) {
    throw new Error("At least one valid competitor is required");
  }

  const schemaDescription = `Return a valid JSON object with this EXACT structure:
{
  "domain": "string",
  "competitors": ["string", "..."],
  "gaps": [
    {
      "keyword": "string — a keyword competitors rank for that the target domain does NOT",
      "searchVolume": "integer >=0 (monthly searches)",
      "difficulty": "integer 0-100",
      "cpc": "number >=0 (USD)",
      "intent": "informational" | "commercial" | "transactional",
      "competitorsRanking": ["string — domain names of competitors that rank for this keyword"],
      "recommendedAction": "create-new" | "optimize-existing" | "monitor"
    }
  ],
  "summary": "string — strategic advice, 2-4 sentences",
  "totalOpportunityScore": "integer 0-100 — overall opportunity, higher = better"
}
Provide 8-20 gap items. Return ONLY valid JSON — no markdown, no code fences, no surrounding prose.`;

  const systemPrompt = `You are a senior SEO content strategist. Identify keywords that competitors rank for but the target domain does NOT. All numbers are plausible AI estimates, never claim they come from proprietary tools. ${schemaDescription}`;

  const userPrompt = `Perform a content gap analysis for the domain "${domain}" against these competitors: ${competitors.join(", ")}.

For each keyword gap:
- Choose realistic commercial / informational keywords competitors likely rank for.
- Provide estimated monthly search volume (integer), difficulty (0-100), CPC (USD).
- Identify the search intent (informational / commercial / transactional).
- List which of the supplied competitors rank for it.
- Recommend an action: "create-new" (build a new page), "optimize-existing" (improve a current page), or "monitor" (low priority / revisit later).

End with a strategic 2-4 sentence summary and a totalOpportunityScore 0-100 indicating how strong the combined opportunity is. Estimates only — no proprietary tool data.`;

  const { data: parsed } = await callAIWithRetry(() =>
    callAIJson<ContentGapResult>(userPrompt, systemPrompt, {
      temperature: 0.3,
      maxOutputTokens: 5000,
    })
  );

  parsed.domain = domain;
  parsed.competitors = competitors;
  parsed.gaps = (parsed.gaps || []).slice(0, 25);
  parsed.totalOpportunityScore = Math.max(0, Math.min(100, Math.round(parsed.totalOpportunityScore || 0)));
  return parsed;
}

export async function POST(request: Request) {
  try {
    const parsed = contentGapSchema.safeParse(await request.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Provide a valid domain and 1-5 competitors";
      return jsonError(msg, 400, "VALIDATION_ERROR");
    }

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const limit = rateLimit(`content-gap:${user.id}`, 10, 60_000);
    if (!limit.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests", code: "RATE_LIMITED" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
        },
      });
    }

    const credits = await checkCredits(user.id);
    if (credits < 2) return jsonError("Insufficient credits (2 required)", 402, "INSUFFICIENT_CREDITS");

    const result = await generateContentGap(parsed.data.domain, parsed.data.competitors);

    let savedRecord: ContentGapRecord;
    const admin = createAdminClient();
    const { data, error: insertError } = await admin
      .from("content_gaps")
      .insert({
        user_id: user.id,
        domain: result.domain,
        results: result,
      })
      .select("id, domain, results, created_at")
      .single();
    if (insertError) {
      console.warn("[content-gap] Unable to save (table may not exist):", insertError.message);
      savedRecord = {
        id: `tmp-${Date.now()}`,
        domain: result.domain,
        results: result,
        created_at: new Date().toISOString(),
      };
    } else {
      savedRecord = data as ContentGapRecord;
    }

    let creditsLeft = credits;
    try {
      creditsLeft = await deductCredits(user.id, 2);
    } catch (err) {
      console.warn("[content-gap] Unable to deduct credits:", err instanceof Error ? err.message : err);
    }

    try {
      await admin.from("usage_logs").insert({
        user_id: user.id,
        action: "content_gap",
        tokens_used: 0,
        cost_usd: 0,
        metadata: { record_id: savedRecord.id, domain: result.domain },
      });
    } catch (usageError) {
      console.warn(
        "[content-gap] Unable to log usage:",
        usageError instanceof Error ? usageError.message : usageError
      );
    }

    return Response.json({ data: { report: savedRecord, credits_left: creditsLeft } });
  } catch (error) {
    console.error("Content gap analysis failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Content gap analysis failed",
      500,
      "CONTENT_GAP_FAILED"
    );
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase
      .from("content_gaps")
      .select("id, domain, results, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return jsonError("Unable to load content gap history", 500, "CONTENT_GAP_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("Content gap history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
