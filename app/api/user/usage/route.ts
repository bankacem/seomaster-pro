import { getAuthenticatedUser } from "@/lib/auth";
import { jsonError } from "@/lib/utils";

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const { data: profile } = await supabase
      .from("profiles")
      .select("credits, plan")
      .eq("id", user.id)
      .maybeSingle();

    const { data: recent, error: recentError } = await supabase
      .from("usage_logs")
      .select("id, action, tokens_used, cost_usd, metadata, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    // usage_logs table might not exist yet — handle gracefully
    if (recentError) {
      console.warn("Usage logs lookup failed:", recentError.message);
    }

    return Response.json({
      data: {
        plan: (profile as { plan?: string } | null)?.plan ?? "free",
        credits_left: profile?.credits ?? 0,
        total_actions: recent?.length ?? 0,
        recent: recent ?? [],
      },
    });
  } catch (error) {
    console.error("Usage endpoint failed:", error);
    return jsonError("Unable to load usage", 500, "USAGE_LOOKUP_FAILED");
  }
}
