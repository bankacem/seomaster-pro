import { getAuthenticatedUser } from "@/lib/auth";
import { jsonError } from "@/lib/utils";

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const [{ data: profile, error: profileError }, { count, error: analysesError }, { data: recent, error: recentError }] = await Promise.all([
      supabase.from("profiles").select("plan, credits").eq("id", user.id).single(),
      supabase.from("analyses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("analyses").select("id, url, score, results, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    ]);

    if (profileError || analysesError || recentError) {
      console.error("Usage lookup failed:", profileError || analysesError || recentError);
      return jsonError("Unable to load usage", 500, "USAGE_LOOKUP_FAILED");
    }

    return Response.json({
      data: {
        plan: profile.plan,
        credits_left: profile.credits,
        total_analyses: count || 0,
        recent_analyses: recent || [],
      },
    });
  } catch (error) {
    console.error("Usage endpoint failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}