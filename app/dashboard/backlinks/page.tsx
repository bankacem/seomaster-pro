"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link2,
  Globe,
  AlertTriangle,
  Search,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  History,
  RefreshCw,
  Clock,
  ExternalLink,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/spinner";
import { ScoreGauge } from "@/components/shared/score-gauge";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate, formatNumber, getDomain, scoreColor, truncate } from "@/lib/utils";

/* ----------------------------- Types & helpers ---------------------------- */

interface TopBacklink {
  source_domain: string;
  authority: number;
  anchor_text: string;
  link_type: "dofollow" | "nofollow";
  first_seen: string;
}

interface BacklinkProfile {
  domain: string;
  total_backlinks: number;
  referring_domains: number;
  domain_authority: number;
  top_backlinks: TopBacklink[];
  toxic_backlinks: number;
  lost_last_30d: number;
  gained_last_30d: number;
}

interface BacklinkReport {
  id: string;
  domain: string;
  results: BacklinkProfile;
  created_at: string;
}

function normalizeDomainInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.includes("://") ? trimmed : `https://${trimmed}`;
}

function authorityIndicatorColor(score: number) {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

/* --------------------------------- Page ---------------------------------- */

export default function BacklinksPage() {
  const { toast } = useToast();

  const [domain, setDomain] = useState("");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<BacklinkReport | null>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  const [reports, setReports] = useState<BacklinkReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState("top");

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/backlinks", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load backlink reports");
      const list: BacklinkReport[] = json.data || [];
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
      const res = await fetch("/api/backlinks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: normalized }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Backlink analysis failed");
      // POST returns { data: { report: <record>, credits_left } }
      const report: BacklinkReport = json.data?.report;
      if (!report) throw new Error("Malformed response from server");
      if (json.data?.credits_left !== undefined) setCreditsLeft(json.data.credits_left);
      setCurrent(report);
      toast(
        "success",
        "Analysis complete",
        `${formatNumber(report.results.total_backlinks)} backlinks for ${report.domain}`
      );
      // Refresh history so the new report shows up in the History tab.
      const fresh = await loadHistory();
      const match = fresh.find((r) => r.id === report.id);
      if (match) setCurrent(match);
      setActiveTab("top");
    } catch (err) {
      toast("error", "Analysis failed", err instanceof Error ? err.message : "Try again later");
    } finally {
      setRunning(false);
    }
  };

  const selectReport = (report: BacklinkReport) => {
    setCurrent(report);
    setDomain(report.domain);
    setActiveTab("top");
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
            <Link2 className="h-3.5 w-3.5" />
            Link profile insights
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Backlink Analysis</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              Audit any domain&apos;s backlink profile — total links, referring domains, authority, top backlinks
              and 30-day activity — powered by AI-generated estimates.
            </p>
          </div>
        </div>
      </section>

      {/* Search form */}
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
                    <Search className="h-4 w-4" />
                    Analyze
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {running && <BacklinksSkeleton />}

      {/* Results */}
      {!running && current && (
        <BacklinkResults
          report={current}
          activeTab={activeTab}
          onTabChange={setActiveTab}
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
              icon={<Link2 className="h-6 w-6 text-brand-500" />}
              title="No backlink reports yet"
              description="Enter a domain above to generate your first AI-estimated backlink profile."
              action={
                <Button variant="gradient" onClick={() => analyze("example.com")} disabled={running}>
                  <Link2 className="h-4 w-4" />
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

function BacklinkResults({
  report,
  activeTab,
  onTabChange,
  creditsLeft,
  reports,
  loadingHistory,
  onRefreshHistory,
  onSelectReport,
}: {
  report: BacklinkReport;
  activeTab: string;
  onTabChange: (tab: string) => void;
  creditsLeft: number | null;
  reports: BacklinkReport[];
  loadingHistory: boolean;
  onRefreshHistory: () => void;
  onSelectReport: (report: BacklinkReport) => void;
}) {
  const profile = report.results;
  const totalGainedLost = profile.gained_last_30d + profile.lost_last_30d;
  const gainRate = totalGainedLost > 0 ? Math.round((profile.gained_last_30d / totalGainedLost) * 100) : 50;

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
              <Link2 className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink-900">{profile.domain}</p>
              <p className="flex items-center gap-1.5 text-xs text-ink-500">
                <Clock className="h-3 w-3" />
                Analyzed {formatDate(report.created_at)}
                {creditsLeft !== null && <span> · {creditsLeft} credits left</span>}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Backlinks"
          value={formatNumber(profile.total_backlinks)}
          icon={Link2}
          accent="from-emerald-500 to-teal-600"
        />
        <KpiCard
          label="Referring Domains"
          value={formatNumber(profile.referring_domains)}
          icon={Globe}
          accent="from-blue-500 to-cyan-600"
        />
        <Card className="card-hover overflow-hidden">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Domain Authority</p>
              <p
                className="mt-1 text-xs font-medium"
                style={{ color: scoreColor(profile.domain_authority) }}
              >
                {profile.domain_authority >= 60 ? "Strong" : profile.domain_authority >= 30 ? "Average" : "Low"}
              </p>
            </div>
            <ScoreGauge score={profile.domain_authority} size="sm" label="DA" />
          </CardContent>
        </Card>
        <KpiCard
          label="Toxic Backlinks"
          value={formatNumber(profile.toxic_backlinks)}
          icon={AlertTriangle}
          accent="from-red-500 to-rose-600"
        />
      </div>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Backlink details</CardTitle>
          <CardDescription>
            Top backlinks, recent activity and full history for {profile.domain}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="top">
                <Link2 className="h-3.5 w-3.5" />
                Top Backlinks
              </TabsTrigger>
              <TabsTrigger value="activity">
                <TrendingUp className="h-3.5 w-3.5" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-3.5 w-3.5" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="top" className="mt-4">
              <TopBacklinksTable rows={profile.top_backlinks} />
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <ActivityCard
                  label="Gained (30d)"
                  value={profile.gained_last_30d}
                  icon={ArrowUpRight}
                  tone="positive"
                  description="New referring domains / links detected in the last 30 days."
                />
                <ActivityCard
                  label="Lost (30d)"
                  value={profile.lost_last_30d}
                  icon={ArrowDownRight}
                  tone="negative"
                  description="Backlinks removed, broken or deindexed in the last 30 days."
                />
              </div>

              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">30-day link velocity</CardTitle>
                  <CardDescription className="text-xs">
                    {gainRate}% gained vs {100 - gainRate}% lost.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${gainRate}%` }}
                    />
                    <div
                      className="h-full bg-red-400 transition-all"
                      style={{ width: `${100 - gainRate}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-ink-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      +{formatNumber(profile.gained_last_30d)} gained
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-400" />
                      −{formatNumber(profile.lost_last_30d)} lost
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <ReportsList
                reports={reports}
                loading={loadingHistory}
                onRefresh={onRefreshHistory}
                onSelect={onSelectReport}
                embedded
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------ Sub components ----------------------------- */

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <Card className="card-hover overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-ink-900">{value}</p>
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

function TopBacklinksTable({ rows }: { rows: readonly TopBacklink[] }) {
  const ordered = useMemo(
    () => [...rows].sort((a, b) => b.authority - a.authority),
    [rows]
  );

  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        icon={<Link2 className="h-6 w-6" />}
        title="No top backlinks"
        description="No referring domains were returned for this profile."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-ink-100">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
            <th className="px-4 py-3 text-left font-medium">Source Domain</th>
            <th className="px-4 py-3 text-left font-medium">Authority</th>
            <th className="px-4 py-3 text-left font-medium">Anchor Text</th>
            <th className="px-4 py-3 text-left font-medium">Link Type</th>
            <th className="px-4 py-3 text-left font-medium">First Seen</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((row, idx) => (
            <tr
              key={`${row.source_domain}-${idx}`}
              className="border-b border-ink-50 transition-colors last:border-0 hover:bg-brand-50/30"
            >
              <td className="px-4 py-3">
                <a
                  href={`https://${row.source_domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 font-medium text-ink-900 hover:text-brand-700"
                >
                  <span className="truncate">
                    {getDomain(row.source_domain) || row.source_domain}
                  </span>
                  <ExternalLink className="h-3 w-3 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Progress
                    value={row.authority}
                    indicatorClassName={authorityIndicatorColor(row.authority)}
                    className="h-1.5 w-16 bg-ink-100"
                  />
                  <span className="tabular-nums text-xs font-medium text-ink-700">
                    {row.authority}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-ink-700" title={row.anchor_text}>
                  {truncate(row.anchor_text || "—", 40)}
                </span>
              </td>
              <td className="px-4 py-3">
                <Badge variant={row.link_type === "dofollow" ? "success" : "secondary"}>
                  {row.link_type}
                </Badge>
              </td>
              <td className="px-4 py-3 text-xs text-ink-500">{formatDate(row.first_seen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityCard({
  label,
  value,
  icon: Icon,
  tone,
  description,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: "positive" | "negative";
  description: string;
}) {
  const positive = tone === "positive";
  return (
    <Card
      className={cn(
        "card-hover overflow-hidden border-l-4",
        positive ? "border-l-emerald-500" : "border-l-red-500"
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
            <p
              className={cn(
                "mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight",
                positive ? "text-emerald-600" : "text-red-600"
              )}
            >
              <Icon className="h-6 w-6" />
              {positive ? "+" : "−"}
              {formatNumber(value)}
            </p>
            <p className="mt-1 text-xs text-ink-500">{description}</p>
          </div>
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              positive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportsList({
  reports,
  loading,
  onRefresh,
  onSelect,
  embedded = false,
}: {
  reports: BacklinkReport[];
  loading: boolean;
  onRefresh: () => void;
  onSelect: (report: BacklinkReport) => void;
  embedded?: boolean;
}) {
  return (
    <div className={embedded ? "" : "contents"}>
      <Card className={embedded ? "border-0 shadow-none" : ""}>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-ink-400" />
              {embedded ? "Past reports" : "Recent reports"}
            </CardTitle>
            <CardDescription>
              {embedded
                ? "Click any report to view its full profile."
                : "Your recent backlink analyses."}
            </CardDescription>
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
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<Link2 className="h-6 w-6" />}
                title="No reports yet"
                description="Your backlink analyses will appear here."
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
                      <Link2 className="h-4 w-4" />
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
                        DA {report.results.domain_authority}
                      </Badge>
                      <Badge variant="outline" className="px-2 py-0 text-[10px]">
                        {formatNumber(report.results.total_backlinks)} links
                      </Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BacklinksSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-3 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
