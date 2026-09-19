import { getServerSession } from "next-auth";
import { z } from "zod";
import { analyzeArticle } from "@/lib/seo-agent";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    if (isRateLimited(userEmail)) {
      return Response.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await analyzeArticle(parsed.data.content);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
      const saveResponse = await fetch(`${supabaseUrl}/rest/v1/analyses`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          user_email: userEmail,
          source_url: parsed.data.url ?? null,
          content: parsed.data.content,
          result,
        }),
      });

      if (!saveResponse.ok) {
        console.error("Failed to save SEO analysis", await saveResponse.text());
      }
    }

    return Response.json({ data: result }, { status: 200 });
  } catch (error) {
    console.error("SEO analysis route failed", error);
    return Response.json({ error: "Unable to analyze content" }, { status: 500 });
  }
}
