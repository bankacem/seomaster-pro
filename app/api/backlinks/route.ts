import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenAIClient, OPENAI_MODEL } from "@/lib/openai";
import { jsonError, sleep } from "@/lib/utils";

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

const backlinkResultSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "domain",
    "total_backlinks",
    "referring_domains",
    "domain_authority",
    "top_backlinks",
    "toxic_backlinks",
    "lost_last_30d",
    "gained_last_30d",
  ],
  properties: {
    domain: { type: "string" },
    total_backlinks: { type: "integer", minimum: 0 },
    referring_domains: { type: "integer", minimum: 0 },
    domain_authority: { type: "integer", minimum: 0, maximum: 100 },
    top_backlinks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source_domain", "authority", "anchor_text", "link_type", "first_seen"],
        properties: {
          source_domain: { type: "string" },
          authority: { type: "integer", minimum: 0, maximum: 100 },
          anchor_text: { type: "string" },
          link_type: { type: "string", enum: ["dofollow", "nofollow"] },
          first_seen: { type: "string" },
        },
      },
    },
    toxic_backlinks: { type: "integer", minimum: 0 },
    lost_last_30d: { type: "integer", minimum: 0 },
    gained_last_30d: { type: "integer", minimum: 0 },
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
  const client = getOpenAIClient();
  const prompt = `Generate a plausible AI-estimated backlink profile for the domain "${domain}". Use these baseline numbers as a guide (you may adjust by ±10%%): total_backlinks ~${seed.totalBacklinks}, referring_domains ~${seed.referringDomains}, domain_authority ~${seed.domainAuthority}, toxic_backlinks ~${seed.toxic}, lost_last_30d ~${seed.lost}, gained_last_30d ~${seed.gained}. Provide 5 plausible top backlinks. Do NOT claim these are exact figures from proprietary indexes.`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const completion = await client.chat.completions.create(
        {
          model: OPENAI_MODEL,
          temperature: 0.2,
          response_format: { type: "json_schema", json_schema: { name: "backlink_profile", strict: true, schema: backlinkResultSchema } },
          messages: [
            {
              role: "system",
              content:
                "You are a senior off-page SEO analyst. Return JSON only. Numbers must be plausible estimates; do not claim exact data.",
            },
            { role: "user", content: prompt },
          ],
        },
        { timeout: 30_000 },
      );

      const contentJson = completion.choices[0]?.message?.content;
      if (!contentJson) throw new Error("OpenAI returned an empty response");
      const parsed = JSON.parse(contentJson) as BacklinkProfile;
      parsed.domain = domain;
      parsed.top_backlinks = (parsed.top_backlinks || []).slice(0, 5);
      return parsed;
    } catch (error) {
      if (attempt === 2) throw error;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw new Error("Backlink analysis failed");
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
