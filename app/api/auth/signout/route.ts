import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/utils";

export async function POST() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return jsonError(error.message, 400, "SIGNOUT_FAILED");
    return Response.json({ data: { signed_out: true } });
  } catch (error) {
    console.error("Signout failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}