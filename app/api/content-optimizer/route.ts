import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAIJson, callAIWithRetry } from "@/lib/ai";
import { jsonError } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const TONES = ["professional", "casual", "expert"] as const;

const contentOptimizerSchema = z.object({
  content: z.string().trim().min(200).max(15_000),
  targetKeyword: z.string().trim().min(2).max(120),
  tone: z.enum(TONES).optional(),
});

type Tone = (typeof TONES)[number];

type ImprovementArea = "keyword-density" | "title" | "headings" | "readability" | "internal-links";

interface OptimizationImprovement {
  area: ImprovementArea;
  before: string;
  after: string;
  reason: string;
}

interface ContentOptimizationResult {
  originalContent: string;
  optimizedContent: string;
  targetKeyword: string;
  titleSuggestion: string;
  metaDescriptionSuggestion: string;
  changesSummary: string[];
  scoreBefore: number;
  scoreAfter: number;
  improvements: OptimizationImprovement[];
}

const TONE_GUIDE: Record<Tone, string> = {
  professional: "Keep the rewrite professional and business-appropriate, with precise terminology.",
  casual: "Keep the rewrite casual and conversational — friendly and approachable.",
  expert: "Keep the rewrite expert-level: technical, precise, and authoritative.",
};

const VALID_AREAS: ImprovementArea[] = [
  "keyword-density",
  "title",
  "headings",
  "readability",
  "internal-links",
];

function clampScore(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

async function optimizeContent(input: {
  content: string;
  targetKeyword: string;
  tone: Tone;
}): Promise<ContentOptimizationResult> {
  const schemaDescription = `Return a valid JSON object with this exact structure:
{
  "originalContent": "string — verbatim copy of the input content",
  "optimizedContent": "string — rewritten markdown targeting the keyword",
  "targetKeyword": "string — verbatim target keyword",
  "titleSuggestion": "string — new SEO title (50-60 chars)",
  "metaDescriptionSuggestion": "string — 140-160 chars meta description",
  "changesSummary": ["Change 1: ...", "Change 2: ...", ...],
  "scoreBefore": "integer 0-100 (SEO score before rewrite)",
  "scoreAfter": "integer 0-100 (SEO score after rewrite; MUST be > scoreBefore)",
  "improvements": [
    {
      "area": "keyword-density" | "title" | "headings" | "readability" | "internal-links",
      "before": "string — what it was",
      "after": "string — what it became",
      "reason": "string — why this matters for SEO"
    }
  ]
}
Provide 3-8 changesSummary items and 3-8 improvements. Return ONLY valid JSON — no markdown, no code fences, no surrounding prose.`;

  const systemPrompt = `You are a senior SEO content editor. Rewrite existing content to better target a specific keyword while preserving its meaning and core message. Produce clean markdown for the optimizedContent field (use H1/H2/H3, lists, **bold**). Score honestly: scoreBefore should reflect actual SEO gaps in the input; scoreAfter must be higher and reflect the actual improvements. Return JSON only. ${TONE_GUIDE[input.tone]} ${schemaDescription}`;

  const userPrompt = `Rewrite the content below to better target the keyword "${input.targetKeyword}". Keep the original meaning and intent intact, but improve:

1. Keyword density — use the target keyword (and natural variants) in the title, intro, at least one H2, and the conclusion. Do NOT stuff.
2. Title — propose a new SEO-optimized title (50-60 chars) that includes the target keyword.
3. Headings — restructure into clean H1/H2/H3 hierarchy using the target keyword where natural.
4. Readability — shorten long sentences, break up walls of text, use bullet lists where appropriate.
5. Internal links — where appropriate, suggest a placeholder internal link using markdown: [anchor](/related-page) so the user can wire it up later.

Tone: ${input.tone}.

Return: the originalContent verbatim, the optimizedContent (full rewritten markdown), your titleSuggestion, metaDescriptionSuggestion (140-160 chars), a changesSummary array of 3-8 short bullet strings ("Change N: ..."), a scoreBefore (0-100), a scoreAfter (0-100, must be higher), and an improvements array with 3-8 entries covering the areas above.

Original content:
"""
${input.content}
"""

Target keyword: "${input.targetKeyword}"`;

  const { data: parsed } = await callAIWithRetry(() =>
    callAIJson<ContentOptimizationResult>(userPrompt, systemPrompt, {
      temperature: 0.4,
      maxOutputTokens: 8192,
    })
  );

  if (!parsed || typeof parsed.optimizedContent !== "string" || !parsed.optimizedContent.trim()) {
    throw new Error("Invalid content optimization payload");
  }

  const scoreBefore = clampScore(parsed.scoreBefore, 50);
  let scoreAfter = clampScore(parsed.scoreAfter, 75);
  // Guarantee the invariant scoreAfter > scoreBefore; otherwise nudge.
  if (scoreAfter <= scoreBefore) scoreAfter = Math.min(100, scoreBefore + 5);

  const improvements: OptimizationImprovement[] = Array.isArray(parsed.improvements)
    ? parsed.improvements
        .filter((i) => i && typeof i === "object")
        .map((i) => ({
          area: (VALID_AREAS.includes(i.area as ImprovementArea) ? i.area : "readability") as ImprovementArea,
          before: String(i.before || "").trim().slice(0, 1000),
          after: String(i.after || "").trim().slice(0, 1000),
          reason: String(i.reason || "").trim().slice(0, 1000),
        }))
        .slice(0, 12)
    : [];

  return {
    originalContent: input.content,
    optimizedContent: parsed.optimizedContent,
    targetKeyword: input.targetKeyword,
    titleSuggestion: (parsed.titleSuggestion || "").toString().trim().slice(0, 120),
    metaDescriptionSuggestion: (parsed.metaDescriptionSuggestion || "").toString().trim().slice(0, 180),
    changesSummary: Array.isArray(parsed.changesSummary)
      ? parsed.changesSummary.map((c) => String(c)).slice(0, 12)
      : [],
    scoreBefore,
    scoreAfter,
    improvements,
  };
}

export async function POST(request: Request) {
  try {
    const parsed = contentOptimizerSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError("Content must be 200-15000 chars; targetKeyword 2-120 chars; tone must be professional|casual|expert", 400, "VALIDATION_ERROR");
    }

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const limit = rateLimit(`content-optimizer:${user.id}`, 10, 60_000);
    if (!limit.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests", code: "RATE_LIMITED" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      });
    }

    const credits = await checkCredits(user.id);
    if (credits < 2) return jsonError("This action requires 2 credits", 402, "INSUFFICIENT_CREDITS");

    const input = {
      content: parsed.data.content,
      targetKeyword: parsed.data.targetKeyword,
      tone: parsed.data.tone ?? "professional",
    };

    const result = await optimizeContent(input);

    const admin = createAdminClient();
    const { data: record, error: insertError } = await admin
      .from("content_optimizations")
      .insert({
        user_id: user.id,
        target_keyword: result.targetKeyword,
        results: { ...result, requestedTone: input.tone },
      })
      .select("id, target_keyword, results, created_at")
      .single();
    if (insertError) throw new Error(`Unable to save content optimization: ${insertError.message}`);

    const creditsLeft = await deductCredits(user.id, 2);
    const { error: usageError } = await admin.from("usage_logs").insert({
      user_id: user.id,
      action: "content_optimization",
      tokens_used: 0,
      cost_usd: 0,
      metadata: { record_id: record.id, target_keyword: result.targetKeyword, tone: input.tone },
    });
    if (usageError) console.error("Unable to log content_optimization usage:", usageError.message);

    return Response.json({ data: { optimization: record, credits_left: creditsLeft } });
  } catch (error) {
    console.error("Content optimizer failed:", error);
    return jsonError(error instanceof Error ? error.message : "Content optimization failed", 500, "CONTENT_OPTIMIZER_FAILED");
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase
      .from("content_optimizations")
      .select("id, target_keyword, results, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return jsonError("Unable to load content optimizations", 500, "CONTENT_OPTIMIZER_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("Content optimizer history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
