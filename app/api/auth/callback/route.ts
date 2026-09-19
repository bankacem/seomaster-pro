import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl, jsonError } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    if (!code) return jsonError("Missing OAuth callback code", 400, "MISSING_CODE");

    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return jsonError(error.message, 400, "OAUTH_CALLBACK_FAILED");
    return NextResponse.redirect(new URL("/api/user/me", getAppUrl()));
  } catch (error) {
    console.error("Auth callback failed:", error);
    return jsonError("Authentication service is not configured", 500, "AUTH_CONFIG_ERROR");
  }
}