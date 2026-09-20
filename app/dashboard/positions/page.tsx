"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  Globe,
  Award,
  ArrowUp,
  ArrowDown,
  Minus,
  Search,
  History,
  RefreshCw,
  Clock,
  ExternalLink,
  Hash,
  ListChecks,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import {
  cn,
  formatDate,
  formatNumber,
  formatCompact,
  truncate,
  getDomain,
} from "@/lib/utils";

/* ----------------------------- Types & helpers ---------------------------- */

interface PositionRow {
  keyword: string;
  position: number;
  url: string;
  previous_position: number;
  change: number;
  search_volume: number;
  difficulty: number;
}

interface PositionsResult {
  domain: string;
  keywords: PositionRow[];
}

interface PositionReport {
  id: string;
  domain: string;
  results: PositionsResult;
  created_at: string;
}

const POSITION_TIERS = [
  { max: 3, color: "#f59e0b", label: "bg-amber-100 text-amber-800 border-amber-200" }, // gold-ish (top 3)
  { max: 10, color: "#10b981", label: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { max: 30, color: "#f59e0b", label: "bg-amber-100 text-amber-800 border-amber-200" },
  { max: 100, color: "#ef4444", label: "bg-red-100 text-red-800 border-red-200" },
];

function tierFor(position: number) {
  return POSITION_TIERS.find((tier) => position <= tier.max) ?? POSITION_TIERS[POSITION_TIERS.length - 1];
}

function barColor(position: number) {
  if (position <= 10) return "#10b981";
  if (position <= 30) return "#f59e0b";
  return "#ef4444";
}

function avgPositionColor(avg: number) {
  if (avg <= 10) return "text-emerald-600";
  if (avg <= 30) return "text-amber-600";
  return "text-red-600";
}

/** Parse the textarea value into a deduplicated list of up to 10 keywords. */
function parseKeywords(raw: string): string[] {
  const parts = raw
    .split(/[\n,]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && part.length <= 120);
  return Array.from(new Set(parts)).slice(0, 10);
}

function normalizeDomainInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.includes("://") ? trimmed : `https://${trimmed}`;
}

/* --------------------------------- Page ---------------------------------- */

export default function PositionsPage() {
  const { toast } = useToast();

  const [domain, setDomain] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<PositionReport | null>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  const [reports, setReports] = useState<PositionReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const parsedKeywords = useMemo(() => parseKeywords(keywordsText), [keywordsText]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/positions", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load position tracking history");
      const list: PositionReport[] = json.data || [];
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

  const track = async (overrideDomain?: string, overrideKeywords?: string[]) => {
    const rawDomain = (overrideDomain ?? domain).trim();
    const kwList = overrideKeywords ?? parsedKeywords;

    if (!rawDomain) {
      toast("warning", "Enter a domain", "Provide the domain you want to track.");
      return;
    }
    if (kwList.length === 0) {
      toast("warning", "Add keywords", "Enter at least one keyword (one per line, or comma-separated).");
      return;
    }

    const normalizedDomain = normalizeDomainInput(rawDomain);
    setRunning(true);
    setCurrent(null);
    try {
      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: normalizedDomain, keywords: kwList }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Position tracking failed");
      // The POST handler returns { data: { tracking: <record>, credits_left } }.
      // We defensively accept `report` as well in case the contract changes.
      const report: PositionReport | undefined = json.data?.report ?? json.data?.tracking;
      if (!report) throw new Error("Malformed response from server");
      if (json.data?.credits_left !== undefined) setCreditsLeft(json.data.credits_left);
      setCurrent(report);
      toast(
        "success",
        "Tracking complete",
        `${report.results.keywords.length} keywords tracked for ${report.domain}`
      );
      // Refresh history so the new run shows up in the History list.
      const fresh = await loadHistory();
      const match = fresh.find((r) => r.id === report.id);
      if (match) setCurrent(match);
    } catch (err) {
      toast("error", "Tracking failed", err instanceof Error ? err.message : "Try again later");
    } finally {
      setRunning(false);
    }
  };

  const selectReport = (report: PositionReport) => {
    setCurrent(report);
    setDomain(report.domain);
    setKeywordsText(report.results.keywords.map((k) => k.keyword).join("\n"));
    toast("info", "Loaded report", `${report.domain} · ${formatDate(report.created_at)}`);
  };

  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !running) track();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl gradient-brand p-6 sm:p-8">
        <div className="absolute inset-0 gradient-hero opacity-60" />
        <div className="relative flex flex-col gap-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            <TrendingUp className="h-3.5 w-3.5" />
            Daily SERP rankings
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Position Tracking</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              Track up to 10 keywords at a time and see exactly where your domain ranks — current
              position, previous position, week-over-week movement, search volume and difficulty.
            </p>
          </div>
        </div>
      </section>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-brand-600" />
            Track keyword positions
          </CardTitle>
          <CardDescription>
            Enter your domain and up to 10 keywords. Each tracking run costs 1 credit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Domain input */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="domain" className="text-xs font-medium text-ink-600">
                Domain
              </Label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  id="domain"
                  type="text"
                  placeholder="yoursite.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  onKeyDown={submitOnEnter}
                  disabled={running}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Keywords textarea */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="keywords" className="flex items-center justify-between text-xs font-medium text-ink-600">
                <span>Keywords</span>
                <span className="text-ink-400">{parsedKeywords.length}/10</span>
              </Label>
              <Textarea
                id="keywords"
                placeholder={"Enter keywords, one per line\ncontent marketing tools\nseo audit software"}
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                disabled={running}
                className="min-h-[96px]"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-500">
              Separate keywords by newline or comma. We&apos;ll deduplicate and use the first 10.
            </p>
            <Button
              onClick={() => track()}
              disabled={running}
              variant="gradient"
              size="lg"
              className="shrink-0"
            >
              {running ? (
                <>
                  <Spinner size="sm" className="border-white/40 border-t-white" />
                  Tracking…
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4" />
                  Track positions
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading skeleton */}
      {running && <PositionsSkeleton />}

      {/* Results */}
      {!running && current && (
        <PositionsResults
          report={current}
          creditsLeft={creditsLeft}
          reports={reports}
          loadingHistory={loadingHistory}
          onRefreshHistory={loadHistory}
          onSelectReport={selectReport}
        />
      )}

      {/* Empty state */}
      {!running && !current && reports.length === 0 && !loadingHistory && (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<TrendingUp className="h-6 w-6 text-brand-500" />}
              title="Track your first keywords"
              description="Enter a domain and a few keywords above to start monitoring your SERP positions."
              action={
                <Button
                  variant="gradient"
                  onClick={() => {
                    setDomain("example.com");
                    setKeywordsText("content marketing\nseo tools\nkeyword research");
                    track("example.com", ["content marketing", "seo tools", "keyword research"]);
                  }}
                  disabled={running}
                >
                  <TrendingUp className="h-4 w-4" />
                  Try a demo
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

function PositionsResults({
  report,
  creditsLeft,
  reports,
  loadingHistory,
  onRefreshHistory,
  onSelectReport,
}: {
  report: PositionReport;
  creditsLeft: number | null;
  reports: PositionReport[];
  loadingHistory: boolean;
  onRefreshHistory: () => void;
  onSelectReport: (report: PositionReport) => void;
}) {
  const rows = report.results.keywords;

  const avgPosition = rows.length > 0
    ? rows.reduce((sum, r) => sum + r.position, 0) / rows.length
    : 0;
  const top10Count = rows.filter((r) => r.position <= 10).length;

  // Best mover = keyword with the biggest improvement (positive `change` = improvement,
  // since the API computes `change = previous_position - position`).
  const bestMover = useMemo(() => {
    if (rows.length === 0) return null;
    return rows.reduce((best, row) => (row.change > best.change ? row : best), rows[0]);
  }, [rows]);

  const chartData = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.position - a.position) // best (smallest) at top of horizontal bar chart
        .map((row) => ({
          keyword: truncate(row.keyword, 22),
          position: row.position,
          fullKeyword: row.keyword,
        })),
    [rows]
  );

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-emerald-700 text-white shadow-sm">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink-900">{report.results.domain}</p>
              <p className="flex items-center gap-1.5 text-xs text-ink-500">
                <Clock className="h-3 w-3" />
                Tracked {formatDate(report.created_at)}
                {creditsLeft !== null && <span> · {creditsLeft} credits left</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="px-2.5">
              <Hash className="h-3 w-3" />
              {rows.length} keywords
            </Badge>
            <Badge variant="outline" className="px-2.5">
              <Award className="h-3 w-3 text-emerald-600" />
              {top10Count} in Top 10
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Avg Position — blue gradient */}
        <Card className="card-hover overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Avg Position</p>
                <p className={cn("mt-1 text-2xl font-bold tracking-tight tabular-nums", avgPositionColor(avgPosition))}>
                  {avgPosition.toFixed(1)}
                </p>
                <p className="mt-1 text-xs text-ink-500">Lower is better</p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-sm">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Keywords in Top 10 — emerald gradient */}
        <Card className="card-hover overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">In Top 10</p>
                <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-ink-900">
                  {top10Count}
                  <span className="ml-1 text-sm font-medium text-ink-400">/ {rows.length}</span>
                </p>
                <p className="mt-1 text-xs text-ink-500">Keywords on page 1</p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                <Award className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Best Mover — amber gradient */}
        <Card className="card-hover overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Best Mover</p>
                {bestMover ? (
                  <>
                    <p className="mt-1 truncate text-base font-semibold text-ink-900" title={bestMover.keyword}>
                      {bestMover.keyword}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-xs font-medium tabular-nums",
                        bestMover.change > 0
                          ? "text-emerald-600"
                          : bestMover.change < 0
                            ? "text-red-600"
                            : "text-ink-500"
                      )}
                    >
                      {bestMover.change > 0
                        ? `▲ improved ${bestMover.change} spots`
                        : bestMover.change < 0
                          ? `▼ dropped ${Math.abs(bestMover.change)} spots`
                          : "— no change"}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-ink-500">No data</p>
                )}
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
                <ArrowUp className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Position chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ListChecks className="h-4 w-4 text-brand-600" />
            Keyword positions
          </CardTitle>
          <CardDescription className="text-xs">
            Shorter bars = better rankings. Green ≤10, amber 11–30, red &gt;30.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  ticks={[1, 10, 30, 50, 100]}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  type="category"
                  dataKey="keyword"
                  width={140}
                  tick={{ fill: "#334155", fontSize: 12 }}
                  stroke="#cbd5e1"
                />
                <Tooltip
                  cursor={{ fill: "rgba(16, 185, 129, 0.08)" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                    boxShadow: "0 4px 12px -2px rgba(0,0,0,0.08)",
                  }}
                  formatter={(value) => [`#${value}`, "Position"]}
                />
                <Bar dataKey="position" radius={[0, 6, 6, 0]} barSize={18}>
                  {chartData.map((entry, idx) => (
                    <Cell key={`bar-${idx}`} fill={barColor(entry.position)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Keywords table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-ink-400" />
            Keyword breakdown
          </CardTitle>
          <CardDescription>
            Current position, week-over-week change, search volume and difficulty for each keyword.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KeywordsTable rows={rows} />
        </CardContent>
      </Card>

      {/* History */}
      <ReportsList
        reports={reports}
        loading={loadingHistory}
        onRefresh={onRefreshHistory}
        onSelect={onSelectReport}
        embedded
      />
    </div>
  );
}

/* ------------------------------ Sub components ----------------------------- */

function KeywordsTable({ rows }: { rows: PositionRow[] }) {
  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp className="h-6 w-6" />}
        title="No keyword data"
        description="No positions were returned for this report."
      />
    );
  }

  const ordered = [...rows].sort((a, b) => a.position - b.position);

  return (
    <div className="overflow-x-auto rounded-lg border border-ink-100">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
            <th className="px-4 py-3 text-left font-medium">Keyword</th>
            <th className="px-4 py-3 text-left font-medium">Position</th>
            <th className="px-4 py-3 text-left font-medium">Previous</th>
            <th className="px-4 py-3 text-left font-medium">Change</th>
            <th className="px-4 py-3 text-left font-medium">Search Volume</th>
            <th className="px-4 py-3 text-left font-medium">Difficulty</th>
            <th className="px-4 py-3 text-left font-medium">URL</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((row, idx) => {
            const tier = tierFor(row.position);
            // API computes change = previous - position. Positive = improvement.
            // For display, we want "got worse" (position went up) to be a positive red number with ▲.
            const displayChange = row.position - row.previous_position;
            const improved = displayChange < 0;
            const worse = displayChange > 0;
            return (
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
                  <Badge variant="outline" className={cn("px-2 py-0.5 text-xs font-semibold tabular-nums", tier.label)}>
                    #{row.position}
                  </Badge>
                </td>
                <td className="px-4 py-3 tabular-nums text-ink-600">
                  {row.previous_position ? `#${row.previous_position}` : "—"}
                </td>
                <td className="px-4 py-3">
                  {displayChange === 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-ink-400">
                      <Minus className="h-3 w-3" />
                      <span>—</span>
                    </span>
                  ) : worse ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 tabular-nums">
                      <ArrowUp className="h-3 w-3" />
                      +{displayChange}
                    </span>
                  ) : improved ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 tabular-nums">
                      <ArrowDown className="h-3 w-3" />
                      {displayChange}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums text-ink-700">
                  {formatNumber(row.search_volume)}
                </td>
                <td className="px-4 py-3">
                  <DifficultyBadge difficulty={row.difficulty} />
                </td>
                <td className="px-4 py-3">
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex max-w-[200px] items-center gap-1 text-brand-700 hover:text-brand-900"
                    title={row.url}
                  >
                    <span className="truncate">{getDomain(row.url)}</span>
                    <ExternalLink className="h-3 w-3 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100" />
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: number }) {
  let label = "Easy";
  let variant: "success" | "warning" | "destructive" = "success";
  if (difficulty > 60) {
    label = "Hard";
    variant = "destructive";
  } else if (difficulty > 30) {
    label = "Medium";
    variant = "warning";
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums text-xs font-medium text-ink-700">{difficulty}</span>
      <Badge variant={variant} className="px-1.5 py-0 text-[10px]">
        {label}
      </Badge>
    </span>
  );
}

function ReportsList({
  reports,
  loading,
  onRefresh,
  onSelect,
  embedded = false,
}: {
  reports: PositionReport[];
  loading: boolean;
  onRefresh: () => void;
  onSelect: (report: PositionReport) => void;
  embedded?: boolean;
}) {
  return (
    <div className={embedded ? "" : "contents"}>
      <Card className={embedded ? "border-0 shadow-none" : ""}>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-ink-400" />
              {embedded ? "Past tracking reports" : "Recent reports"}
            </CardTitle>
            <CardDescription>
              {embedded
                ? "Click any report to view its full position breakdown."
                : "Your recent position tracking runs."}
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
                icon={<TrendingUp className="h-6 w-6" />}
                title="No reports yet"
                description="Your position tracking runs will appear here."
              />
            </div>
          ) : (
            <ul className="max-h-[420px] divide-y divide-ink-100 overflow-y-auto">
              {reports.map((report) => {
                const avgPos =
                  report.results.keywords.length > 0
                    ? report.results.keywords.reduce((s, r) => s + r.position, 0) /
                      report.results.keywords.length
                    : 0;
                const top10 = report.results.keywords.filter((r) => r.position <= 10).length;
                return (
                  <li key={report.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(report)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50/70"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <TrendingUp className="h-4 w-4" />
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
                          {report.results.keywords.length} kw
                        </Badge>
                        <Badge variant="outline" className="px-2 py-0 text-[10px]">
                          avg {avgPos.toFixed(0)}
                        </Badge>
                        {top10 > 0 && (
                          <Badge variant="success" className="px-2 py-0 text-[10px]">
                            {top10} top10
                          </Badge>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PositionsSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Chart skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-3 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </CardContent>
      </Card>
      {/* Table skeleton */}
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
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
