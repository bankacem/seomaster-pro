import { createServerSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return Response.json({ error: "Authentication required" }, { status: 401 });

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { count, error } = await supabase
      .from("analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", monthStart.toISOString());
    if (error) throw error;

    const analysesThisMonth = count ?? 0;
    const monthlyLimit = 5;
    return Response.json({ data: { analysesThisMonth, monthlyLimit, remaining: Math.max(0, monthlyLimit - analysesThisMonth) } });
  } catch (error) {
    console.error("Usage route failed", error);
    return Response.json({ error: "Unable to retrieve usage" }, { status: 500 });
  }
}
