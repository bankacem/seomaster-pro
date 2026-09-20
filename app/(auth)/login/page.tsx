"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/components/shared/use-auth";
import { useToast } from "@/components/ui/toast";

export default function SignInPage() {
  const { signInWithEmail, isConfigured } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
      toast("success", "Welcome back!", "You're now signed in.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">Sign in</h1>
        <p className="mt-1 text-sm text-ink-500">
          Welcome back. Enter your credentials to access your dashboard.
        </p>
      </div>

      {!isConfigured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Auth not configured</p>
            <p className="mt-1 text-amber-700">
              Set <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your environment variables.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              className="pl-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <a href="#" className="text-xs text-brand-600 hover:text-brand-700">
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" className="w-full" variant="gradient" disabled={submitting || !isConfigured}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <Card className="border-dashed border-ink-200 bg-ink-50/50">
        <CardContent className="p-4 text-center text-sm text-ink-600">
          New to SEOMaster Pro?{" "}
          <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700">
            Create a free account
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
