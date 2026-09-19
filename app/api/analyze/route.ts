import { z } from "zod";
import { analyzeArticle } from "@/lib/seo-agent";
import { createServerSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

const requestSchema = z.object({
  content: z.string().trim().min(1, "Content is required").max(40_000, "Content is too long"),
  url: z.string().url("URL must be valid").optional(),
});

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS) {
    requestLog.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return false;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return Response.json({ error: "Authentication required" }, { status: 401 });
    if (isRateLimited(user.id)) {
      return Response.json({ error: "Rate limit exceeded. Try again later." }, { status: 429, headers: { "Retry-After": "60" } });
    }

    let body: unknown;
    try { body = await request.json(); } catch { return Response.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });

    const result = await analyzeArticle(parsed.data.content);
    const { error: insertError } = await supabase.from("analyses").insert({
      user_id: user.id,
      content: parsed.data.content,
      url: parsed.data.url ?? null,
      score: result.score,
      results: result,
    });
    if (insertError) console.error("Failed to save SEO analysis", insertError);

    return Response.json({ data: result }, { status: 200 });
  } catch (error) {
    console.error("SEO analysis route failed", error);
    return Response.json({ error: "Unable to analyze content" }, { status: 500 });
  }
}
