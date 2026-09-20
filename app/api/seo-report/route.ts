import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAIJson, callAIWithRetry } from "@/lib/ai";
import { jsonError } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const seoReportSchema = z.object({
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
  competitors: z.array(z.string().trim().min(3).max(253)).max(5).optional(),
});

type Impact = "low" | "medium" | "high";
type Effort = "low" | "medium" | "high";

interface ActionPlanItem {
  priority: number;
  task: string;
  impact: Impact;
  effort: Effort;
  timeline: string;
}

interface CompetitorComparison {
  domain: string;
  traffic: string;
  keywords: string;
  authority: number;
}

interface SeoReportResult {
  domain: string;
  reportDate: string;
  executiveSummary: string;
  overallScore: number;
  scores: {
    technical: number;
    content: number;
    onpage: number;
    ux: number;
    authority: number;
  };
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  actionPlan: ActionPlanItem[];
  competitorComparison: CompetitorComparison[];
}

interface SeoReportRecord {
  id: string;
  domain: string;
  results: SeoReportResult;
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

async function generateSeoReport(
  rawDomain: string,
  competitors: string[] | undefined
): Promise<SeoReportResult> {
  const domain = normalizeDomain(rawDomain);
  const competitorList = (competitors || [])
    .map((c) => normalizeDomain(c))
    .filter((c) => c && c !== domain)
    .slice(0, 5);

  const schemaDescription = `Return a valid JSON object with this EXACT structure:
{
  "domain": "string",
  "reportDate": "ISO date string (YYYY-MM-DD)",
  "executiveSummary": "string — 2-3 paragraphs separated by \\n\\n",
  "overallScore": "integer 0-100",
  "scores": {
    "technical": "integer 0-100",
    "content": "integer 0-100",
    "onpage": "integer 0-100",
    "ux": "integer 0-100",
    "authority": "integer 0-100"
  },
  "strengths": ["string", "..."],
  "weaknesses": ["string", "..."],
  "opportunities": ["string", "..."],
  "threats": ["string", "..."],
  "actionPlan": [
    {
      "priority": "integer (1 = highest)",
      "task": "string",
      "impact": "low" | "medium" | "high",
      "effort": "low" | "medium" | "high",
      "timeline": "string — e.g. '2-4 weeks'"
    }
  ],
  "competitorComparison": [
    {
      "domain": "string",
      "traffic": "string — e.g. '~1.2M visits/mo'",
      "keywords": "string — e.g. '~45,000 keywords'",
      "authority": "integer 0-100"
    }
  ]
}
Provide 4-8 items in each SWOT bucket, 5-10 action plan items, and an entry for each competitor (and the target domain itself as the first row).
Return ONLY valid JSON — no markdown, no code fences, no surrounding prose.`;

  const systemPrompt = `You are a senior SEO auditor with 10+ years of experience auditing enterprise websites. Produce a realistic, comprehensive SEO audit. Numbers (scores, traffic, authority) are plausible AI estimates, NOT exact proprietary data — never claim they come from Ahrefs/Semrush/etc. ${schemaDescription}`;

  const competitorLine = competitorList.length
    ? `\nCompare against these competitors: ${competitorList.join(", ")}.`
    : `\nCompare against 2-3 plausible competitor domains of your choosing in the same niche.`;

  const userPrompt = `Perform a comprehensive SEO audit for the domain "${domain}".${competitorLine}

Provide:
1. An executive summary (2-3 paragraphs) covering the site's current SEO health, biggest wins and biggest risks.
2. An overall score (0-100) and 5 sub-scores: technical, content, onpage, ux, authority — each 0-100.
3. A SWOT analysis: 4-8 items each for strengths, weaknesses, opportunities, threats.
4. A prioritised action plan (5-10 items): each with priority number, task, impact, effort, timeline.
5. A competitor comparison table including the target domain and competitors with traffic, keywords and authority estimates.
Use today's date as reportDate. Estimates only — no proprietary tool data.`;

  const { data: parsed } = await callAIWithRetry(() =>
    callAIJson<SeoReportResult>(userPrompt, systemPrompt, {
      temperature: 0.3,
      maxOutputTokens: 6000,
    })
  );

  // Normalise / clamp fields
  parsed.domain = domain;
  parsed.reportDate = parsed.reportDate || new Date().toISOString().slice(0, 10);
  parsed.overallScore = Math.max(0, Math.min(100, Math.round(parsed.overallScore || 0)));
  if (parsed.scores && typeof parsed.scores === "object") {
    for (const key of ["technical", "content", "onpage", "ux", "authority"] as const) {
      const v = parsed.scores[key];
      parsed.scores[key] = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
    }
  } else {
    parsed.scores = { technical: 0, content: 0, onpage: 0, ux: 0, authority: 0 };
  }
  parsed.strengths = (parsed.strengths || []).slice(0, 12);
  parsed.weaknesses = (parsed.weaknesses || []).slice(0, 12);
  parsed.opportunities = (parsed.opportunities || []).slice(0, 12);
  parsed.threats = (parsed.threats || []).slice(0, 12);
  parsed.actionPlan = (parsed.actionPlan || []).slice(0, 15);
  parsed.competitorComparison = (parsed.competitorComparison || []).slice(0, 6);
  return parsed;
}

export async function POST(request: Request) {
  try {
    const parsed = seoReportSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Provide a valid domain or URL", 400, "VALIDATION_ERROR");

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const limit = rateLimit(`seo-report:${user.id}`, 10, 60_000);
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
    if (credits < 3) return jsonError("Insufficient credits (3 required)", 402, "INSUFFICIENT_CREDITS");

    const result = await generateSeoReport(parsed.data.domain, parsed.data.competitors);

    // Robust DB save — don't fail the request if the table is missing
    let savedRecord: SeoReportRecord;
    const admin = createAdminClient();
    const { data, error: insertError } = await admin
      .from("seo_reports")
      .insert({
        user_id: user.id,
        domain: result.domain,
        results: result,
      })
      .select("id, domain, results, created_at")
      .single();
    if (insertError) {
      console.warn("[seo-report] Unable to save (table may not exist):", insertError.message);
      savedRecord = {
        id: `tmp-${Date.now()}`,
        domain: result.domain,
        results: result,
        created_at: new Date().toISOString(),
      };
    } else {
      savedRecord = data as SeoReportRecord;
    }

    // Deduct credits — has built-in fallback for missing RPC function
    let creditsLeft = credits;
    try {
      creditsLeft = await deductCredits(user.id, 3);
    } catch (err) {
      console.warn("[seo-report] Unable to deduct credits:", err instanceof Error ? err.message : err);
    }

    // Best-effort usage log
    try {
      await admin.from("usage_logs").insert({
        user_id: user.id,
        action: "seo_report",
        tokens_used: 0,
        cost_usd: 0,
        metadata: { record_id: savedRecord.id, domain: result.domain },
      });
    } catch (usageError) {
      console.warn(
        "[seo-report] Unable to log usage:",
        usageError instanceof Error ? usageError.message : usageError
      );
    }

    return Response.json({ data: { report: savedRecord, credits_left: creditsLeft } });
  } catch (error) {
    console.error("SEO report generation failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "SEO report generation failed",
      500,
      "SEO_REPORT_FAILED"
    );
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase
      .from("seo_reports")
      .select("id, domain, results, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return jsonError("Unable to load SEO report history", 500, "SEO_REPORT_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("SEO report history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
