"use client";

import { createClient } from "@supabase/supabase-js";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Throw at module load only if env vars are missing AND we are on the client.
// On the server during SSR/build, return a no-op client to avoid crashing.
function makeClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window !== "undefined") {
      // We're in a browser without env — show a clear error to the developer.
      console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    return null;
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: "free" | "pro" | "enterprise";
  credits: number;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
};

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [client] = useState(() => makeClient());

  const refreshProfile = useCallback(async () => {
    if (!client) return;
    try {
      const res = await fetch("/api/user/me", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json?.data?.profile) setProfile(json.data.profile);
    } catch {
      // ignore network errors
    }
  }, [client]);

  useEffect(() => {
    if (!client) {
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      const { data } = await client.auth.getSession();
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await refreshProfile();
      }
      setLoading(false);
    })();

    const { data: sub } = client.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        await refreshProfile();
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [client, refreshProfile]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!client) throw new Error("Auth not configured");
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refreshProfile();
      router.push("/dashboard");
    },
    [client, router, refreshProfile]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, fullName?: string) => {
      if (!client) throw new Error("Auth not configured");
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      // If email confirmation is required, user is null
      if (data.user && !data.session) {
        return { needsEmailConfirmation: true };
      }
      if (data.session) {
        await refreshProfile();
        router.push("/dashboard");
      }
      return { needsEmailConfirmation: false };
    },
    [client, router, refreshProfile]
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    router.push("/");
  }, [client, router]);

  return {
    user,
    session,
    profile,
    loading,
    isConfigured: Boolean(client),
    signInWithEmail,
    signUpWithEmail,
    signOut,
    refreshProfile,
  };
}
