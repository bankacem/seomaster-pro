import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenAIClient, OPENAI_MODEL } from "@/lib/openai";
import { jsonError, sleep } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 30;

const positionsSchema = z.object({
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
  keywords: z.array(z.string().trim().min(2).max(120)).min(1).max(10),
});

interface PositionRow {
  keyword: string;
  position: number;
  url: string;
  previous_position: number;
  change: number;
  search_volume: number;
  difficulty: number;
}

interface PositionsResult {
  domain: string;
  keywords: PositionRow[];
}

const positionsResultSchema = {
  type: "object",
  additionalProperties: false,
  required: ["domain", "keywords"],
  properties: {
    domain: { type: "string" },
    keywords: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["keyword", "position", "url", "previous_position", "change", "search_volume", "difficulty"],
        properties: {
          keyword: { type: "string" },
          position: { type: "integer", minimum: 1, maximum: 100 },
          url: { type: "string" },
          previous_position: { type: "integer", minimum: 1, maximum: 100 },
          change: { type: "integer", minimum: -100, maximum: 100 },
          search_volume: { type: "integer", minimum: 0 },
          difficulty: { type: "integer", minimum: 0, maximum: 100 },
        },
      },
    },
  },
} as const;

function normalizeDomain(value: string) {
  const candidate = value.includes("://") ? value : `https://${value}`;
  try {
    return new URL(candidate).hostname.replace(/^www\./u, "").toLowerCase();
  } catch {
    return value.toLowerCase().replace(/^www\./u, "");
  }
}

// Deterministic hash so the same domain+keyword always yields the same baseline
// position. The AI then nudges it with a plausible previous position + change.
function hashSeed(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

async function generatePositions(domain: string, keywords: string[]): Promise<PositionsResult> {
  const normalizedDomain = normalizeDomain(domain);
  const baselines = keywords.map((keyword) => {
    const seed = hashSeed(`${normalizedDomain}|${keyword.toLowerCase()}`);
    const position = (seed % 90) + 1; // 1..90
    const previousPosition = ((seed >> 8) % 90) + 1;
    return { keyword, position, previous_position: previousPosition, change: previousPosition - position };
  });

  const client = getOpenAIClient();
  const prompt = `For the domain "${normalizedDomain}", generate plausible simulated search ranking data for each keyword below. For every keyword provide: position (1-100), url (a plausible URL on the domain), previous_position, change (previous - current), search_volume (monthly, plausible), difficulty (0-100). Use the suggested baselines below as starting points, you may adjust by small amounts.\n\nBaselines:\n${baselines
    .map((b) => `- ${b.keyword}: ~position ${b.position}, previous ~${b.previous_position}`)
    .join("\n")}\n\nReturn JSON only. Do not claim these are real search engine results.`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const completion = await client.chat.completions.create(
        {
          model: OPENAI_MODEL,
          temperature: 0.2,
          response_format: { type: "json_schema", json_schema: { name: "position_tracking", strict: true, schema: positionsResultSchema } },
          messages: [
            {
              role: "system",
              content:
                "You are a senior SEO analyst producing a simulated ranking report. Return JSON only. Numbers are plausible estimates, not real search-engine data.",
            },
            { role: "user", content: prompt },
          ],
        },
        { timeout: 30_000 },
      );

      const contentJson = completion.choices[0]?.message?.content;
      if (!contentJson) throw new Error("OpenAI returned an empty response");
      const parsed = JSON.parse(contentJson) as PositionsResult;
      parsed.domain = normalizedDomain;
      // Merge AI output with the deterministic baseline so positions remain
      // stable across calls even if the model varies slightly.
      const aiRows = new Map((parsed.keywords || []).map((row) => [row.keyword.toLowerCase(), row]));
      parsed.keywords = baselines.map((base) => {
        const aiRow = aiRows.get(base.keyword.toLowerCase());
        const position = aiRow?.position ?? base.position;
        const previous = aiRow?.previous_position ?? base.previous_position;
        return {
          keyword: base.keyword,
          position,
          url: aiRow?.url || `https://${normalizedDomain}/`,
          previous_position: previous,
          change: previous - position,
          search_volume: aiRow?.search_volume ?? (50 + (hashSeed(base.keyword) % 9_500)),
          difficulty: aiRow?.difficulty ?? (10 + (hashSeed(base.keyword + "d") % 80)),
        };
      });
      return parsed;
    } catch (error) {
      if (attempt === 2) throw error;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw new Error("Position tracking failed");
}

export async function POST(request: Request) {
  try {
    const parsed = positionsSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Provide a valid domain and 1-10 keywords", 400, "VALIDATION_ERROR");

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const limit = rateLimit(`positions:${user.id}`, 10, 60_000);
    if (!limit.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests", code: "RATE_LIMITED" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      });
    }

    const credits = await checkCredits(user.id);
    if (credits < 1) return jsonError("No credits remaining", 402, "INSUFFICIENT_CREDITS");

    const result = await generatePositions(parsed.data.domain, parsed.data.keywords);
    const admin = createAdminClient();
    const { data: record, error: insertError } = await admin
      .from("position_tracking")
      .insert({
        user_id: user.id,
        domain: result.domain,
        results: result,
      })
      .select("id, domain, results, created_at")
      .single();
    if (insertError) throw new Error(`Unable to save position tracking: ${insertError.message}`);

    const creditsLeft = await deductCredits(user.id);
    const { error: usageError } = await admin.from("usage_logs").insert({
      user_id: user.id,
      action: "position_tracking",
      tokens_used: 0,
      cost_usd: 0,
      metadata: { record_id: record.id, domain: result.domain, keyword_count: result.keywords.length },
    });
    if (usageError) console.error("Unable to log position tracking usage:", usageError.message);

    return Response.json({ data: { tracking: record, credits_left: creditsLeft } });
  } catch (error) {
    console.error("Position tracking failed:", error);
    return jsonError(error instanceof Error ? error.message : "Position tracking failed", 500, "POSITIONS_FAILED");
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase
      .from("position_tracking")
      .select("id, domain, results, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return jsonError("Unable to load position tracking history", 500, "POSITIONS_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("Position tracking history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
