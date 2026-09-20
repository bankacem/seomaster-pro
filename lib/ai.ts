import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import ZAIClient from "z-ai-web-dev-sdk";

/**
 * Unified AI provider layer for SEOMaster Pro.
 *
 * Provider priority (first available wins):
 *   1. GOOGLE_GEMINI_API_KEY  → Google Gemini (gemini-flash-latest)
 *   2. OPENAI_API_KEY          → OpenAI (gpt-4o-mini)
 *   3. z-ai-web-dev-sdk        → ZAI / GLM-4 (no API key needed; works everywhere)
 *
 * If none of the above are reachable, callAI() throws a clear runtime error.
 * The active provider is detected lazily so the rest of the app (landing,
 * auth, etc.) still works even if no provider is configured.
 */

const hasGemini = Boolean(process.env.GOOGLE_GEMINI_API_KEY);
const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);

let geminiClient: GoogleGenerativeAI | null = null;
if (hasGemini) {
  geminiClient = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY as string);
}

let openaiClient: OpenAI | null = null;
if (hasOpenAI) {
  openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY as string });
}

// Z-AI client (lazy-initialised — see callZAI)
let zaiClientPromise: Promise<ZAIClient> | null = null;

export type AIProvider = "gemini" | "openai" | "zai" | "none";

export function getActiveProvider(): AIProvider {
  if (geminiClient) return "gemini";
  if (openaiClient) return "openai";
  return "zai"; // Z-AI is always available (uses ambient credentials)
}

export interface AIResponse {
  text: string;
  tokensUsed: number;
  provider: AIProvider;
}

const DEFAULT_MAX_TOKENS = 8000;
const DEFAULT_TEMPERATURE = 0.4;

/**
 * Strip code fences and surrounding prose so we can parse JSON reliably.
 */
function sanitizeJsonText(raw: string): string {
  let text = raw.trim();
  // Strip ```json\n ... ``` or ```\n ... ```
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  // Strip leading "Here is the JSON:" style prefixes
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  let start = -1;
  if (firstBrace === -1) start = firstBracket;
  else if (firstBracket === -1) start = firstBrace;
  else start = Math.min(firstBrace, firstBracket);
  if (start > 0) text = text.slice(start);
  // Strip trailing prose after the JSON
  const lastBrace = text.lastIndexOf("}");
  const lastBracket = text.lastIndexOf("]");
  const end = Math.max(lastBrace, lastBracket);
  if (end >= 0 && end < text.length - 1) text = text.slice(0, end + 1);
  return text.trim();
}

interface BaseCallOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
}

async function callGemini(opts: BaseCallOptions): Promise<AIResponse> {
  if (!geminiClient) throw new Error("Gemini client not initialized");
  const model = geminiClient.getGenerativeModel({
    model: "gemini-flash-latest",
    systemInstruction: opts.systemPrompt,
    generationConfig: {
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: opts.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
      ...(opts.jsonMode !== false ? { responseMimeType: "application/json" } : {}),
    },
  });

  const result = await model.generateContent(opts.prompt);
  const text = result.response.text();
  const tokensUsed =
    (result.response.usageMetadata?.totalTokenCount as number | undefined) ?? 0;
  return { text, tokensUsed, provider: "gemini" };
}

async function callOpenAI(opts: BaseCallOptions): Promise<AIResponse> {
  if (!openaiClient) throw new Error("OpenAI client not initialized");
  const completion = await openaiClient.chat.completions.create(
    {
      model: "gpt-4o-mini",
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: opts.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
      ...(opts.jsonMode !== false ? { response_format: { type: "json_object" } } : {}),
      messages: [
        ...(opts.systemPrompt ? [{ role: "system" as const, content: opts.systemPrompt }] : []),
        { role: "user" as const, content: opts.prompt },
      ],
    },
    { timeout: 30_000 }
  );
  return {
    text: completion.choices[0]?.message?.content ?? "",
    tokensUsed: completion.usage?.total_tokens ?? 0,
    provider: "openai",
  };
}

async function callZAI(opts: BaseCallOptions): Promise<AIResponse> {
  // Lazy initialise the Z-AI client (it auto-reads ambient credentials)
  if (!zaiClientPromise) {
    zaiClientPromise = ZAIClient.create();
  }
  const zai = await zaiClientPromise;

  // Z-AI uses an OpenAI-compatible shape, but does not support
  // `response_format: json_object` on every model. We instruct the model
  // in the prompt to return JSON only.
  const jsonInstruction =
    opts.jsonMode !== false
      ? "\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no surrounding prose. The first character of your response must be '{' or '[' and the last must be '}' or ']'."
      : "";

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  if (opts.systemPrompt) {
    messages.push({ role: "system", content: opts.systemPrompt + jsonInstruction });
  } else if (jsonInstruction) {
    messages.push({ role: "system", content: "You are a helpful assistant." + jsonInstruction });
  }
  messages.push({ role: "user", content: opts.prompt });

  const completion = await zai.chat.completions.create({
    messages,
    temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
  } as Parameters<typeof zai.chat.completions.create>[0]);

  const text = completion?.choices?.[0]?.message?.content ?? "";
  const tokensUsed = completion?.usage?.total_tokens ?? 0;
  return { text, tokensUsed, provider: "zai" };
}

/**
 * Unified AI caller — tries Gemini first, then OpenAI, then Z-AI.
 *
 * When `jsonMode` is true (default), we request JSON output from providers
 * that support it natively, and sanitise the response so callers can
 * `JSON.parse` it directly.
 */
export async function callAI(
  prompt: string,
  systemPrompt?: string,
  options: { temperature?: number; maxOutputTokens?: number; jsonMode?: boolean } = {}
): Promise<AIResponse> {
  const baseOpts: BaseCallOptions = {
    prompt,
    systemPrompt,
    temperature: options.temperature,
    maxOutputTokens: options.maxOutputTokens,
    jsonMode: options.jsonMode ?? true,
  };

  // 1. Try Gemini
  if (geminiClient) {
    try {
      const res = await callGemini(baseOpts);
      if (baseOpts.jsonMode !== false) res.text = sanitizeJsonText(res.text);
      return res;
    } catch (err) {
      console.error(
        "[ai] Gemini call failed, falling back:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // 2. Try OpenAI
  if (openaiClient) {
    try {
      const res = await callOpenAI(baseOpts);
      if (baseOpts.jsonMode !== false) res.text = sanitizeJsonText(res.text);
      return res;
    } catch (err) {
      console.error(
        "[ai] OpenAI call failed, falling back:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // 3. Try Z-AI (always available)
  try {
    const res = await callZAI(baseOpts);
    if (baseOpts.jsonMode !== false) res.text = sanitizeJsonText(res.text);
    return res;
  } catch (err) {
    console.error(
      "[ai] Z-AI call failed:",
      err instanceof Error ? err.message : err
    );
    throw new Error(
      "All AI providers failed. Last error: " +
        (err instanceof Error ? err.message : String(err))
    );
  }
}

/**
 * Convenience wrapper: call AI and parse the response as JSON.
 * Throws a clear error if the response is not valid JSON.
 */
export async function callAIJson<T = unknown>(
  prompt: string,
  systemPrompt?: string,
  options: { temperature?: number; maxOutputTokens?: number } = {}
): Promise<{ data: T; tokensUsed: number; provider: AIProvider }> {
  const res = await callAI(prompt, systemPrompt, { ...options, jsonMode: true });
  try {
    return { data: JSON.parse(res.text) as T, tokensUsed: res.tokensUsed, provider: res.provider };
  } catch (err) {
    console.error("[ai] Failed to parse AI JSON response:", res.text.slice(0, 500));
    throw new Error(
      `AI returned invalid JSON. Provider: ${res.provider}. First 200 chars: ${res.text.slice(0, 200)}`
    );
  }
}

/**
 * Retry wrapper with exponential backoff.
 * Use for transient errors (network, rate limits).
 */
export async function callAIWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        const delay = 500 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
