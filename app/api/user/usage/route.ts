import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const monthlyLimit = 5;

    if (!supabaseUrl || !serviceKey) {
      return Response.json({
        data: { analysesThisMonth: 0, monthlyLimit, remaining: monthlyLimit },
      });
    }

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const query = new URLSearchParams({
      user_email: `eq.${userEmail}`,
      created_at: `gte.${monthStart.toISOString()}`,
      select: "id",
      limit: "1000",
    });

    const response = await fetch(`${supabaseUrl}/rest/v1/analyses?${query}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Supabase returned ${response.status}`);
    }

    const rows = (await response.json()) as Array<{ id: string }>;
    const analysesThisMonth = rows.length;

    return Response.json({
      data: {
        analysesThisMonth,
        monthlyLimit,
        remaining: Math.max(0, monthlyLimit - analysesThisMonth),
      },
    });
  } catch (error) {
    console.error("Usage route failed", error);
    return Response.json({ error: "Unable to retrieve usage" }, { status: 500 });
  }
}
