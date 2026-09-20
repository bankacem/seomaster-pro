import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAIJson, callAIWithRetry } from "@/lib/ai";
import { jsonError } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 45;

const serpSchema = z.object({
  keyword: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(5).optional(),
});

interface SerpResultItem {
  position: number;
  url: string;
  title: string;
  domain: string;
  domainAuthority: number;
  wordCount: number;
  loadTimeMs: number;
  hasSchema: boolean;
  backlinks: number;
}

interface SerpAnalysisResult {
  keyword: string;
  country: string;
  topResults: SerpResultItem[];
  contentGaps: string[];
  serpFeatures: string[];
  commonEntities: string[];
  avgWordCount: number;
  summary: string;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function generateSerpAnalysis(keyword: string, country: string): Promise<SerpAnalysisResult> {
  const schemaDescription = `Return a valid JSON object with this exact structure:
{
  "keyword": "string",
  "country": "string — ISO 3166-1 alpha-2 code (lowercase)",
  "topResults": [
    {
      "position": "integer 1-10",
      "url": "string — full URL of the ranking page",
      "title": "string — page <title>",
      "domain": "string — root domain (e.g. example.com)",
      "domainAuthority": "integer 0-100",
      "wordCount": "integer >=0",
      "loadTimeMs": "integer >=0 (page load time in ms)",
      "hasSchema": "boolean (has structured data / schema.org markup)",
      "backlinks": "integer >=0 (estimated referring backlinks to URL)"
    }
  ],
  "contentGaps": ["topic competitors cover that you should add", ...],
  "serpFeatures": ["featured-snippet", "people-also-ask", "video-carousel", "image-pack", "knowledge-panel", ...],
  "commonEntities": ["entities/topics mentioned across top results", ...],
  "avgWordCount": "integer — average word count across top results",
  "summary": "string — strategic advice for ranking (100-200 words)"
}
Provide up to 10 topResults sorted by position asc. Provide 3-8 contentGaps, 2-6 serpFeatures, 3-10 commonEntities. Estimates are AI-projected; do NOT claim exact data from proprietary indexes. Return ONLY valid JSON — no markdown, no code fences, no surrounding prose.`;

  const systemPrompt = `You are a senior SERP analyst. Simulate a realistic SERP analysis for the given keyword and country by projecting plausible top-10 ranking pages, their domain authority, content depth, technical signals, and the SERP features Google would surface. Reason about what it would take to outrank them. Return JSON only. ${schemaDescription}`;

  const userPrompt = `Simulate a SERP analysis for the keyword below. Produce a plausible top-10 of organic results (positions 1-10) for the country "${country}". For each result provide a realistic URL, page title, root domain, domain authority (0-100), page word count, page load time in ms, whether the page uses schema.org markup, and an estimated number of referring backlinks to the URL. Then list content gaps a new page targeting this keyword should cover, SERP features currently surfaced (featured-snippet, people-also-ask, video-carousel, image-pack, knowledge-panel, etc.), common entities/topics mentioned across the top results, the average word count of the top results, and a strategic summary (100-200 words) advising how a new page could rank for this keyword.

Keyword: "${keyword}"
Country: "${country}"

Important:
- Do not invent real backlink counts from proprietary indexes; they are AI estimates.
- Domain names should look plausible but must NOT impersonate real registered trademarks beyond what's necessary (prefer example-like or industry-realistic names).
- topResults MUST be sorted by position ascending and have unique positions 1..N.`;

  const { data: parsed } = await callAIWithRetry(() =>
    callAIJson<SerpAnalysisResult>(userPrompt, systemPrompt, { temperature: 0.4 })
  );

  if (!parsed) throw new Error("Invalid SERP analysis payload");

  const rawResults = Array.isArray(parsed.topResults) ? parsed.topResults : [];
  const seen = new Set<number>();
  const topResults: SerpResultItem[] = rawResults
    .filter((r) => r && typeof r === "object")
    .map((r) => ({
      position: Math.round(clampNumber(r.position, 1, 100, 99)),
      url: String(r.url || "").trim().slice(0, 500),
      title: String(r.title || "").trim().slice(0, 300),
      domain: String(r.domain || "").trim().slice(0, 200),
      domainAuthority: Math.round(clampNumber(r.domainAuthority, 0, 100, 0)),
      wordCount: Math.max(0, Math.round(clampNumber(r.wordCount, 0, 1_000_000, 0))),
      loadTimeMs: Math.max(0, Math.round(clampNumber(r.loadTimeMs, 0, 60_000, 0))),
      hasSchema: Boolean(r.hasSchema),
      backlinks: Math.max(0, Math.round(clampNumber(r.backlinks, 0, 1_000_000_000, 0))),
    }))
    .filter((r) => {
      if (seen.has(r.position)) return false;
      seen.add(r.position);
      return true;
    })
    .sort((a, b) => a.position - b.position)
    .slice(0, 10);

  const computedAvg =
    topResults.length > 0
      ? Math.round(topResults.reduce((acc, r) => acc + r.wordCount, 0) / topResults.length)
      : Math.round(clampNumber(parsed.avgWordCount, 0, 1_000_000, 0));

  return {
    keyword,
    country,
    topResults,
    contentGaps: Array.isArray(parsed.contentGaps) ? parsed.contentGaps.map(String).slice(0, 15) : [],
    serpFeatures: Array.isArray(parsed.serpFeatures) ? parsed.serpFeatures.map(String).slice(0, 15) : [],
    commonEntities: Array.isArray(parsed.commonEntities) ? parsed.commonEntities.map(String).slice(0, 20) : [],
    avgWordCount: computedAvg,
    summary: (parsed.summary || "").toString().trim().slice(0, 3000),
  };
}

export async function POST(request: Request) {
  try {
    const parsed = serpSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Keyword must be 2-120 chars; country must be 2-5 chars", 400, "VALIDATION_ERROR");

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const limit = rateLimit(`serp-analysis:${user.id}`, 10, 60_000);
    if (!limit.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests", code: "RATE_LIMITED" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      });
    }

    const credits = await checkCredits(user.id);
    if (credits < 1) return jsonError("No credits remaining", 402, "INSUFFICIENT_CREDITS");

    const country = (parsed.data.country || "us").toLowerCase();
    const result = await generateSerpAnalysis(parsed.data.keyword, country);

    const admin = createAdminClient();
    const { data: record, error: insertError } = await admin
      .from("serp_analyses")
      .insert({
        user_id: user.id,
        keyword: result.keyword,
        results: result,
      })
      .select("id, keyword, results, created_at")
      .single();
    if (insertError) throw new Error(`Unable to save SERP analysis: ${insertError.message}`);

    const creditsLeft = await deductCredits(user.id, 1);
    const { error: usageError } = await admin.from("usage_logs").insert({
      user_id: user.id,
      action: "serp_analysis",
      tokens_used: 0,
      cost_usd: 0,
      metadata: { record_id: record.id, keyword: result.keyword, country: result.country },
    });
    if (usageError) console.error("Unable to log serp_analysis usage:", usageError.message);

    return Response.json({ data: { analysis: record, credits_left: creditsLeft } });
  } catch (error) {
    console.error("SERP analysis failed:", error);
    return jsonError(error instanceof Error ? error.message : "SERP analysis failed", 500, "SERP_ANALYSIS_FAILED");
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase
      .from("serp_analyses")
      .select("id, keyword, results, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return jsonError("Unable to load SERP analyses", 500, "SERP_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("SERP analysis history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
