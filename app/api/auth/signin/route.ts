import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/utils";

const signinSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const parsed = signinSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Invalid signin payload", 400, "VALIDATION_ERROR");

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return jsonError(error.message, 401, "SIGNIN_FAILED");
    return Response.json({ data: { user: data.user, session: data.session } });
  } catch (error) {
    console.error("Signin failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}