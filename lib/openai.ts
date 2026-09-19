import OpenAI from "openai";

let openaiClient: OpenAI | undefined;

/** Returns the lazily initialized server-side OpenAI client. */
export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

export const OPENAI_MODEL = "gpt-4o-mini";

export interface OpenAIJsonOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  timeoutMs?: number;
}

/** Executes a JSON-mode chat completion with an AbortSignal timeout. */
export async function createJsonCompletion<T>({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  timeoutMs = 30_000,
}: OpenAIJsonOptions): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const completion = await getOpenAIClient().chat.completions.create(
      {
        model: OPENAI_MODEL,
        temperature,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
      { signal: controller.signal },
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty response");
    return JSON.parse(content) as T;
  } finally {
    clearTimeout(timeout);
  }
}
