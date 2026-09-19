import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("Supabase auth callback failed", error);
      return NextResponse.redirect(new URL("/login?error=auth_callback", url.origin));
    }

    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    return NextResponse.redirect(new URL(safeNext, url.origin));
  } catch (error) {
    console.error("Supabase auth callback error", error);
    return NextResponse.redirect(new URL("/login?error=auth_callback", url.origin));
  }
}
