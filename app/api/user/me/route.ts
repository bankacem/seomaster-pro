import { z } from "zod";
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

const updateSchema = z.object({
  full_name: z.string().trim().min(1).max(100).optional(),
  avatar_url: z.string().url().optional(),
});

export async function PATCH(request: Request) {
  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Invalid update payload", 400, "VALIDATION_ERROR");

    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const { data: profile, error } = await supabase
      .from("profiles")
      .update(parsed.data)
      .eq("id", user.id)
      .select("*")
      .single();
    if (error) return jsonError(`Unable to update profile: ${error.message}`, 500, "UPDATE_FAILED");

    return Response.json({ data: { profile } });
  } catch (error) {
    console.error("Profile update failed:", error);
    return jsonError("Failed to update profile", 500, "UPDATE_FAILED");
  }
}
