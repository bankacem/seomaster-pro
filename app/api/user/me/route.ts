import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { jsonError } from "@/lib/utils";

const updateSchema = z.object({
  full_name: z.string().trim().min(1).max(100).optional(),
  avatar_url: z.string().url().optional(),
});

export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) return jsonError("Authentication required", 401, "UNAUTHORIZED");

    const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (error) {
      console.warn("Profile lookup failed, returning user-only info:", error.message);
      return Response.json({
        data: {
          user,
          profile: {
            id: user.id,
            email: user.email,
            full_name: (user.user_metadata as { full_name?: string } | null)?.full_name ?? null,
            avatar_url: (user.user_metadata as { avatar_url?: string } | null)?.avatar_url ?? null,
            plan: "free",
            credits: 0,
          },
        },
      });
    }
    const safeProfile = {
      ...profile,
      plan: (profile as { plan?: string }).plan ?? "free",
      stripe_customer_id: (profile as { stripe_customer_id?: string }).stripe_customer_id ?? null,
    };
    return Response.json({ data: { user, profile: safeProfile } });
  } catch (error) {
    console.error("Current user lookup failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}

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

    const safeProfile = {
      ...profile,
      plan: (profile as { plan?: string }).plan ?? "free",
      stripe_customer_id: (profile as { stripe_customer_id?: string }).stripe_customer_id ?? null,
    };
    return Response.json({ data: { profile: safeProfile } });
  } catch (error) {
    console.error("Profile update failed:", error);
    return jsonError("Failed to update profile", 500, "UPDATE_FAILED");
  }
}
