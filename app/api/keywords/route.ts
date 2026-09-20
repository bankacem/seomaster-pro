import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenAIClient, OPENAI_MODEL } from "@/lib/openai";
import { jsonError, sleep } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 30;

const keywordSchema = z.object({
  topic: z.string().trim().min(2).max(100),
});

interface KeywordIdea {
  keyword: string;
  search_volume: number;
  difficulty: number;
  cpc: number;
  competition: "low" | "medium" | "high";
  intent: "informational" | "commercial" | "transactional" | "navigational";
}

const keywordResultSchema = {
  type: "object",
  additionalProperties: false,
  required: ["keywords"],
  properties: {
    keywords: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["keyword", "search_volume", "difficulty", "cpc", "competition", "intent"],
        properties: {
          keyword: { type: "string" },
          search_volume: { type: "integer", minimum: 0 },
          difficulty: { type: "integer", minimum: 0, maximum: 100 },
          cpc: { type: "number", minimum: 0 },
          competition: { type: "string", enum: ["low", "medium", "high"] },
          intent: { type: "string", enum: ["informational", "commercial", "transactional", "navigational"] },
        },
      },
    },
  },
} as const;

async function generateKeywordIdeas(topic: string): Promise<{ keywords: KeywordIdea[] }> {
  const client = getOpenAIClient();
  const prompt = `Generate 10 SEO keyword ideas for the topic below. Provide plausible estimated metrics (search volume = monthly searches, difficulty 0-100, cpc in USD, competition level, search intent). Do not claim these are exact figures from proprietary tools; they are AI estimates.\n\nTopic: ${topic}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const completion = await client.chat.completions.create(
        {
          model: OPENAI_MODEL,
          temperature: 0.2,
          response_format: { type: "json_schema", json_schema: { name: "keyword_research", strict: true, schema: keywordResultSchema } },
          messages: [
            {
              role: "system",
              content:
                "You are a senior SEO strategist. Return JSON with a `keywords` array. Estimates must be realistic; do not invent exact proprietary data.",
            },
            { role: "user", content: prompt },
          ],
        },
        { timeout: 30_000 },
      );

      const contentJson = completion.choices[0]?.message?.content;
      if (!contentJson) throw new Error("OpenAI returned an empty response");
      const parsed = JSON.parse(contentJson) as { keywords: KeywordIdea[] };
      if (!parsed.keywords || !Array.isArray(parsed.keywords)) throw new Error("Invalid keyword payload");
      return { keywords: parsed.keywords.slice(0, 10) };
    } catch (error) {
      if (attempt === 2) throw error;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw new Error("Keyword research failed");
}

export async function POST(request: Request) {
  try {
    const parsed = keywordSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Topic must be between 2 and 100 characters", 400, "VALIDATION_ERROR");

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const limit = rateLimit(`keywords:${user.id}`, 10, 60_000);
    if (!limit.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests", code: "RATE_LIMITED" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      });
    }

    const credits = await checkCredits(user.id);
    if (credits < 1) return jsonError("No credits remaining", 402, "INSUFFICIENT_CREDITS");

    const result = await generateKeywordIdeas(parsed.data.topic);
    const admin = createAdminClient();
    const { data: record, error: insertError } = await admin
      .from("keyword_research")
      .insert({
        user_id: user.id,
        topic: parsed.data.topic,
        results: result,
      })
      .select("id, topic, results, created_at")
      .single();
    if (insertError) throw new Error(`Unable to save keyword research: ${insertError.message}`);

    const creditsLeft = await deductCredits(user.id);
    const { error: usageError } = await admin.from("usage_logs").insert({
      user_id: user.id,
      action: "keyword_research",
      tokens_used: 0,
      cost_usd: 0,
      metadata: { record_id: record.id, topic: parsed.data.topic },
    });
    if (usageError) console.error("Unable to log keyword research usage:", usageError.message);

    return Response.json({ data: { keywords: result.keywords, credits_left: creditsLeft } });
  } catch (error) {
    console.error("Keyword research failed:", error);
    return jsonError(error instanceof Error ? error.message : "Keyword research failed", 500, "KEYWORD_RESEARCH_FAILED");
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase
      .from("keyword_research")
      .select("id, topic, results, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return jsonError("Unable to load keyword research history", 500, "KEYWORD_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("Keyword research history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
