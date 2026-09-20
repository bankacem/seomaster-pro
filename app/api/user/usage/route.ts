import { getAuthenticatedUser } from "@/lib/auth";
import { jsonError } from "@/lib/utils";

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const [{ data: profile, error: profileError }, { data: recent, error: recentError }] = await Promise.all([
      supabase.from("profiles").select("plan, credits").eq("id", user.id).single(),
      supabase
        .from("usage_logs")
        .select("id, action, tokens_used, cost_usd, metadata, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (profileError) {
      console.error("Profile lookup failed:", profileError.message);
      return jsonError("Unable to load usage", 500, "USAGE_LOOKUP_FAILED");
    }
    if (recentError) {
      console.error("Usage logs lookup failed:", recentError.message);
      return jsonError("Unable to load usage", 500, "USAGE_LOOKUP_FAILED");
    }

    return Response.json({
      data: {
        plan: profile.plan,
        credits_left: profile.credits,
        total_actions: recent?.length ?? 0,
        recent: recent ?? [],
      },
    });
  } catch (error) {
    console.error("Usage endpoint failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}
