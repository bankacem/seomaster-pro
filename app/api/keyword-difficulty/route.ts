import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAIJson, callAIWithRetry } from "@/lib/ai";
import { jsonError } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 30;

const keywordDifficultySchema = z.object({
  keyword: z.string().trim().min(2).max(120),
});

type DifficultyLabel = "easy" | "medium" | "hard" | "very-hard";
type Competition = "low" | "medium" | "high";
type TopicalAuthority = "low" | "medium" | "high";

interface SerpOverview {
  avgWordCount: number;
  avgDomainAuthority: number;
  hasFeaturedSnippet: boolean;
  serpFeatures: string[];
}

interface KeywordDifficultyResult {
  keyword: string;
  difficulty: number;
  difficultyLabel: DifficultyLabel;
  cpc: number;
  competition: Competition;
  searchVolume: number;
  serpOverview: SerpOverview;
  topicalAuthority: TopicalAuthority;
  timeToRank: string;
  recommendation: string;
}

function labelForDifficulty(score: number): DifficultyLabel {
  if (score < 30) return "easy";
  if (score < 60) return "medium";
  if (score < 80) return "hard";
  return "very-hard";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function generateKeywordDifficulty(keyword: string): Promise<KeywordDifficultyResult> {
  const schemaDescription = `Return a valid JSON object with this exact structure:
{
  "keyword": "string",
  "difficulty": "integer 0-100 (higher = harder to rank)",
  "difficultyLabel": "easy" | "medium" | "hard" | "very-hard",
  "cpc": "number >=0 (USD cost-per-click)",
  "competition": "low" | "medium" | "high",
  "searchVolume": "integer >=0 (estimated monthly searches)",
  "serpOverview": {
    "avgWordCount": "integer (avg word count of top-10 ranking pages)",
    "avgDomainAuthority": "integer 0-100",
    "hasFeaturedSnippet": "boolean",
    "serpFeatures": ["people-also-ask", "video-carousel", ...]
  },
  "topicalAuthority": "low" | "medium" | "high",
  "timeToRank": "string — e.g. '3-6 months'",
  "recommendation": "string — one-paragraph actionable advice (50-150 words)"
}
Estimates must be plausible AI projections; do NOT claim these are exact figures from proprietary indexes. Return ONLY valid JSON — no markdown, no code fences, no surrounding prose.`;

  const systemPrompt = `You are a senior SEO strategist specializing in keyword difficulty analysis and SERP feature forecasting. Reason about the keyword's commercial intent, authority requirements, and content depth needed to rank. Return JSON only. ${schemaDescription}`;

  const userPrompt = `Analyze the difficulty of ranking organically for the keyword below. Provide a realistic AI-estimated difficulty score (0-100), the difficulty label, CPC in USD, competition level, estimated monthly search volume, an overview of the current top-10 SERP (avg word count, avg domain authority, featured-snippet presence, SERP features), topical authority required, an estimated time-to-rank range, and a single-paragraph actionable recommendation for a new site targeting this keyword.

Keyword: "${keyword}"

Important:
- The difficulty score MUST be consistent with the difficultyLabel: <30 easy, 30-59 medium, 60-79 hard, 80-100 very-hard.
- serpFeatures should list 2-5 strings (e.g. "featured-snippet", "people-also-ask", "video-carousel", "image-pack", "knowledge-panel", "site-links", "top-stories").
- recommendation should be 50-150 words, specific to the keyword.`;

  const { data: parsed } = await callAIWithRetry(() =>
    callAIJson<KeywordDifficultyResult>(userPrompt, systemPrompt, { temperature: 0.3 })
  );

  if (!parsed) throw new Error("Invalid keyword difficulty payload");

  const difficulty = Math.round(clampNumber(parsed.difficulty, 0, 100, 50));
  const difficultyLabel: DifficultyLabel = parsed.difficultyLabel || labelForDifficulty(difficulty);
  const cpc = Math.round(clampNumber(parsed.cpc, 0, 1000, 0) * 100) / 100;
  const validCompetitions: Competition[] = ["low", "medium", "high"];
  const competition: Competition = validCompetitions.includes(parsed.competition) ? parsed.competition : "medium";
  const searchVolume = Math.max(0, Math.round(clampNumber(parsed.searchVolume, 0, 1_000_000_000, 0)));

  const so = parsed.serpOverview || ({} as SerpOverview);
  const serpOverview: SerpOverview = {
    avgWordCount: Math.round(clampNumber(so.avgWordCount, 0, 100_000, 0)),
    avgDomainAuthority: Math.round(clampNumber(so.avgDomainAuthority, 0, 100, 0)),
    hasFeaturedSnippet: Boolean(so.hasFeaturedSnippet),
    serpFeatures: Array.isArray(so.serpFeatures) ? so.serpFeatures.map(String).slice(0, 10) : [],
  };

  const validAuthorities: TopicalAuthority[] = ["low", "medium", "high"];
  const topicalAuthority: TopicalAuthority = validAuthorities.includes(parsed.topicalAuthority)
    ? parsed.topicalAuthority
    : "medium";

  const timeToRank = (parsed.timeToRank || "3-6 months").toString().trim().slice(0, 80);
  const recommendation = (parsed.recommendation || "").toString().trim().slice(0, 2000);

  return {
    keyword,
    difficulty,
    difficultyLabel,
    cpc,
    competition,
    searchVolume,
    serpOverview,
    topicalAuthority,
    timeToRank,
    recommendation,
  };
}

export async function POST(request: Request) {
  try {
    const parsed = keywordDifficultySchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Keyword must be between 2 and 120 characters", 400, "VALIDATION_ERROR");

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const limit = rateLimit(`keyword-difficulty:${user.id}`, 10, 60_000);
    if (!limit.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests", code: "RATE_LIMITED" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      });
    }

    const credits = await checkCredits(user.id);
    if (credits < 1) return jsonError("No credits remaining", 402, "INSUFFICIENT_CREDITS");

    const result = await generateKeywordDifficulty(parsed.data.keyword);

    const admin = createAdminClient();
    const { data: record, error: insertError } = await admin
      .from("keyword_difficulty_reports")
      .insert({
        user_id: user.id,
        keyword: result.keyword,
        results: result,
      })
      .select("id, keyword, results, created_at")
      .single();
    if (insertError) throw new Error(`Unable to save keyword difficulty report: ${insertError.message}`);

    const creditsLeft = await deductCredits(user.id, 1);
    const { error: usageError } = await admin.from("usage_logs").insert({
      user_id: user.id,
      action: "keyword_difficulty",
      tokens_used: 0,
      cost_usd: 0,
      metadata: { record_id: record.id, keyword: result.keyword },
    });
    if (usageError) console.error("Unable to log keyword_difficulty usage:", usageError.message);

    return Response.json({ data: { report: record, credits_left: creditsLeft } });
  } catch (error) {
    console.error("Keyword difficulty analysis failed:", error);
    return jsonError(error instanceof Error ? error.message : "Keyword difficulty analysis failed", 500, "KEYWORD_DIFFICULTY_FAILED");
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase
      .from("keyword_difficulty_reports")
      .select("id, keyword, results, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return jsonError("Unable to load keyword difficulty reports", 500, "KEYWORD_DIFFICULTY_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("Keyword difficulty history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
