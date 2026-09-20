"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Globe,
  Sparkles,
  TrendingUp,
  Search,
  Link2,
  ExternalLink,
  History,
  RefreshCw,
  Clock,
  Award,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/spinner";
import { ScoreGauge } from "@/components/shared/score-gauge";
import { useToast } from "@/components/ui/toast";
import {
  cn,
  formatDate,
  formatNumber,
  formatCompact,
  truncate,
  getDomain,
  scoreColor,
} from "@/lib/utils";

/* ----------------------------- Types & helpers ---------------------------- */

interface TopKeyword {
  keyword: string;
  position: number;
  volume: number;
}

interface TopPage {
  url: string;
  traffic_estimate: number;
}

interface DomainOverview {
  domain: string;
  estimated_organic_traffic: number;
  estimated_keywords_count: number;
  estimated_backlinks_count: number;
  domain_authority: number;
  top_keywords: TopKeyword[];
  top_pages: TopPage[];
  summary: string;
}

interface DomainReport {
  id: string;
  domain: string;
  results: DomainOverview;
  created_at: string;
}

function normalizeDomainInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.includes("://") ? trimmed : `https://${trimmed}`;
}

function positionBadgeVariant(position: number): "default" | "success" | "warning" | "destructive" | "secondary" {
  if (position <= 3) return "default"; // gold-ish via default brand color
  if (position <= 10) return "success";
  if (position <= 30) return "warning";
  return "destructive";
}

/* --------------------------------- Page ---------------------------------- */

export default function DomainPage() {
  const { toast } = useToast();

  const [domain, setDomain] = useState("");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<DomainReport | null>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  const [reports, setReports] = useState<DomainReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/domain", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load domain reports");
      const list: DomainReport[] = json.data || [];
      setReports(list);
      return list;
    } catch (err) {
      toast("error", "Could not load history", err instanceof Error ? err.message : "Try again later");
      setReports([]);
      return [];
    } finally {
      setLoadingHistory(false);
    }
  }, [toast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const analyze = async (overrideDomain?: string) => {
    const raw = (overrideDomain ?? domain).trim();
    if (!raw) {
      toast("warning", "Enter a domain", "Provide a domain or URL to analyze.");
      return;
    }
    const normalized = normalizeDomainInput(raw);
    setRunning(true);
    setCurrent(null);
    try {
      const res = await fetch("/api/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: normalized }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Domain overview failed");
      // POST returns { data: { report: <record>, credits_left } }.
      const report: DomainReport | undefined = json.data?.report;
      if (!report) throw new Error("Malformed response from server");
      if (json.data?.credits_left !== undefined) setCreditsLeft(json.data.credits_left);
      setCurrent(report);
      toast(
        "success",
        "Analysis complete",
        `${formatCompact(report.results.estimated_organic_traffic)} est. visits/mo for ${report.domain}`
      );
      // Refresh history so the new run shows up in the History list.
      const fresh = await loadHistory();
      const match = fresh.find((r) => r.id === report.id);
      if (match) setCurrent(match);
    } catch (err) {
      toast("error", "Analysis failed", err instanceof Error ? err.message : "Try again later");
    } finally {
      setRunning(false);
    }
  };

  const selectReport = (report: DomainReport) => {
    setCurrent(report);
    setDomain(report.domain);
    toast("info", "Loaded report", `${report.domain} · ${formatDate(report.created_at)}`);
  };

  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !running) analyze();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl gradient-brand p-6 sm:p-8">
        <div className="absolute inset-0 gradient-hero opacity-60" />
        <div className="relative flex flex-col gap-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            <Globe className="h-3.5 w-3.5" />
            AI-powered
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Domain Overview</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              Quick snapshot of any domain&apos;s SEO presence — estimated organic traffic, keywords,
              backlinks, authority, top pages and an AI-written summary.
            </p>
          </div>
        </div>
      </section>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-brand-600" />
            Analyze a domain
          </CardTitle>
          <CardDescription>
            Enter a domain (e.g. example.com) or full URL. Each analysis costs 1 credit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Label htmlFor="domain" className="text-xs font-medium text-ink-600">
              Domain
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  id="domain"
                  type="text"
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  onKeyDown={submitOnEnter}
                  disabled={running}
                  className="pl-9"
                />
              </div>
              <Button
                onClick={() => analyze()}
                disabled={running}
                variant="gradient"
                size="lg"
                className="shrink-0"
              >
                {running ? (
                  <>
                    <Spinner size="sm" className="border-white/40 border-t-white" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4" />
                    Analyze domain
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading skeleton */}
      {running && <DomainSkeleton />}

      {/* Results */}
      {!running && current && (
        <DomainResults
          report={current}
          creditsLeft={creditsLeft}
          reports={reports}
          loadingHistory={loadingHistory}
          onRefreshHistory={loadHistory}
          onSelectReport={selectReport}
        />
      )}

      {/* Empty state — no reports at all */}
      {!running && !current && reports.length === 0 && !loadingHistory && (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Globe className="h-6 w-6 text-brand-500" />}
              title="Analyze your first domain"
              description="Enter a domain above to get an AI-estimated snapshot of its SEO presence — traffic, keywords, backlinks and more."
              action={
                <Button
                  variant="gradient"
                  onClick={() => {
                    const demoDomain = "example.com";
                    setDomain(demoDomain);
                    analyze(demoDomain);
                  }}
                  disabled={running}
                >
                  <Globe className="h-4 w-4" />
                  Try with example.com
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* History list — visible when no current report but reports exist */}
      {!running && !current && reports.length > 0 && (
        <ReportsList
          reports={reports}
          loading={loadingHistory}
          onRefresh={loadHistory}
          onSelect={selectReport}
        />
      )}
    </div>
  );
}

/* ----------------------------- Results section ---------------------------- */

function DomainResults({
  report,
  creditsLeft,
  reports,
  loadingHistory,
  onRefreshHistory,
  onSelectReport,
}: {
  report: DomainReport;
  creditsLeft: number | null;
  reports: DomainReport[];
  loadingHistory: boolean;
  onRefreshHistory: () => void;
  onSelectReport: (report: DomainReport) => void;
}) {
  const overview = report.results;

  const maxTraffic = useMemo(
    () =>
      overview.top_pages.length > 0
        ? Math.max(...overview.top_pages.map((p) => p.traffic_estimate), 1)
        : 1,
    [overview.top_pages]
  );

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-emerald-700 text-white shadow-sm">
              <Globe className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink-900">{overview.domain}</p>
              <p className="flex items-center gap-1.5 text-xs text-ink-500">
                <Clock className="h-3 w-3" />
                Analyzed {formatDate(report.created_at)}
                {creditsLeft !== null && <span> · {creditsLeft} credits left</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="px-2.5">
              <TrendingUp className="h-3 w-3" />
              {formatCompact(overview.estimated_organic_traffic)} visits/mo
            </Badge>
            <Badge variant="outline" className="px-2.5">
              <Award className="h-3 w-3" />
              DA {overview.domain_authority}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Est. Organic Traffic"
          value={formatCompact(overview.estimated_organic_traffic)}
          sub="visits / month"
          icon={TrendingUp}
          accent="from-emerald-500 to-teal-600"
        />
        <KpiCard
          label="Keywords Count"
          value={formatNumber(overview.estimated_keywords_count)}
          sub="ranking keywords"
          icon={Search}
          accent="from-blue-500 to-cyan-600"
        />
        <KpiCard
          label="Backlinks Count"
          value={formatNumber(overview.estimated_backlinks_count)}
          sub="total backlinks"
          icon={Link2}
          accent="from-purple-500 to-fuchsia-600"
        />
        <Card className="card-hover overflow-hidden">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Domain Authority</p>
              <p
                className="mt-1 text-xs font-medium"
                style={{ color: scoreColor(overview.domain_authority) }}
              >
                {overview.domain_authority >= 60 ? "Strong" : overview.domain_authority >= 30 ? "Average" : "Low"}
              </p>
              <p className="mt-1 text-xs text-ink-500">on a 0–100 scale</p>
            </div>
            <ScoreGauge score={overview.domain_authority} size="sm" label="DA" />
          </CardContent>
        </Card>
      </div>

      {/* Top Keywords + Top Pages */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-brand-600" />
              Top Keywords
            </CardTitle>
            <CardDescription>
              {overview.top_keywords.length} of the highest-impact ranking keywords for {overview.domain}.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <TopKeywordsTable rows={overview.top_keywords.slice(0, 10)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-brand-600" />
              Top Pages
            </CardTitle>
            <CardDescription>
              Pages on {overview.domain} that drive the most estimated organic traffic.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <TopPagesTable rows={overview.top_pages} maxTraffic={maxTraffic} domain={overview.domain} />
          </CardContent>
        </Card>
      </div>

      {/* AI summary */}
      <Card className="border-l-4 border-l-brand-500">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-brand-600" />
            AI Summary
          </CardTitle>
          <CardDescription>
            AI-generated overview of {overview.domain}&apos;s search presence. Estimates only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-ink-700">{overview.summary}</p>
        </CardContent>
      </Card>

      {/* History */}
      <ReportsList
        reports={reports}
        loading={loadingHistory}
        onRefresh={onRefreshHistory}
        onSelect={onSelectReport}
      />
    </div>
  );
}

/* ------------------------------ Sub components ----------------------------- */

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <Card className="card-hover overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-ink-900">{value}</p>
            <p className="mt-1 text-xs text-ink-500">{sub}</p>
          </div>
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
              accent
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TopKeywordsTable({ rows }: { rows: TopKeyword[] }) {
  if (rows.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="No top keywords"
          description="No keyword data was returned for this domain."
        />
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
            <th className="px-4 py-3 text-left font-medium">Keyword</th>
            <th className="px-4 py-3 text-left font-medium">Position</th>
            <th className="px-4 py-3 text-right font-medium">Volume</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={`${row.keyword}-${idx}`}
              className="border-b border-ink-50 transition-colors last:border-0 hover:bg-brand-50/30"
            >
              <td className="px-4 py-3">
                <span className="font-medium text-ink-900" title={row.keyword}>
                  {truncate(row.keyword, 32)}
                </span>
              </td>
              <td className="px-4 py-3">
                <Badge variant={positionBadgeVariant(row.position)} className="px-2 py-0.5">
                  #{row.position}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-ink-700">
                {formatNumber(row.volume)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopPagesTable({
  rows,
  maxTraffic,
  domain,
}: {
  rows: TopPage[];
  maxTraffic: number;
  domain: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={<TrendingUp className="h-6 w-6" />}
          title="No top pages"
          description="No page-level traffic data was returned for this domain."
        />
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
            <th className="px-4 py-3 text-left font-medium">URL</th>
            <th className="px-4 py-3 text-left font-medium">Traffic Estimate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const ratio = maxTraffic > 0 ? Math.round((row.traffic_estimate / maxTraffic) * 100) : 0;
            return (
              <tr
                key={`${row.url}-${idx}`}
                className="border-b border-ink-50 transition-colors last:border-0 hover:bg-brand-50/30"
              >
                <td className="px-4 py-3">
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-1.5 font-medium text-ink-900 hover:text-brand-700"
                    title={row.url}
                  >
                    <span className="truncate">{truncate(row.url.replace(/^https?:\/\/(www\.)?/u, ""), 40)}</span>
                    <ExternalLink className="h-3 w-3 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100" />
                  </a>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Progress
                      value={ratio}
                      className="h-1.5 w-20 bg-ink-100"
                      indicatorClassName="bg-gradient-to-r from-brand-500 to-emerald-500"
                    />
                    <span className="tabular-nums text-xs font-medium text-ink-700">
                      {formatNumber(row.traffic_estimate)}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReportsList({
  reports,
  loading,
  onRefresh,
  onSelect,
}: {
  reports: DomainReport[];
  loading: boolean;
  onRefresh: () => void;
  onSelect: (report: DomainReport) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-ink-400" />
            Recent reports
          </CardTitle>
          <CardDescription>Your recent domain overview analyses.</CardDescription>
        </div>
        {reports.length > 0 && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Globe className="h-6 w-6" />}
              title="No reports yet"
              description="Your domain analyses will appear here."
            />
          </div>
        ) : (
          <ul className="max-h-[640px] divide-y divide-ink-100 overflow-y-auto">
            {reports.map((report) => (
              <li key={report.id}>
                <button
                  type="button"
                  onClick={() => onSelect(report)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50/70"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{report.domain}</p>
                    <p className="flex items-center gap-1 text-xs text-ink-500">
                      <Clock className="h-3 w-3" />
                      {formatDate(report.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                      {formatCompact(report.results.estimated_organic_traffic)} visits
                    </Badge>
                    <Badge variant="outline" className="px-2 py-0 text-[10px]">
                      DA {report.results.domain_authority}
                    </Badge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DomainSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-7 w-20" />
              <Skeleton className="mt-2 h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-3 w-64" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-3 w-64" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-1.5 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-2 h-3 w-64" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
}
