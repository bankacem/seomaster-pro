import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAIJson, callAIWithRetry } from "@/lib/ai";
import { jsonError } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 30;

const backlinkSchema = z.object({
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

interface TopBacklink {
  source_domain: string;
  authority: number;
  anchor_text: string;
  link_type: "dofollow" | "nofollow";
  first_seen: string;
}

interface BacklinkProfile {
  domain: string;
  total_backlinks: number;
  referring_domains: number;
  domain_authority: number;
  top_backlinks: TopBacklink[];
  toxic_backlinks: number;
  lost_last_30d: number;
  gained_last_30d: number;
}

function normalizeDomain(value: string) {
  const candidate = value.includes("://") ? value : `https://${value}`;
  try {
    return new URL(candidate).hostname.replace(/^www\./u, "").toLowerCase();
  } catch {
    return value.toLowerCase().replace(/^www\./u, "");
  }
}

// Deterministic seed from a domain string keeps the AI-estimated profile
// consistent across repeated calls for the same domain.
function seededBaseline(domain: string) {
  let hash = 0;
  for (let i = 0; i < domain.length; i += 1) {
    hash = (hash * 31 + domain.charCodeAt(i)) >>> 0;
  }
  return {
    totalBacklinks: 1_200 + (hash % 9_000),
    referringDomains: 60 + (hash % 540),
    domainAuthority: 12 + (hash % 70),
    toxic: (hash % 12) + 1,
    lost: 5 + (hash % 40),
    gained: 8 + (hash % 60),
  };
}

async function generateBacklinkProfile(rawDomain: string): Promise<BacklinkProfile> {
  const domain = normalizeDomain(rawDomain);
  const seed = seededBaseline(domain);

  const schemaDescription = `Return a valid JSON object with this exact structure:
{
  "domain": "string",
  "total_backlinks": "integer >=0",
  "referring_domains": "integer >=0",
  "domain_authority": "integer 0-100",
  "top_backlinks": [
    {
      "source_domain": "string",
      "authority": "integer 0-100",
      "anchor_text": "string",
      "link_type": "dofollow" | "nofollow",
      "first_seen": "string (ISO date)"
    }
  ],
  "toxic_backlinks": "integer >=0",
  "lost_last_30d": "integer >=0",
  "gained_last_30d": "integer >=0"
}
Provide up to 5 top_backlinks. Return ONLY valid JSON — no markdown, no code fences, no surrounding prose.`;

  const systemPrompt = `You are a senior off-page SEO analyst. Return JSON only. Numbers must be plausible estimates; do not claim exact data. ${schemaDescription}`;

  const userPrompt = `Generate a plausible AI-estimated backlink profile for the domain "${domain}". Use these baseline numbers as a guide (you may adjust by ±10%): total_backlinks ~${seed.totalBacklinks}, referring_domains ~${seed.referringDomains}, domain_authority ~${seed.domainAuthority}, toxic_backlinks ~${seed.toxic}, lost_last_30d ~${seed.lost}, gained_last_30d ~${seed.gained}. Provide 5 plausible top backlinks. Do NOT claim these are exact figures from proprietary indexes.`;

  const { data: parsed } = await callAIWithRetry(() =>
    callAIJson<BacklinkProfile>(userPrompt, systemPrompt, { temperature: 0.2 })
  );

  parsed.domain = domain;
  parsed.top_backlinks = (parsed.top_backlinks || []).slice(0, 5);
  return parsed;
}

export async function POST(request: Request) {
  try {
    const parsed = backlinkSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Provide a valid domain or URL", 400, "VALIDATION_ERROR");

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const limit = rateLimit(`backlinks:${user.id}`, 10, 60_000);
    if (!limit.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests", code: "RATE_LIMITED" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      });
    }

    const credits = await checkCredits(user.id);
    if (credits < 1) return jsonError("No credits remaining", 402, "INSUFFICIENT_CREDITS");

    const result = await generateBacklinkProfile(parsed.data.domain);
    const admin = createAdminClient();
    const { data: record, error: insertError } = await admin
      .from("backlink_reports")
      .insert({
        user_id: user.id,
        domain: result.domain,
        results: result,
      })
      .select("id, domain, results, created_at")
      .single();
    if (insertError) throw new Error(`Unable to save backlink report: ${insertError.message}`);

    const creditsLeft = await deductCredits(user.id);
    const { error: usageError } = await admin.from("usage_logs").insert({
      user_id: user.id,
      action: "backlink_analysis",
      tokens_used: 0,
      cost_usd: 0,
      metadata: { record_id: record.id, domain: result.domain },
    });
    if (usageError) console.error("Unable to log backlink usage:", usageError.message);

    return Response.json({ data: { report: record, credits_left: creditsLeft } });
  } catch (error) {
    console.error("Backlink analysis failed:", error);
    return jsonError(error instanceof Error ? error.message : "Backlink analysis failed", 500, "BACKLINK_FAILED");
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase
      .from("backlink_reports")
      .select("id, domain, results, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return jsonError("Unable to load backlink reports", 500, "BACKLINK_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("Backlink history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
