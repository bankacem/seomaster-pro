import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAIJson, callAIWithRetry } from "@/lib/ai";
import { jsonError } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 45;

const forecastSchema = z.object({
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
  targetKeyword: z.string().trim().min(2).max(120),
  monthlyBudget: z.number().nonnegative().max(1_000_000).optional(),
});

interface ForecastMonth {
  month: number;
  position: number;
  traffic: number;
  revenue: number;
}

interface SeoForecastResult {
  domain: string;
  targetKeyword: string;
  monthlyBudget: number;
  currentPosition: number;
  forecast: ForecastMonth[];
  timelineToRank: string;
  totalInvestment: number;
  projectedROI: number;
  assumptions: string[];
  risks: string[];
  recommendation: string;
}

interface SeoForecastRecord {
  id: string;
  domain: string;
  results: SeoForecastResult;
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

async function generateSeoForecast(
  rawDomain: string,
  targetKeyword: string,
  monthlyBudget: number | undefined
): Promise<SeoForecastResult> {
  const domain = normalizeDomain(rawDomain);
  const budget = monthlyBudget && monthlyBudget > 0 ? monthlyBudget : 3000;

  const schemaDescription = `Return a valid JSON object with this EXACT structure:
{
  "domain": "string",
  "targetKeyword": "string",
  "monthlyBudget": "number (USD)",
  "currentPosition": "integer 1-100 (current SERP position for the keyword; 100+ = not ranking)",
  "forecast": [
    { "month": 1, "position": "integer", "traffic": "integer >=0", "revenue": "number >=0" },
    { "month": 2, "...": "..." }
    // up to 12 months
  ],
  "timelineToRank": "string — e.g. '4-6 months' or '8-12 months'",
  "totalInvestment": "number — budget * months to rank",
  "projectedROI": "number — projected 12-month revenue / totalInvestment (1.5 = 150% ROI)",
  "assumptions": ["string", "..."],
  "risks": ["string", "..."],
  "recommendation": "string — 2-4 sentences"
}
Forecast EXACTLY 12 months (month 1 to month 12).
Return ONLY valid JSON — no markdown, no code fences, no surrounding prose.`;

  const systemPrompt = `You are a senior SEO strategist who builds ROI models for content & link-building campaigns. Produce a realistic 12-month forecast. Numbers are AI estimates based on plausible industry benchmarks — never claim they are exact figures. ${schemaDescription}`;

  const userPrompt = `Forecast the SEO trajectory for the domain "${domain}" targeting the keyword "${targetKeyword}" with a monthly budget of $${budget}.

Model a realistic 12-month progression:
- currentPosition: where the domain currently ranks for the keyword (estimate 1-100, with 100 meaning "not in top 100").
- Each forecast month: estimated average position, organic traffic from this keyword, and revenue attribution (monthly).
- Traffic should ramp as the position improves (e.g. position 1 gets the most traffic, position 10+ gets very little).
- Revenue = estimated conversion_rate * traffic * average_order_value; keep it plausible.
- timelineToRank: how many months until the domain reaches page 1 (top 10).
- totalInvestment: monthly budget * number of months to rank.
- projectedROI: 12-month cumulative revenue / totalInvestment.
- assumptions: 4-8 bullets describing what the model assumes (e.g. "Content team produces 4 articles/month", "2 quality backlinks acquired per month", "No major algorithm updates").
- risks: 3-6 bullets on what could derail the projection.
- recommendation: 2-4 sentences of clear advice (proceed, adjust budget, change keyword, etc.).

Estimates only — no proprietary tool data.`;

  const { data: parsed } = await callAIWithRetry(() =>
    callAIJson<SeoForecastResult>(userPrompt, systemPrompt, {
      temperature: 0.4,
      maxOutputTokens: 5000,
    })
  );

  parsed.domain = domain;
  parsed.targetKeyword = targetKeyword;
  parsed.monthlyBudget = budget;
  parsed.currentPosition = Math.max(1, Math.min(100, Math.round(parsed.currentPosition || 50)));
  parsed.forecast = (parsed.forecast || [])
    .filter((m) => m && typeof m.month === "number")
    .slice(0, 12);
  // Ensure exactly 12 months are represented; pad if the AI returned fewer
  if (parsed.forecast.length < 12) {
    const last = parsed.forecast[parsed.forecast.length - 1] || {
      month: 0,
      position: 100,
      traffic: 0,
      revenue: 0,
    };
    for (let i = parsed.forecast.length + 1; i <= 12; i += 1) {
      parsed.forecast.push({
        month: i,
        position: last.position,
        traffic: last.traffic,
        revenue: last.revenue,
      });
    }
  }
  return parsed;
}

export async function POST(request: Request) {
  try {
    const parsed = forecastSchema.safeParse(await request.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Provide a valid domain, target keyword, and optional monthly budget";
      return jsonError(msg, 400, "VALIDATION_ERROR");
    }

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const limit = rateLimit(`seo-forecast:${user.id}`, 10, 60_000);
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

    const result = await generateSeoForecast(
      parsed.data.domain,
      parsed.data.targetKeyword,
      parsed.data.monthlyBudget
    );

    let savedRecord: SeoForecastRecord;
    const admin = createAdminClient();
    const { data, error: insertError } = await admin
      .from("seo_forecasts")
      .insert({
        user_id: user.id,
        domain: result.domain,
        results: result,
      })
      .select("id, domain, results, created_at")
      .single();
    if (insertError) {
      console.warn("[seo-forecast] Unable to save (table may not exist):", insertError.message);
      savedRecord = {
        id: `tmp-${Date.now()}`,
        domain: result.domain,
        results: result,
        created_at: new Date().toISOString(),
      };
    } else {
      savedRecord = data as SeoForecastRecord;
    }

    let creditsLeft = credits;
    try {
      creditsLeft = await deductCredits(user.id, 2);
    } catch (err) {
      console.warn("[seo-forecast] Unable to deduct credits:", err instanceof Error ? err.message : err);
    }

    try {
      await admin.from("usage_logs").insert({
        user_id: user.id,
        action: "seo_forecast",
        tokens_used: 0,
        cost_usd: 0,
        metadata: { record_id: savedRecord.id, domain: result.domain, keyword: result.targetKeyword },
      });
    } catch (usageError) {
      console.warn(
        "[seo-forecast] Unable to log usage:",
        usageError instanceof Error ? usageError.message : usageError
      );
    }

    return Response.json({ data: { report: savedRecord, credits_left: creditsLeft } });
  } catch (error) {
    console.error("SEO forecast failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "SEO forecast failed",
      500,
      "SEO_FORECAST_FAILED"
    );
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase
      .from("seo_forecasts")
      .select("id, domain, results, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return jsonError("Unable to load SEO forecast history", 500, "SEO_FORECAST_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("SEO forecast history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
