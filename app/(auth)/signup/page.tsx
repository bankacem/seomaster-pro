"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/components/shared/use-auth";
import { useToast } from "@/components/ui/toast";

export default function SignUpPage() {
  const router = useRouter();
  const { signUpWithEmail, isConfigured } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await signUpWithEmail(email, password, fullName);
      if (result.needsEmailConfirmation) {
        setSuccess(true);
      } else {
        toast("success", "Account created!", "Welcome to SEOMaster Pro.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign up failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-6">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h2 className="mt-3 text-lg font-semibold text-ink-900">Check your email</h2>
            <p className="mt-1 text-sm text-ink-600">
              We&apos;ve sent a confirmation link to <span className="font-medium text-ink-900">{email}</span>.
              Click the link to activate your account, then sign in.
            </p>
            <Button asChild className="mt-6" variant="outline">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">Create your account</h1>
        <p className="mt-1 text-sm text-ink-500">
          Get 5 free credits — no credit card required.
        </p>
      </div>

      {!isConfigured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Auth not configured</p>
            <p className="mt-1 text-amber-700">
              The owner of this deployment must set Supabase environment variables before users can sign up.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name <span className="text-ink-400">(optional)</span></Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Sara Ahmed"
              className="pl-9"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
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
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
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
              Creating account…
            </>
          ) : (
            <>
              Create free account
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        <p className="text-center text-xs text-ink-500">
          By signing up, you agree to our <a href="#" className="underline">Terms</a> and{" "}
          <a href="#" className="underline">Privacy Policy</a>.
        </p>
      </form>

      <Card className="border-dashed border-ink-200 bg-ink-50/50">
        <CardContent className="p-4 text-center text-sm text-ink-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
