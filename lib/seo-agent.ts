import { callAIJson, callAIWithRetry } from "@/lib/ai";
import { sleep } from "@/lib/utils";
import type { Issue, SEOAnalysis } from "@/lib/types";

const MAX_CONTENT_LENGTH = 15_000;

const seoAnalysisSchemaDescription = `Return a valid JSON object with this exact structure:
{
  "score": number (0-100, overall SEO score),
  "title": "string — improved SEO title suggestion (50-60 chars)",
  "metaDescription": "string — SEO meta description (140-160 chars)",
  "keywords": ["array of up to 10 primary keywords extracted from the article"],
  "suggestions": ["array of up to 5 actionable improvement suggestions"],
  "readability": number (0-100, Flesch-like readability score),
  "wordCount": number (approximate word count of the article),
  "issues": [
    {
      "type": "string — short issue identifier (e.g. 'title-length', 'keyword-density')",
      "message": "string — human-readable description of the issue",
      "severity": "low" | "medium" | "high"
    }
  ]
}
Return ONLY valid JSON. No markdown, no code fences, no surrounding prose.`;

interface AISEOAnalysis {
  score: number;
  title: string;
  metaDescription: string;
  keywords: string[];
  suggestions: string[];
  readability: number;
  wordCount: number;
  issues: Array<{ type: string; message: string; severity?: "low" | "medium" | "high" }>;
}

export async function analyzeArticle(content: string): Promise<SEOAnalysis> {
  const article = content.trim().slice(0, MAX_CONTENT_LENGTH);
  if (article.length < 100) throw new Error("Article too short — minimum 100 characters required.");

  const systemPrompt = `You are a senior technical SEO strategist with 15+ years of experience. Analyze articles for search intent, topical coverage, on-page SEO, structure, and readability. Your analysis must be specific, actionable, and grounded in current SEO best practices (Google Search Essentials, E-E-A-T, Core Web Vitals). Never invent metrics — only return values you can justify from the article content. ${seoAnalysisSchemaDescription}`;

  const userPrompt = `Analyze this article for SEO and return the JSON object described above:

ARTICLE:
"""
${article}
"""`;

  const { data } = await callAIWithRetry(() =>
    callAIJson<AISEOAnalysis>(userPrompt, systemPrompt, { temperature: 0.3 })
  );

  // Validate and coerce the response into our app's type
  const score = Math.max(0, Math.min(100, Math.round(Number(data.score) || 0)));
  const readability = Math.max(0, Math.min(100, Math.round(Number(data.readability) || 0)));
  const wordCount = Math.max(0, Math.round(Number(data.wordCount) || 0));

  const keywords = Array.isArray(data.keywords)
    ? data.keywords.filter((k): k is string => typeof k === "string" && k.trim().length > 0).slice(0, 10)
    : [];

  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 5)
    : [];

  const issues: Issue[] = Array.isArray(data.issues)
    ? data.issues
        .filter((i) => i && typeof i.type === "string" && typeof i.message === "string")
        .map((i) => ({
          type: String(i.type),
          message: String(i.message),
          ...(i.severity ? { severity: i.severity } : {}),
        }))
        .slice(0, 20)
    : [];

  return {
    score,
    title: String(data.title || "").slice(0, 200),
    metaDescription: String(data.metaDescription || "").slice(0, 300),
    keywords,
    suggestions,
    readability,
    wordCount,
    issues,
  };
}

export async function generateKeywords(topic: string, count = 10): Promise<string[]> {
  const cleanTopic = topic.trim().slice(0, 200);
  if (!cleanTopic) throw new Error("Topic required");

  const systemPrompt = `You are a keyword research specialist. Generate ${count} high-intent SEO keywords for the given topic. Return ONLY a JSON object with a "keywords" string array. Each keyword should be a real-world phrase people would type into Google. Mix short-tail and long-tail keywords.`;
  const userPrompt = `Generate ${count} SEO keywords for: "${cleanTopic}". Return JSON: {"keywords": ["keyword1", "keyword2", ...]}`;

  const { data } = await callAIJson<{ keywords?: unknown }>(userPrompt, systemPrompt, { temperature: 0.5 });
  return Array.isArray(data.keywords)
    ? data.keywords.filter((k): k is string => typeof k === "string" && k.trim().length > 0).slice(0, count)
    : [];
}

export type { Issue };
