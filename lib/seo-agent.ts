import { getOpenAIClient, OPENAI_MODEL } from "@/lib/openai";
import type { Issue, SEOAnalysis } from "@/lib/types";
import { sleep } from "@/lib/utils";

const MAX_CONTENT_LENGTH = 40_000;
const REQUEST_TIMEOUT_MS = 30_000;

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "title", "metaDescription", "keywords", "suggestions", "readability", "wordCount", "issues"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    title: { type: "string" },
    metaDescription: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
    suggestions: { type: "array", items: { type: "string" } },
    readability: { type: "integer", minimum: 0, maximum: 100 },
    wordCount: { type: "integer", minimum: 0 },
    issues: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["type", "message"], properties: { type: { type: "string" }, message: { type: "string" } } },
    },
  },
} as const;

export async function analyzeArticle(content: string): Promise<SEOAnalysis> {
  const article = content.trim().slice(0, MAX_CONTENT_LENGTH);
  const client = getOpenAIClient();
  const prompt = `Analyze this article for search intent, topical coverage, on-page SEO, structure, and readability. Return only structured JSON. Article:\n\n${article}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const completion = await client.chat.completions.create(
        {
          model: OPENAI_MODEL,
          temperature: 0.2,
          response_format: { type: "json_schema", json_schema: { name: "seo_analysis", strict: true, schema: analysisSchema } },
          messages: [
            {
              role: "system",
              content: "You are a senior technical SEO strategist. Recommendations must be actionable and must not claim guaranteed rankings or invent search data.",
            },
            { role: "user", content: prompt },
          ],
        },
        { timeout: REQUEST_TIMEOUT_MS },
      );

      const contentJson = completion.choices[0]?.message?.content;
      if (!contentJson) throw new Error("OpenAI returned an empty response");
      return JSON.parse(contentJson) as SEOAnalysis;
    } catch (error) {
      if (attempt === 2) throw error;
      await sleep(500 * 2 ** attempt);
    }
  }

  throw new Error("SEO analysis failed");
}

export async function generateKeywords(topic: string) {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create(
    {
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return JSON with a keywords array of 10 strings. Do not claim access to proprietary keyword data." },
        { role: "user", content: `Generate SEO keyword ideas for: ${topic.trim()}` },
      ],
    },
    { timeout: REQUEST_TIMEOUT_MS },
  );
  const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}") as { keywords?: unknown };
  return Array.isArray(parsed.keywords) ? parsed.keywords.filter((keyword): keyword is string => typeof keyword === "string").slice(0, 10) : [];
}

export type { Issue };