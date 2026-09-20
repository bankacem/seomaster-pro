import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAIJson, callAIWithRetry } from "@/lib/ai";
import { jsonError } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 30;

const localSeoSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(120),
  industry: z.string().trim().min(2).max(120),
});

type ChecklistStatus = "pass" | "fail" | "warning";
type Importance = "critical" | "high" | "medium" | "low";
type Difficulty = "low" | "medium" | "high";

interface ChecklistItem {
  item: string;
  status: ChecklistStatus;
  importance: Importance;
  recommendation: string;
}

interface CitationOpportunity {
  directory: string;
  url: string;
  difficulty: Difficulty;
}

interface LocalSeoResult {
  businessName: string;
  location: string;
  industry: string;
  localSeoScore: number;
  checklist: ChecklistItem[];
  localKeywords: string[];
  competitors: string[];
  citationOpportunities: CitationOpportunity[];
  summary: string;
}

interface LocalSeoRecord {
  id: string;
  domain: string;
  results: LocalSeoResult;
  created_at: string;
}

async function generateLocalSeo(
  businessName: string,
  location: string,
  industry: string
): Promise<LocalSeoResult> {
  const schemaDescription = `Return a valid JSON object with this EXACT structure:
{
  "businessName": "string",
  "location": "string",
  "industry": "string",
  "localSeoScore": "integer 0-100",
  "checklist": [
    {
      "item": "string — e.g. 'Google Business Profile claimed and verified'",
      "status": "pass" | "fail" | "warning",
      "importance": "critical" | "high" | "medium" | "low",
      "recommendation": "string — actionable advice"
    }
  ],
  "localKeywords": ["string — e.g. 'pizza near me', 'best pizza Brooklyn', ..."],
  "competitors": ["string — competitor business names"],
  "citationOpportunities": [
    { "directory": "string — e.g. 'Yelp'", "url": "string — submission URL or homepage", "difficulty": "low" | "medium" | "high" }
  ],
  "summary": "string — 2-4 sentences summarising the local SEO position"
}
Provide 8-14 checklist items, 8-15 local keywords, 3-6 competitors, and 5-10 citation opportunities.
Return ONLY valid JSON — no markdown, no code fences, no surrounding prose.`;

  const systemPrompt = `You are a local SEO expert who helps small businesses rank in the local pack and Google Maps. All scores and stats are AI estimates based on typical industry benchmarks — never claim they come from proprietary tools. ${schemaDescription}`;

  const userPrompt = `Analyse the local SEO presence of "${businessName}", a ${industry} business in ${location}.

Provide:
1. A local SEO score 0-100 reflecting the typical maturity of a business of this type/size.
2. A checklist of 8-14 items covering: Google Business Profile, NAP consistency, local citations, online reviews, schema markup, location pages, Google Maps, local link building, social signals, etc. Each item with pass/fail/warning status (vary them — don't mark everything pass), importance, and a recommendation.
3. 8-15 local keyword suggestions (e.g. "${industry} ${location}", "${industry} near me", "best ${industry} in ${location}").
4. 3-6 plausible local competitor business names.
5. 5-10 citation directory opportunities (Yelp, Yellow Pages, Bing Places, Apple Maps, Foursquare, Trustpilot, industry-specific directories, etc.) with URL and difficulty.
6. A 2-4 sentence summary of the business's local SEO position and biggest opportunities.

Estimates only — no proprietary tool data.`;

  const { data: parsed } = await callAIWithRetry(() =>
    callAIJson<LocalSeoResult>(userPrompt, systemPrompt, {
      temperature: 0.3,
      maxOutputTokens: 4500,
    })
  );

  parsed.businessName = businessName;
  parsed.location = location;
  parsed.industry = industry;
  parsed.localSeoScore = Math.max(0, Math.min(100, Math.round(parsed.localSeoScore || 0)));
  parsed.checklist = (parsed.checklist || []).slice(0, 20);
  parsed.localKeywords = (parsed.localKeywords || []).slice(0, 25);
  parsed.competitors = (parsed.competitors || []).slice(0, 10);
  parsed.citationOpportunities = (parsed.citationOpportunities || []).slice(0, 15);
  return parsed;
}

export async function POST(request: Request) {
  try {
    const parsed = localSeoSchema.safeParse(await request.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Provide a valid business name, location, and industry";
      return jsonError(msg, 400, "VALIDATION_ERROR");
    }

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const limit = rateLimit(`local-seo:${user.id}`, 10, 60_000);
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
    if (credits < 1) return jsonError("No credits remaining", 402, "INSUFFICIENT_CREDITS");

    const result = await generateLocalSeo(
      parsed.data.businessName,
      parsed.data.location,
      parsed.data.industry
    );

    // Build a synthetic "domain" column value — the table requires a NOT NULL
    // domain column. Use a slug of businessName + location to keep rows unique
    // and searchable.
    const slug = `${result.businessName} · ${result.location}`;

    let savedRecord: LocalSeoRecord;
    const admin = createAdminClient();
    const { data, error: insertError } = await admin
      .from("local_seo_reports")
      .insert({
        user_id: user.id,
        domain: slug,
        results: result,
      })
      .select("id, domain, results, created_at")
      .single();
    if (insertError) {
      console.warn("[local-seo] Unable to save (table may not exist):", insertError.message);
      savedRecord = {
        id: `tmp-${Date.now()}`,
        domain: slug,
        results: result,
        created_at: new Date().toISOString(),
      };
    } else {
      savedRecord = data as LocalSeoRecord;
    }

    let creditsLeft = credits;
    try {
      creditsLeft = await deductCredits(user.id, 1);
    } catch (err) {
      console.warn("[local-seo] Unable to deduct credits:", err instanceof Error ? err.message : err);
    }

    try {
      await admin.from("usage_logs").insert({
        user_id: user.id,
        action: "local_seo",
        tokens_used: 0,
        cost_usd: 0,
        metadata: { record_id: savedRecord.id, business: result.businessName, location: result.location },
      });
    } catch (usageError) {
      console.warn(
        "[local-seo] Unable to log usage:",
        usageError instanceof Error ? usageError.message : usageError
      );
    }

    return Response.json({ data: { report: savedRecord, credits_left: creditsLeft } });
  } catch (error) {
    console.error("Local SEO analysis failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Local SEO analysis failed",
      500,
      "LOCAL_SEO_FAILED"
    );
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase
      .from("local_seo_reports")
      .select("id, domain, results, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return jsonError("Unable to load local SEO history", 500, "LOCAL_SEO_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("Local SEO history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
