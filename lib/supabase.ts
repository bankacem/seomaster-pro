import { createBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

function getSupabaseEnvironment(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return { url, anonKey };
}

/** Creates a Supabase client for Client Components. */
export function createBrowserSupabaseClient() {
  const { url, anonKey } = getSupabaseEnvironment();
  return createBrowserClient<Database>(url, anonKey);
}

/** Creates a Supabase client for Server Components and Route Handlers. */
export async function createServerSupabaseClient() {
  const { url, anonKey } = getSupabaseEnvironment();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always mutate cookies. Middleware refreshes the session.
        }
      },
    },
  });
}

/** Creates a Supabase client and response pair for middleware auth refresh. */
export function createMiddlewareSupabaseClient(request: NextRequest): {
  supabase: ReturnType<typeof createServerClient<Database>>;
  response: NextResponse;
} {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseEnvironment();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  return { supabase, response };
}

export const createBrowserClient = createBrowserSupabaseClient;
export const createServerClient = createServerSupabaseClient;
export const createMiddlewareClient = createMiddlewareSupabaseClient;
