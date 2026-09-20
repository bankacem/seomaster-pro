import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAIJson, callAIWithRetry } from "@/lib/ai";
import { jsonError } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 30;

const domainSchema = z.object({
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
});

interface TopKeyword {
  keyword: string;
  position: number;
  volume: number;
}

interface TopPage {
  url: string;
  traffic_estimate: number;
}

interface DomainOverview {
  domain: string;
  estimated_organic_traffic: number;
  estimated_keywords_count: number;
  estimated_backlinks_count: number;
  domain_authority: number;
  top_keywords: TopKeyword[];
  top_pages: TopPage[];
  summary: string;
}

function normalizeDomain(value: string) {
  const candidate = value.includes("://") ? value : `https://${value}`;
  try {
    return new URL(candidate).hostname.replace(/^www\./u, "").toLowerCase();
  } catch {
    return value.toLowerCase().replace(/^www\./u, "");
  }
}

// Deterministic seed keeps the AI-estimated overview stable across calls.
function seededOverview(domain: string) {
  let hash = 0;
  for (let i = 0; i < domain.length; i += 1) {
    hash = (hash * 31 + domain.charCodeAt(i)) >>> 0;
  }
  return {
    organicTraffic: 5_000 + (hash % 195_000),
    keywordsCount: 200 + (hash % 18_000),
    backlinksCount: 1_200 + (hash % 88_000),
    domainAuthority: 15 + (hash % 70),
  };
}

async function generateDomainOverview(rawDomain: string): Promise<DomainOverview> {
  const domain = normalizeDomain(rawDomain);
  const seed = seededOverview(domain);

  const schemaDescription = `Return a valid JSON object with this exact structure:
{
  "domain": "string",
  "estimated_organic_traffic": "integer >=0",
  "estimated_keywords_count": "integer >=0",
  "estimated_backlinks_count": "integer >=0",
  "domain_authority": "integer 0-100",
  "top_keywords": [
    { "keyword": "string", "position": "integer 1-100", "volume": "integer >=0" }
  ],
  "top_pages": [
    { "url": "string", "traffic_estimate": "integer >=0" }
  ],
  "summary": "string"
}
Provide up to 5 top_keywords and up to 5 top_pages. Return ONLY valid JSON — no markdown, no code fences, no surrounding prose.`;

  const systemPrompt = `You are a senior SEO strategist. Return JSON only. All numbers are plausible AI estimates, not exact figures. ${schemaDescription}`;

  const userPrompt = `Generate a plausible AI-estimated domain overview for "${domain}". Use these baseline numbers as a guide (you may adjust by ±10%): estimated_organic_traffic ~${seed.organicTraffic}, estimated_keywords_count ~${seed.keywordsCount}, estimated_backlinks_count ~${seed.backlinksCount}, domain_authority ~${seed.domainAuthority}. Provide up to 5 top keywords (each with position 1-100 and a volume), up to 5 top pages (a URL on the domain with a traffic_estimate), and a 1-2 sentence summary. Do NOT claim these are exact figures from proprietary indexes.`;

  const { data: parsed } = await callAIWithRetry(() =>
    callAIJson<DomainOverview>(userPrompt, systemPrompt, { temperature: 0.2 })
  );

  parsed.domain = domain;
  parsed.top_keywords = (parsed.top_keywords || []).slice(0, 5);
  parsed.top_pages = (parsed.top_pages || []).slice(0, 5);
  return parsed;
}

export async function POST(request: Request) {
  try {
    const parsed = domainSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Provide a valid domain or URL", 400, "VALIDATION_ERROR");

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const limit = rateLimit(`domain:${user.id}`, 10, 60_000);
    if (!limit.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests", code: "RATE_LIMITED" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      });
    }

    const credits = await checkCredits(user.id);
    if (credits < 1) return jsonError("No credits remaining", 402, "INSUFFICIENT_CREDITS");

    const result = await generateDomainOverview(parsed.data.domain);
    const admin = createAdminClient();
    const { data: record, error: insertError } = await admin
      .from("domain_reports")
      .insert({
        user_id: user.id,
        domain: result.domain,
        results: result,
      })
      .select("id, domain, results, created_at")
      .single();
    if (insertError) throw new Error(`Unable to save domain report: ${insertError.message}`);

    const creditsLeft = await deductCredits(user.id);
    const { error: usageError } = await admin.from("usage_logs").insert({
      user_id: user.id,
      action: "domain_overview",
      tokens_used: 0,
      cost_usd: 0,
      metadata: { record_id: record.id, domain: result.domain },
    });
    if (usageError) console.error("Unable to log domain overview usage:", usageError.message);

    return Response.json({ data: { report: record, credits_left: creditsLeft } });
  } catch (error) {
    console.error("Domain overview failed:", error);
    return jsonError(error instanceof Error ? error.message : "Domain overview failed", 500, "DOMAIN_FAILED");
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase
      .from("domain_reports")
      .select("id, domain, results, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return jsonError("Unable to load domain reports", 500, "DOMAIN_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("Domain overview history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
