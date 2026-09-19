import { getAuthenticatedUser } from "@/lib/auth";
import { jsonError } from "@/lib/utils";

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (error) {
      console.error("Profile lookup failed:", error.message);
      return jsonError("Profile not found", 404, "PROFILE_NOT_FOUND");
    }
    return Response.json({ data: { user, profile } });
  } catch (error) {
    console.error("Current user lookup failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}