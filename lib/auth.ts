import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the currently authenticated user (or null).
 *
 * Note: when there's no session, Supabase returns an error like
 * "Auth session missing!" — this is normal and not a server error.
 * We treat it as `user: null` and only log genuine lookup failures.
 */
export async function getAuthenticatedUser(): Promise<{ user: User | null; supabase: Awaited<ReturnType<typeof createClient>> }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    // "Auth session missing" is the expected case for unauthenticated requests
    // — don't log it as an error.
    if (!error.message.includes("session missing") && !error.message.includes("invalid")) {
      console.error("Supabase auth lookup failed:", error.message);
    }
    return { user: null, supabase };
  }
  return { user: data.user, supabase };
}
