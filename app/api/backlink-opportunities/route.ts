import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAIJson, callAIWithRetry } from "@/lib/ai";
import { jsonError } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 45;

const backlinkOppSchema = z.object({
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
  niche: z.string().trim().min(2).max(120).optional(),
});

type OpportunityType =
  | "guest-post"
  | "resource-page"
  | "broken-link"
  | "directory"
  | "forum"
  | "social";
type ResponseRate = "low" | "medium" | "high";

interface BacklinkOpportunity {
  site: string;
  domainAuthority: number;
  type: OpportunityType;
  relevanceScore: number;
  contactMethod: string;
  estimatedResponseRate: ResponseRate;
  outreachTemplate: string;
  anchorTextSuggestion: string;
}

interface BacklinkOpportunityResult {
  domain: string;
  opportunities: BacklinkOpportunity[];
  summary: string;
  strategyRecommendation: string;
}

interface BacklinkOpportunityRecord {
  id: string;
  domain: string;
  results: BacklinkOpportunityResult;
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

async function generateBacklinkOpportunities(
  rawDomain: string,
  niche: string | undefined
): Promise<BacklinkOpportunityResult> {
  const domain = normalizeDomain(rawDomain);

  const schemaDescription = `Return a valid JSON object with this EXACT structure:
{
  "domain": "string",
  "opportunities": [
    {
      "site": "string — domain of the prospective linking site (e.g. example-blog.com)",
      "domainAuthority": "integer 0-100 (estimated)",
      "type": "guest-post" | "resource-page" | "broken-link" | "directory" | "forum" | "social",
      "relevanceScore": "integer 0-100",
      "contactMethod": "string — e.g. 'contact form', 'email: editor@site.com', 'LinkedIn DM'",
      "estimatedResponseRate": "low" | "medium" | "high",
      "outreachTemplate": "string — a suggested outreach message (3-6 sentences, personalised)",
      "anchorTextSuggestion": "string — suggested anchor text for the backlink"
    }
  ],
  "summary": "string — 2-4 sentences describing the overall opportunity landscape",
  "strategyRecommendation": "string — 1-2 sentences describing the recommended outreach strategy"
}
Provide 8-15 opportunity items. Return ONLY valid JSON — no markdown, no code fences, no surrounding prose.`;

  const systemPrompt = `You are a senior link-building strategist who has run outreach campaigns for SaaS, ecommerce and publishing brands. Suggest realistic, plausible link-building opportunities. All numbers (DA, relevance) are AI estimates — never claim they come from Ahrefs/Moz/etc. ${schemaDescription}`;

  const nicheLine = niche
    ? `\nThe site's niche is: "${niche}". Prioritise sites in adjacent niches.`
    : `\nInfer the site's niche from its domain name and prioritise adjacent-niche sites.`;

  const userPrompt = `Suggest backlink opportunities for the domain "${domain}".${nicheLine}

For each opportunity:
- Pick a realistic prospective linking site (use plausible domain names that don't already exist as major brands — e.g. "thecontentmarketerblog.com").
- Estimate domain authority 0-100, relevance score 0-100, response rate (low/medium/high).
- Specify a contact method, an outreach template (3-6 sentences, friendly and personalised to the prospect's content), and a suggested anchor text.
- Vary the type across the 6 categories (guest-post, resource-page, broken-link, directory, forum, social).

End with a short summary of the opportunity landscape and a 1-2 sentence strategy recommendation. Estimates only.`;

  const { data: parsed } = await callAIWithRetry(() =>
    callAIJson<BacklinkOpportunityResult>(userPrompt, systemPrompt, {
      temperature: 0.4,
      maxOutputTokens: 5000,
    })
  );

  parsed.domain = domain;
  parsed.opportunities = (parsed.opportunities || []).slice(0, 20);
  return parsed;
}

export async function POST(request: Request) {
  try {
    const parsed = backlinkOppSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Provide a valid domain or URL", 400, "VALIDATION_ERROR");

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const limit = rateLimit(`backlink-opportunities:${user.id}`, 10, 60_000);
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

    const result = await generateBacklinkOpportunities(parsed.data.domain, parsed.data.niche);

    let savedRecord: BacklinkOpportunityRecord;
    const admin = createAdminClient();
    const { data, error: insertError } = await admin
      .from("backlink_opportunities")
      .insert({
        user_id: user.id,
        domain: result.domain,
        results: result,
      })
      .select("id, domain, results, created_at")
      .single();
    if (insertError) {
      console.warn("[backlink-opportunities] Unable to save (table may not exist):", insertError.message);
      savedRecord = {
        id: `tmp-${Date.now()}`,
        domain: result.domain,
        results: result,
        created_at: new Date().toISOString(),
      };
    } else {
      savedRecord = data as BacklinkOpportunityRecord;
    }

    let creditsLeft = credits;
    try {
      creditsLeft = await deductCredits(user.id, 2);
    } catch (err) {
      console.warn(
        "[backlink-opportunities] Unable to deduct credits:",
        err instanceof Error ? err.message : err
      );
    }

    try {
      await admin.from("usage_logs").insert({
        user_id: user.id,
        action: "backlink_opportunities",
        tokens_used: 0,
        cost_usd: 0,
        metadata: { record_id: savedRecord.id, domain: result.domain },
      });
    } catch (usageError) {
      console.warn(
        "[backlink-opportunities] Unable to log usage:",
        usageError instanceof Error ? usageError.message : usageError
      );
    }

    return Response.json({ data: { report: savedRecord, credits_left: creditsLeft } });
  } catch (error) {
    console.error("Backlink opportunities failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Backlink opportunity search failed",
      500,
      "BACKLINK_OPPORTUNITIES_FAILED"
    );
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase
      .from("backlink_opportunities")
      .select("id, domain, results, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return jsonError("Unable to load backlink opportunity history", 500, "BACKLINK_OPPORTUNITIES_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("Backlink opportunity history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
