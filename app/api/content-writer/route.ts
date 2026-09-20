import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkCredits, deductCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAIJson, callAIWithRetry } from "@/lib/ai";
import { jsonError } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const TONES = ["professional", "casual", "friendly", "expert"] as const;

const contentWriterSchema = z.object({
  topic: z.string().trim().min(3).max(200),
  keywords: z.array(z.string().trim().min(2).max(80)).max(20).optional(),
  wordCount: z.number().int().min(300).max(3000).optional(),
  tone: z.enum(TONES).optional(),
});

type Tone = (typeof TONES)[number];

interface ContentWriteResult {
  title: string;
  slug: string;
  metaDescription: string;
  content: string;
  headings: string[];
  suggestedKeywords: string[];
  estimatedReadTime: number;
  seoScore: number;
}

const TONE_GUIDE: Record<Tone, string> = {
  professional:
    "Use a professional, authoritative tone. Cite facts where appropriate, use precise industry terminology, and keep sentences tight and business-friendly.",
  casual:
    "Use a casual, conversational tone. Write like you're explaining the topic to a friend over coffee — approachable, light, and engaging.",
  friendly:
    "Use a friendly, warm tone. Be encouraging and personable, address the reader directly with 'you', and keep the energy positive.",
  expert:
    "Use an expert, technical tone. Demonstrate deep subject-matter expertise, reference frameworks, standards, or research where relevant, and assume an informed audience.",
};

function buildSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gu, "")
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
}

function countWords(text: string) {
  const match = text.match(/\b[\w'-]+\b/gu);
  return match ? match.length : 0;
}

async function generateArticle(input: {
  topic: string;
  keywords: string[];
  wordCount: number;
  tone: Tone;
}): Promise<ContentWriteResult> {
  const schemaDescription = `Return a valid JSON object with this exact structure:
{
  "title": "string — compelling SEO title (50-60 chars)",
  "slug": "string — URL-safe slug (lowercase, hyphen-separated)",
  "metaDescription": "string — 140-160 chars meta description",
  "content": "string — full markdown article (start with '# <title>' H1, use '## Section' H2s, '### Subsection' H3s, '- ' bullet lists, **bold** for emphasis)",
  "headings": ["H2: ...", "H3: ...", ...],
  "suggestedKeywords": ["related kw1", "related kw2", ...],
  "estimatedReadTime": "integer (minutes, rounded up)",
  "seoScore": "integer 0-100 (self-assessed)"
}
The content MUST be roughly ${input.wordCount} words (±10%). Use proper markdown structure: H1 title, H2 sections, H3 subsections, lists, and bold for emphasis. Provide 5-10 headings, 5-10 suggestedKeywords. Return ONLY valid JSON — no markdown, no code fences, no surrounding prose.`;

  const systemPrompt = `You are a senior SEO content writer and copy editor. Produce a complete, original, well-structured, SEO-optimized article in markdown. ${TONE_GUIDE[input.tone]} Never fabricate citations to nonexistent sources; if you cite data, keep it generic and clearly an estimate. Return JSON only. ${schemaDescription}`;

  const userPrompt = `Write an SEO-optimized article on the topic below.

Topic: ${input.topic}
Target word count: ${input.wordCount} words (±10% allowed)
Tone: ${input.tone}
${input.keywords.length > 0 ? `Primary keywords to weave in naturally (do not stuff): ${input.keywords.join(", ")}` : "No primary keywords provided — choose natural keyword variants yourself."}

Requirements:
- Title: 50-60 chars, compelling, includes the core topic.
- Slug: URL-safe (lowercase, hyphens), derived from the title.
- Meta description: 140-160 chars, includes primary keyword.
- Content: full markdown. Must start with an H1 (the title). Use H2 sections, H3 subsections where helpful, bullet lists, numbered lists, and **bold** for emphasis. Include a short intro, multiple body sections, and a conclusion.
- Headings: list every H2/H3 you used in the article, prefixed with "H2: " or "H3: ".
- SuggestedKeywords: 5-10 related keywords a reader might also target.
- estimatedReadTime: minutes, rounded up (assume 200 words/min).
- seoScore: your honest self-assessment 0-100 of how well-optimized this article is for the topic and target word count.`;

  const { data: parsed } = await callAIWithRetry(() =>
    callAIJson<ContentWriteResult>(userPrompt, systemPrompt, {
      temperature: 0.6,
      maxOutputTokens: 8192,
    })
  );

  if (!parsed || typeof parsed.content !== "string" || !parsed.content.trim()) {
    throw new Error("Invalid article payload");
  }

  // Defensive normalization — never trust AI for clean numbers/strings.
  const title = (parsed.title || "").trim().slice(0, 120) || input.topic;
  const slug = (parsed.slug || buildSlug(title)).trim().slice(0, 100);
  const metaDescription = (parsed.metaDescription || "").trim().slice(0, 180);
  const headings = Array.isArray(parsed.headings) ? parsed.headings.map((h) => String(h)).slice(0, 20) : [];
  const suggestedKeywords = Array.isArray(parsed.suggestedKeywords)
    ? parsed.suggestedKeywords.map((k) => String(k)).slice(0, 15)
    : [];
  const wordCount = countWords(parsed.content);
  const estimatedReadTime =
    Number.isFinite(parsed.estimatedReadTime) && parsed.estimatedReadTime > 0
      ? Math.max(1, Math.round(parsed.estimatedReadTime))
      : Math.max(1, Math.ceil(wordCount / 200));
  const seoScore =
    Number.isFinite(parsed.seoScore) && parsed.seoScore >= 0 && parsed.seoScore <= 100
      ? Math.round(parsed.seoScore)
      : 75;

  return {
    title,
    slug,
    metaDescription,
    content: parsed.content,
    headings,
    suggestedKeywords,
    estimatedReadTime,
    seoScore,
  };
}

export async function POST(request: Request) {
  try {
    const parsed = contentWriterSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError("Topic must be 3-200 chars; wordCount 300-3000; tone must be professional|casual|friendly|expert", 400, "VALIDATION_ERROR");
    }

    const { user } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const limit = rateLimit(`content-writer:${user.id}`, 10, 60_000);
    if (!limit.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests", code: "RATE_LIMITED" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      });
    }

    const credits = await checkCredits(user.id);
    if (credits < 2) return jsonError("This action requires 2 credits", 402, "INSUFFICIENT_CREDITS");

    const input = {
      topic: parsed.data.topic,
      keywords: (parsed.data.keywords || []).filter((k) => k.trim().length >= 2),
      wordCount: parsed.data.wordCount ?? 800,
      tone: parsed.data.tone ?? "professional",
    };

    const result = await generateArticle(input);

    const admin = createAdminClient();
    const { data: record, error: insertError } = await admin
      .from("content_writes")
      .insert({
        user_id: user.id,
        topic: input.topic,
        results: { ...result, requestedWordCount: input.wordCount, requestedTone: input.tone, requestedKeywords: input.keywords },
      })
      .select("id, topic, results, created_at")
      .single();
    if (insertError) throw new Error(`Unable to save content write: ${insertError.message}`);

    const creditsLeft = await deductCredits(user.id, 2);
    const { error: usageError } = await admin.from("usage_logs").insert({
      user_id: user.id,
      action: "content_write",
      tokens_used: 0,
      cost_usd: 0,
      metadata: { record_id: record.id, topic: input.topic, wordCount: input.wordCount, tone: input.tone },
    });
    if (usageError) console.error("Unable to log content_write usage:", usageError.message);

    return Response.json({ data: { article: record, credits_left: creditsLeft } });
  } catch (error) {
    console.error("Content writer failed:", error);
    return jsonError(error instanceof Error ? error.message : "Content generation failed", 500, "CONTENT_WRITER_FAILED");
  }
}

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");
    const { data, error } = await supabase
      .from("content_writes")
      .select("id, topic, results, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return jsonError("Unable to load content writes", 500, "CONTENT_WRITER_LOOKUP_FAILED");
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error("Content writer history failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
