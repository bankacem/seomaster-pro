import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenAIClient, OPENAI_MODEL } from "@/lib/openai";
import { jsonError, sleep } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const onpageSchema = z.object({
  url: z.string().url(),
});

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_HTML_LENGTH = 2_000_000;
const CRAWLER_USER_AGENT = "SEOMasterProBot/1.0 (+https://seomaster.pro/bot)";

interface OnPageRecommendation {
  category: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  how_to_fix: string;
}

interface OnPageReport {
  score: number;
  recommendations: OnPageRecommendation[];
  summary: string;
}

interface ExtractedPage {
  url: string;
  status: number;
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  wordCount: number;
  content: string;
}

const onpageResultSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "recommendations", "summary"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "priority", "title", "description", "how_to_fix"],
        properties: {
          category: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          title: { type: "string" },
          description: { type: "string" },
          how_to_fix: { type: "string" },
        },
      },
    },
    summary: { type: "string" },
  },
} as const;

function normalizeUrl(value: string) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported");
  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString();
}

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    /^127\./u.test(host) ||
    /^10\./u.test(host) ||
    /^192\.168\./u.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./u.test(host)
  );
}

function getAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "iu"));
  return match?.[1]?.trim() || "";
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

async function fetchPage(url: string): Promise<ExtractedPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": CRAWLER_USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain" },
      redirect: "manual",
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
    const text = (await response.text()).slice(0, MAX_HTML_LENGTH);

    const title = isHtml ? decodeHtml(text.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu)?.[1] || "") : "";
    const descriptionTag = isHtml ? text.match(/<meta\b[^>]*>/giu)?.find((tag) => /name\s*=\s*["']description["']/iu.test(tag)) : undefined;
    const metaDescription = descriptionTag ? getAttribute(descriptionTag, "content") : "";
    const h1 = isHtml ? (text.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/giu) || []).map((h) => decodeHtml(h)).slice(0, 5) : [];
    const h2 = isHtml ? (text.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/giu) || []).map((h) => decodeHtml(h)).slice(0, 10) : [];
    const visibleText = decodeHtml(text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/giu, " "));
    const wordCount = visibleText ? visibleText.split(/\s+/u).length : 0;

    return {
      url,
      status: response.status,
      title,
      metaDescription,
      h1,
      h2,
      wordCount,
      content: visibleText.slice(0, 8_000),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function generateOnPageReport(page: ExtractedPage): Promise<OnPageReport> {
  const client = getOpenAIClient();
  const prompt = `Review this web page and return an on-page SEO analysis with an overall score (0-100), prioritized recommendations, and a short summary. Each recommendation must include category, priority (high/medium/low), title, description, and how_to_fix instructions.\n\nURL: ${page.url}\nTitle: ${page.title || "(missing)"}\nMeta description: ${page.metaDescription || "(missing)"}\nH1 count: ${page.h1.length}\nH1 samples: ${page.h1.slice(0, 3).join(" | ") || "(none)"}\nH2 count: ${page.h2.length}\nH2 samples: ${page.h2.slice(0, 5).join(" | ") || "(none)"}\nWord count: ${page.wordCount}\nVisible content excerpt:\n${page.content}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const completion = await client.chat.completions.create(
        {
          model: OPENAI_MODEL,
          temperature: 0.2,
          response_format: { type: "json_schema", json_schema: { name: "onpage_report", strict: true, schema: onpageResultSchema } },
          messages: [
            {
              role: "system",
              content:
                "You are a senior technical SEO auditor. Recommendations must be actionable and specific. Return JSON only.",
            },
            { role: "user", content: prompt },
          ],
        },
        { timeout: 30_000 },
      );

      const contentJson = completion.choices[0]?.message?.content;
      if (!contentJson) throw new Error("OpenAI returned an empty response");
      const parsed = JSON.parse(contentJson) as OnPageReport;
      if (!Array.isArray(parsed.recommendations)) throw new Error("Invalid on-page payload");
      return parsed;
    } catch (error) {
      if (attempt === 2) throw error;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw new Error("On-page analysis failed");
}

export async function POST(request: Request) {
  try {
    const parsed = onpageSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Provide a valid URL", 400, "VALIDATION_ERROR");

    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeUrl(parsed.data.url);
      if (isPrivateHost(new URL(normalizedUrl).hostname)) {
        return jsonError("Private and local hosts cannot be analyzed", 400, "VALIDATION_ERROR");
      }
    } catch {
      return jsonError("Provide a valid URL", 400, "VALIDATION_ERROR");
    }

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const limit = rateLimit(`onpage:${user.id}`, 10, 60_000);
    if (!limit.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests", code: "RATE_LIMITED" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      });
    }

    const credits = await checkCredits(user.id);
    if (credits < 1) return jsonError("No credits remaining", 402, "INSUFFICIENT_CREDITS");

    const page = await fetchPage(normalizedUrl);
    const report = await generateOnPageReport(page);
    const admin = createAdminClient();
    const { data: record, error: insertError } = await admin
      .from("onpage_reports")
      .insert({
        user_id: user.id,
        url: normalizedUrl,
        results: { ...report, page: { status: page.status, title: page.title, metaDescription: page.metaDescription, wordCount: page.wordCount, h1Count: page.h1.length, h2Count: page.h2.length } },
      })
      .select("id, url, results, created_at")
      .single();
    if (insertError) throw new Error(`Unable to save on-page report: ${insertError.message}`);

    const creditsLeft = await deductCredits(user.id);
    const { error: usageError } = await admin.from("usage_logs").insert({
      user_id: user.id,
      action: "onpage_analysis",
      tokens_used: 0,
      cost_usd: 0,
      metadata: { record_id: record.id, url: normalizedUrl, status: page.status },
    });
    if (usageError) console.error("Unable to log on-page usage:", usageError.message);

    return Response.json({ data: { report: record, credits_left: creditsLeft } });
  } catch (error) {
    console.error("On-page analysis failed:", error);
    return jsonError(error instanceof Error ? error.message : "On-page analysis failed", 500, "ONPAGE_FAILED");
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase
      .from("onpage_reports")
      .select("id, url, results, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return jsonError("Unable to load on-page reports", 500, "ONPAGE_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("On-page history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
