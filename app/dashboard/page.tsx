"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Globe,
  Search,
  TrendingUp,
  Link2,
  FileText,
  Users,
  Zap,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton, PageLoader } from "@/components/ui/spinner";
import { useAuth } from "@/components/shared/use-auth";
import { formatCompact, formatDateShort, getDomain } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: "audit" | "analysis" | "keyword" | "backlink" | "competitor";
  label: string;
  meta: string;
  created_at: string;
  href: string;
}

interface DashboardStats {
  recentAudits: Array<{
    id: string;
    url: string;
    pages_crawled: number;
    created_at: string;
    results?: { summary?: { totalIssues?: number; pagesWithIssues?: number } };
  }>;
  recentAnalyses: Array<{
    id: string;
    url: string | null;
    content: string;
    score: number | null;
    created_at: string;
  }>;
  usage?: {
    total_actions: number;
    credits_used: number;
  };
}

const ACTIVITY_META = {
  audit: { icon: Globe, color: "text-emerald-600 bg-emerald-50" },
  analysis: { icon: FileText, color: "text-blue-600 bg-blue-50" },
  keyword: { icon: Search, color: "text-amber-600 bg-amber-50" },
  backlink: { icon: Link2, color: "text-purple-600 bg-purple-50" },
  competitor: { icon: Users, color: "text-rose-600 bg-rose-50" },
};

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [auditsRes, analysesRes] = await Promise.all([
          fetch("/api/audit", { cache: "no-store" }),
          fetch("/api/analyze", { cache: "no-store" }).catch(() => null),
        ]);
        if (!active) return;
        const audits = auditsRes.ok ? await auditsRes.json() : { data: [] };
        const analyses = analysesRes?.ok ? await analysesRes.json() : { data: [] };
        setData({
          recentAudits: audits.data || [],
          recentAnalyses: analyses.data || [],
        });
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <PageLoader message="Loading dashboard…" />;

  const totalAudits = data?.recentAudits.length ?? 0;
  const totalAnalyses = data?.recentAnalyses.length ?? 0;
  const totalIssues = data?.recentAudits.reduce(
    (sum, a) => sum + (a.results?.summary?.totalIssues ?? 0),
    0
  ) ?? 0;
  const avgScore = (() => {
    const scores = data?.recentAnalyses.filter((a) => a.score !== null).map((a) => a.score as number) ?? [];
    if (!scores.length) return null;
    return Math.round(scores.reduce((s, n) => s + n, 0) / scores.length);
  })();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl gradient-brand p-6 sm:p-8">
        <div className="absolute inset-0 gradient-hero opacity-50" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
              Hi, {profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there"} 👋
            </h1>
            <p className="mt-2 text-sm text-white/80 max-w-lg">
              {totalAudits === 0 && totalAnalyses === 0
                ? "Welcome aboard! Run your first site audit or analyze an article to get started."
                : `You have ${totalAudits} audit${totalAudits === 1 ? "" : "s"} and ${totalAnalyses} content analysis${totalAnalyses === 1 ? "" : "es"} on record.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/audit">
                <Globe className="h-4 w-4" />
                New audit
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-white text-brand-700 hover:bg-white/90">
              <Link href="/dashboard/analyzer">
                <Sparkles className="h-4 w-4" />
                Analyze article
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Site audits"
          value={totalAudits}
          delta={totalAudits > 0 ? `${totalIssues} issues found` : "Run your first audit"}
          icon={Globe}
          accent="from-emerald-500 to-teal-600"
        />
        <KpiCard
          label="Content analyses"
          value={totalAnalyses}
          delta={avgScore !== null ? `Avg score: ${avgScore}/100` : "Analyze your first article"}
          icon={FileText}
          accent="from-blue-500 to-cyan-600"
        />
        <KpiCard
          label="Credits used"
          value={profile ? 5 - profile.credits : 0}
          delta={`of 5 free credits`}
          icon={Zap}
          accent="from-amber-500 to-orange-600"
        />
        <KpiCard
          label="Account plan"
          value={profile?.plan ?? "free"}
          delta={profile?.plan === "free" ? "Upgrade for 100 credits/mo" : "Active subscription"}
          icon={TrendingUp}
          accent="from-purple-500 to-fuchsia-600"
          isString
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent audits */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent site audits</CardTitle>
              <CardDescription>Latest crawls across your projects</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/audit">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {totalAudits === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-ink-200 bg-ink-50/50 py-10 text-center">
                <Globe className="h-10 w-10 text-ink-300" />
                <div>
                  <p className="text-sm font-medium text-ink-900">No audits yet</p>
                  <p className="text-xs text-ink-500">Run your first site audit to see results here.</p>
                </div>
                <Button asChild size="sm">
                  <Link href="/dashboard/audit">
                    <Globe className="h-4 w-4" />
                    Start audit
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-ink-100">
                {data?.recentAudits.slice(0, 5).map((audit) => {
                  const domain = getDomain(audit.url);
                  const issues = audit.results?.summary?.totalIssues ?? 0;
                  const pages = audit.pages_crawled;
                  const pagesWithIssues = audit.results?.summary?.pagesWithIssues ?? 0;
                  const healthScore = pages > 0 ? Math.max(0, Math.round(100 - (issues / (pages * 2)) * 100)) : 0;
                  return (
                    <Link
                      key={audit.id}
                      href={`/dashboard/audit?id=${audit.id}`}
                      className="flex items-center gap-4 py-3 transition-colors hover:bg-ink-50 -mx-2 px-2 rounded-md"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Globe className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-ink-900">{domain}</p>
                        <p className="text-xs text-ink-500">
                          {pages} pages · {issues} issues · {formatDateShort(audit.created_at)}
                        </p>
                      </div>
                      <div className="hidden sm:flex flex-col items-end gap-1">
                        <span className="text-xs text-ink-500">Health</span>
                        <span className={`text-sm font-semibold ${
                          healthScore >= 80 ? "text-emerald-600" : healthScore >= 60 ? "text-amber-600" : "text-red-600"
                        }`}>
                          {healthScore}
                        </span>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-ink-400" />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Jump into a tool</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { href: "/dashboard/audit", label: "Run site audit", icon: Globe, color: "text-emerald-600 bg-emerald-50" },
              { href: "/dashboard/keywords", label: "Research keywords", icon: Search, color: "text-amber-600 bg-amber-50" },
              { href: "/dashboard/backlinks", label: "Analyze backlinks", icon: Link2, color: "text-purple-600 bg-purple-50" },
              { href: "/dashboard/competitors", label: "Compare competitors", icon: Users, color: "text-rose-600 bg-rose-50" },
              { href: "/dashboard/positions", label: "Track rankings", icon: TrendingUp, color: "text-blue-600 bg-blue-50" },
              { href: "/dashboard/analyzer", label: "Analyze content", icon: FileText, color: "text-indigo-600 bg-indigo-50" },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-ink-50"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-md ${action.color}`}>
                  <action.icon className="h-4 w-4" />
                </div>
                <span className="flex-1 text-sm font-medium text-ink-900">{action.label}</span>
                <ArrowUpRight className="h-4 w-4 text-ink-300 transition-colors group-hover:text-ink-600" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent analyses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent content analyses</CardTitle>
            <CardDescription>AI-powered article scores and recommendations</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/analyzer">
              New analysis <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {totalAnalyses === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-ink-200 bg-ink-50/50 py-10 text-center">
              <FileText className="h-10 w-10 text-ink-300" />
              <div>
                <p className="text-sm font-medium text-ink-900">No analyses yet</p>
                <p className="text-xs text-ink-500">Paste an article to get an instant SEO score.</p>
              </div>
              <Button asChild size="sm">
                <Link href="/dashboard/analyzer">
                  <Sparkles className="h-4 w-4" />
                  Analyze article
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data?.recentAnalyses.slice(0, 4).map((a) => (
                <Link
                  key={a.id}
                  href="/dashboard/analyzer"
                  className="rounded-lg border border-ink-100 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {a.url ? getDomain(a.url) : "Pasted content"}
                    </p>
                    {a.score !== null && (
                      <Badge variant={a.score >= 80 ? "success" : a.score >= 60 ? "warning" : "destructive"}>
                        {a.score}/100
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-ink-500">
                    {a.content.slice(0, 140)}…
                  </p>
                  <p className="mt-2 text-[10px] text-ink-400">{formatDateShort(a.created_at)}</p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  accent,
  isString = false,
}: {
  label: string;
  value: number | string;
  delta: string;
  icon: React.ElementType;
  accent: string;
  isString?: boolean;
}) {
  return (
    <Card className="card-hover overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
              {isString ? value : formatCompact(value as number)}
            </p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${accent} text-white shadow-sm`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-500">{delta}</p>
      </CardContent>
    </Card>
  );
}
