import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/utils";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().trim().min(1).max(120).optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = signupSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Invalid signup payload", 400, "VALIDATION_ERROR");

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: parsed.data.full_name } },
    });
    if (error) return jsonError(error.message, 400, "SIGNUP_FAILED");
    return Response.json({ data: { user: data.user, session: data.session } }, { status: 201 });
  } catch (error) {
    console.error("Signup failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}