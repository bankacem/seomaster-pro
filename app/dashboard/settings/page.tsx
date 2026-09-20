"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  User as UserIcon,
  CreditCard,
  Zap,
  CheckCircle2,
  Loader2,
  ArrowUpRight,
  Shield,
  Mail,
  Calendar,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/shared/use-auth";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { PLAN_CONFIG } from "@/lib/stripe/plans";

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile?.full_name]);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/user/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update profile");
      }
      await refreshProfile();
      toast("success", "Profile updated", "Your name has been saved.");
    } catch (err) {
      toast("error", "Update failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function startCheckout(plan: "pro" | "enterprise") {
    setLoadingCheckout(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to start checkout");
      }
      const { data } = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast("error", "Checkout failed", err instanceof Error ? err.message : "Unknown error");
      setLoadingCheckout(false);
    }
  }

  async function openPortal() {
    setLoadingPortal(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to open billing portal");
      }
      const { data } = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast("error", "Failed", err instanceof Error ? err.message : "Unknown error");
      setLoadingPortal(false);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">Manage your account, billing, and usage.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><UserIcon className="h-4 w-4" /> Profile</TabsTrigger>
          <TabsTrigger value="billing"><CreditCard className="h-4 w-4" /> Billing</TabsTrigger>
          <TabsTrigger value="usage"><TrendingUp className="h-4 w-4" /> Usage</TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account information</CardTitle>
              <CardDescription>Update your personal details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.full_name ?? "User"} />
                  <AvatarFallback name={profile?.full_name || user.email} />
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-ink-900">{profile?.full_name || "User"}</p>
                  <p className="text-xs text-ink-500">{user.email}</p>
                  <Badge variant="outline" className="mt-1 capitalize">{profile?.plan ?? "free"} plan</Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email ?? ""} disabled />
                <p className="text-xs text-ink-500">Email cannot be changed here.</p>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Save changes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Account security information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 rounded-md bg-ink-50 p-3">
                <Shield className="mt-0.5 h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-ink-900">Password-protected account</p>
                  <p className="text-xs text-ink-500">Your account is secured with a password via Supabase Auth.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md bg-ink-50 p-3">
                <Mail className="mt-0.5 h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-ink-900">Email verification</p>
                  <p className="text-xs text-ink-500">
                    {user.email_confirmed_at ? "Verified" : "Pending verification"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md bg-ink-50 p-3">
                <Calendar className="mt-0.5 h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-ink-900">Member since</p>
                  <p className="text-xs text-ink-500">{formatDate(profile?.created_at ?? user.created_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Current plan</CardTitle>
              <CardDescription>You are currently on the {profile?.plan ?? "free"} plan.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border border-ink-100 bg-gradient-to-br from-brand-50 to-white p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold capitalize text-ink-900">{profile?.plan ?? "free"}</h3>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-600">
                    {profile?.credits ?? 0} credits remaining
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-ink-900">
                    {profile?.plan === "free" ? "$0" : profile?.plan === "pro" ? "$49" : "Custom"}
                  </p>
                  <p className="text-xs text-ink-500">/month</p>
                </div>
              </div>

              {profile?.stripe_customer_id && (
                <Button onClick={openPortal} variant="outline" className="mt-4" disabled={loadingPortal}>
                  {loadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Manage subscription
                </Button>
              )}
            </CardContent>
          </Card>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-ink-900">Available plans</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {(["free", "pro", "enterprise"] as const).map((plan) => {
                const config = PLAN_CONFIG[plan];
                const isCurrent = (profile?.plan ?? "free") === plan;
                return (
                  <Card
                    key={plan}
                    className={
                      plan === "pro"
                        ? "relative border-2 border-brand-500"
                        : "relative"
                    }
                  >
                    {plan === "pro" && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge variant="success">Popular</Badge>
                      </div>
                    )}
                    <CardContent className="p-5">
                      <h4 className="text-sm font-semibold capitalize text-ink-900">{config.name}</h4>
                      <p className="mt-1 text-2xl font-bold text-ink-900">
                        {plan === "free" ? "$0" : plan === "pro" ? "$49" : "Custom"}
                        <span className="text-xs font-normal text-ink-500">/mo</span>
                      </p>
                      <p className="mt-1 text-xs text-ink-500">{config.credits} credits/month</p>

                      <ul className="mt-4 space-y-1.5 text-xs">
                        {plan === "free" && (
                          <>
                            <li>✓ 5 credits / month</li>
                            <li>✓ 1 site audit at a time</li>
                            <li>✓ Basic keyword ideas</li>
                          </>
                        )}
                        {plan === "pro" && (
                          <>
                            <li>✓ 100 credits / month</li>
                            <li>✓ Up to 50 pages per audit</li>
                            <li>✓ Keyword research & tracking</li>
                            <li>✓ Backlink analysis</li>
                            <li>✓ Email support</li>
                          </>
                        )}
                        {plan === "enterprise" && (
                          <>
                            <li>✓ 1,000+ credits / month</li>
                            <li>✓ Unlimited projects</li>
                            <li>✓ API access</li>
                            <li>✓ Dedicated manager</li>
                          </>
                        )}
                      </ul>

                      <div className="mt-5">
                        {isCurrent ? (
                          <Button variant="secondary" className="w-full" disabled>
                            Current plan
                          </Button>
                        ) : plan === "free" ? (
                          <Button variant="outline" className="w-full" disabled>
                            Downgrade at renewal
                          </Button>
                        ) : (
                          <Button
                            variant={plan === "pro" ? "gradient" : "default"}
                            className="w-full"
                            onClick={() => startCheckout(plan)}
                            disabled={loadingCheckout}
                          >
                            {loadingCheckout ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                            Upgrade to {config.name}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Billing history & management</CardTitle>
              <CardDescription>Powered by Stripe — your payment details are secure.</CardDescription>
            </CardHeader>
            <CardContent>
              {profile?.stripe_customer_id ? (
                <div className="space-y-3">
                  <p className="text-sm text-ink-600">
                    You can manage your subscription, update payment methods, view invoices, and cancel anytime through the secure Stripe portal.
                  </p>
                  <Button onClick={openPortal} variant="outline" disabled={loadingPortal}>
                    {loadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    Open Stripe billing portal
                  </Button>
                </div>
              ) : (
                <div className="rounded-md bg-ink-50 p-4 text-sm text-ink-600">
                  <p>No active subscription. Upgrade to a paid plan to access billing management.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage */}
        <TabsContent value="usage" className="space-y-6">
          <UsageStats />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UsageStats() {
  const [usage, setUsage] = useState<{
    total_actions?: number;
    recent?: Array<{ action: string; created_at: string; metadata?: Record<string, unknown> }>;
  }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/user/usage", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (active) setUsage(json.data ?? {});
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="skeleton h-32 rounded-md" />
        </CardContent>
      </Card>
    );
  }

  const actions = usage.recent ?? [];
  const counts: Record<string, number> = {};
  for (const a of actions) counts[a.action] = (counts[a.action] || 0) + 1;

  const actionLabels: Record<string, string> = {
    article_analysis: "Article analyses",
    site_audit: "Site audits",
    keyword_research: "Keyword researches",
    backlink_analysis: "Backlink analyses",
    competitor_analysis: "Competitor analyses",
    position_tracking: "Position tracking",
    onpage_check: "On-page checks",
    domain_overview: "Domain overviews",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Credit usage</CardTitle>
          <CardDescription>Total actions performed with your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Total actions" value={usage.total_actions ?? actions.length} />
            <Stat label="Last 30 days" value={actions.length} />
            <Stat label="This week" value={actions.filter((a) => Date.now() - new Date(a.created_at).getTime() < 7 * 86400000).length} />
            <Stat label="Today" value={actions.filter((a) => Date.now() - new Date(a.created_at).getTime() < 86400000).length} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Your latest 20 actions across the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <TrendingUp className="h-10 w-10 text-ink-300" />
              <p className="mt-2 text-sm text-ink-500">No activity yet. Start using the tools to see your usage here.</p>
              <Button asChild size="sm" className="mt-4">
                <Link href="/dashboard">
                  Go to dashboard
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {actions.slice(0, 20).map((a, i) => (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{actionLabels[a.action] ?? a.action}</p>
                    <p className="text-xs text-ink-500">{formatDate(a.created_at)}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">-1 credit</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {Object.keys(counts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Breakdown</CardTitle>
            <CardDescription>Actions by type.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(counts).map(([action, count]) => (
                <div key={action} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">{actionLabels[action] ?? action}</span>
                  <span className="font-mono font-semibold text-ink-900">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-ink-50/50 p-3 text-center">
      <div className="text-2xl font-bold text-ink-900">{value}</div>
      <div className="mt-1 text-xs text-ink-500">{label}</div>
    </div>
  );
}
