/**
 * SEO analysis agent powered by OpenAI.
 *
 * The module intentionally uses the OpenAI HTTP API directly so it can run in
 * Next.js route handlers without requiring an SDK at runtime.
 */

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const MAX_CONTENT_LENGTH = 40_000;
const REQUESTS_PER_MINUTE = 20;

export interface SeoIssue {
  type: string;
  message: string;
}

export interface ArticleAnalysis {
  score: number;
  title: string;
  metaDescription: string;
  keywords: string[];
  suggestions: string[];
  readability: number;
  wordCount: number;
  issues: SeoIssue[];
  competitorComparison?: Record<string, unknown>;
}

export interface SuggestedKeyword {
  keyword: string;
  estimatedSearchVolume: number;
}

export interface CompetitorAnalysis {
  url: string;
  title: string;
  metaDescription: string;
  keywords: string[];
  wordCount: number;
  score: number;
  suggestions: string[];
  competitorComparison: Record<string, unknown>;
}

interface OpenAiMessage {
  role: "system" | "user";
  content: string;
}

interface OpenAiResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

const requestTimestamps: number[] = [];

function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || undefined;
}

function consumeRateLimit(): boolean {
  const now = Date.now();
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > 60_000) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= REQUESTS_PER_MINUTE) return false;
  requestTimestamps.push(now);
  return true;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function countWords(content: string): number {
  return content.trim() ? content.trim().split(/\s+/u).length : 0;
}

function createFallbackArticleAnalysis(content: string): ArticleAnalysis {
  const wordCount = countWords(content);
  const sentences = content.split(/[.!?]+/u).filter(Boolean).length || 1;
  const averageSentenceLength = wordCount / sentences;
  const readability = clamp(100 - (averageSentenceLength - 14) * 2, 20, 100);
  const issues: SeoIssue[] = [];

  if (wordCount < 600) {
    issues.push({ type: "content-length", message: "The article is shorter than the recommended 600 words." });
  }
  if (averageSentenceLength > 25) {
    issues.push({ type: "readability", message: "Several sentences may be too long for easy scanning." });
  }
  if (!/[.!?]/u.test(content)) {
    issues.push({ type: "structure", message: "Add clear sentence punctuation and headings to improve structure." });
  }

  return {
    score: clamp(70 - issues.length * 8, 0, 100),
    title: "Untitled article",
    metaDescription: content.trim().slice(0, 155),
    keywords: [],
    suggestions: [
      "Add a descriptive title containing the primary topic.",
      "Use descriptive headings and short paragraphs.",
      "Add internal links and a clear call to action.",
    ],
    readability,
    wordCount,
    issues,
  };
}

function createFallbackKeywords(topic: string): SuggestedKeyword[] {
  const normalizedTopic = topic.trim().replace(/\s+/gu, " ") || "seo";
  const modifiers = [
    "guide",
    "best practices",
    "tips",
    "strategy",
    "tools",
    "for beginners",
    "checklist",
    "services",
    "examples",
    "how to",
  ];

  return modifiers.map((modifier, index) => ({
    keyword: modifier === "how to" ? `${modifier} ${normalizedTopic}` : `${normalizedTopic} ${modifier}`,
    estimatedSearchVolume: Math.max(100, 12_000 - index * 850),
  }));
}

function parseJson<T>(content: string): T {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  return JSON.parse(cleaned) as T;
}

async function requestOpenAi<T>(messages: OpenAiMessage, fallback: T): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey || !consumeRateLimit()) return fallback;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages,
        }),
        signal: controller.signal,
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt < MAX_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
          continue;
        }
        return fallback;
      }
      if (!response.ok) return fallback;

      const data = (await response.json()) as OpenAiResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) return fallback;
      return parseJson<T>(content);
    } catch {
      if (attempt === MAX_ATTEMPTS - 1) return fallback;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    } finally {
      clearTimeout(timeout);
    }
  }

  return fallback;
}

const ARTICLE_SYSTEM_PROMPT = `You are a senior technical SEO strategist and content editor. Analyze the supplied article objectively for search intent, topical coverage, on-page SEO, structure, and readability. Return only valid JSON with exactly these fields: score (integer 0-100), title (optimized title), metaDescription (150-160 characters when possible), keywords (array of relevant strings), suggestions (array of actionable strings), readability (integer 0-100 where higher is easier to read), wordCount (integer), issues (array of objects with type and message), and optional competitorComparison. Do not invent performance data or claim that rankings are guaranteed. Write recommendations in professional, concise English.`;

export async function analyzeArticle(content: string): Promise<ArticleAnalysis> {
  const article = content.trim().slice(0, MAX_CONTENT_LENGTH);
  const fallback = createFallbackArticleAnalysis(article);
  if (!article) return fallback;

  const result = await requestOpenAi<ArticleAnalysis>(
    [
      { role: "system", content: ARTICLE_SYSTEM_PROMPT },
      { role: "user", content: `Analyze this article. Its complete text follows:\n\n${article}` },
    ],
    fallback,
  );

  return {
    ...fallback,
    ...result,
    score: clamp(Number(result.score), 0, 100),
    readability: clamp(Number(result.readability), 0, 100),
    wordCount: Number.isFinite(Number(result.wordCount)) ? Number(result.wordCount) : fallback.wordCount,
    keywords: Array.isArray(result.keywords) ? result.keywords.map(String).slice(0, 30) : fallback.keywords,
    suggestions: Array.isArray(result.suggestions) ? result.suggestions.map(String) : fallback.suggestions,
    issues: Array.isArray(result.issues) ? result.issues : fallback.issues,
  };
}

export async function generateKeywords(topic: string): Promise<SuggestedKeyword[]> {
  const fallback = createFallbackKeywords(topic);
  const result = await requestOpenAi<{ keywords: SuggestedKeyword[] }>(
    [
      {
        role: "system",
        content: "You are an SEO keyword researcher. Return JSON with a keywords array containing exactly 10 objects. Each object must have keyword (string) and estimatedSearchVolume (realistic monthly integer estimate). Use varied search intent and do not imply access to proprietary keyword data.",
      },
      { role: "user", content: `Generate SEO keywords for the topic: ${topic.trim()}` },
    ],
    { keywords: fallback },
  );

  return (Array.isArray(result.keywords) ? result.keywords : fallback)
    .filter((item) => item && typeof item.keyword === "string")
    .slice(0, 10)
    .map((item) => ({
      keyword: item.keyword.trim(),
      estimatedSearchVolume: Math.max(0, Math.round(Number(item.estimatedSearchVolume) || 0)),
    }));
}

function extractPageText(html: string): { title: string; metaDescription: string; text: string } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1]?.trim() || "Untitled competitor page";
  const metaDescription = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/iu)?.[1]?.trim() || "";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/giu, " ")
    .replace(/<style[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;|&#160;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/\s+/gu, " ")
    .trim();
  return { title, metaDescription, text };
}

export async function analyzeCompetitor(url: string): Promise<CompetitorAnalysis> {
  const fallbackPage = { title: "Unable to fetch competitor", metaDescription: "", text: "" };
  try {
    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Unsupported URL protocol");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let page: { title: string; metaDescription: string; text: string };
    try {
      const response = await fetch(parsedUrl, { headers: { "User-Agent": "SEOMasterPro SEO crawler/1.0" }, signal: controller.signal });
      if (!response.ok) throw new Error(`Competitor returned ${response.status}`);
      page = extractPageText((await response.text()).slice(0, 250_000));
    } finally {
      clearTimeout(timeout);
    }

    const analysis = await analyzeArticle(page.text);
    return {
      url,
      title: page.title,
      metaDescription: page.metaDescription,
      keywords: analysis.keywords,
      wordCount: analysis.wordCount,
      score: analysis.score,
      suggestions: analysis.suggestions,
      competitorComparison: {
        titleLength: page.title.length,
        metaDescriptionLength: page.metaDescription.length,
        note: "This baseline can be compared with the user's article analysis.",
      },
    };
  } catch {
    const analysis = createFallbackArticleAnalysis(fallbackPage.text);
    return {
      url,
      title: fallbackPage.title,
      metaDescription: "",
      keywords: [],
      wordCount: 0,
      score: analysis.score,
      suggestions: ["The competitor page could not be fetched. Verify the URL and try again."],
      competitorComparison: { unavailable: true },
    };
  }
}
