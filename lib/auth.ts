import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function getAuthenticatedUser(): Promise<{ user: User | null; supabase: Awaited<ReturnType<typeof createClient>> }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Supabase auth lookup failed:", error.message);
    return { user: null, supabase };
  }
  return { user: data.user, supabase };
}