"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Target,
  Sparkles,
  Search,
  DollarSign,
  Users,
  Gauge,
  TrendingUp,
  Clock,
  History,
  RefreshCw,
  CheckCircle2,
  XCircle,
  FileBarChart,
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
import { EmptyState, Skeleton, Spinner } from "@/components/ui/spinner";
import { ScoreGauge } from "@/components/shared/score-gauge";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate, formatCompact, formatNumber, truncate } from "@/lib/utils";

/* ----------------------------- Types & helpers ---------------------------- */

type DifficultyLabel = "easy" | "medium" | "hard" | "very-hard" | string;
type CompetitionLevel = "low" | "medium" | "high" | string;
type AuthorityLevel = "low" | "medium" | "high" | string;

interface SerpOverview {
  avgWordCount: number;
  avgDomainAuthority: number;
  hasFeaturedSnippet: boolean;
  serpFeatures: string[];
}

interface KeywordDifficultyResult {
  keyword: string;
  difficulty: number;
  difficultyLabel: DifficultyLabel;
  cpc: number;
  competition: CompetitionLevel;
  searchVolume: number;
  serpOverview: SerpOverview;
  topicalAuthority: AuthorityLevel;
  timeToRank: string;
  recommendation: string;
}

interface KeywordDifficultyReport {
  id: string;
  keyword: string;
  results: KeywordDifficultyResult;
  created_at: string;
}

function difficultyVariant(label: DifficultyLabel): "success" | "warning" | "destructive" {
  const l = label.toLowerCase();
  if (l === "easy") return "success";
  if (l === "medium") return "warning";
  if (l === "hard") return "destructive";
  if (l === "very-hard" || l === "very hard") return "destructive";
  return "warning";
}

function difficultyColorClass(label: DifficultyLabel): string {
  const l = label.toLowerCase();
  if (l === "easy") return "text-emerald-600";
  if (l === "medium") return "text-amber-600";
  return "text-red-600";
}

function competitionVariant(level: CompetitionLevel): "success" | "warning" | "destructive" {
  const l = String(level).toLowerCase();
  if (l === "low") return "success";
  if (l === "medium") return "warning";
  return "destructive";
}

function authorityVariant(level: AuthorityLevel): "success" | "warning" | "destructive" {
  const l = String(level).toLowerCase();
  if (l === "low") return "success";
  if (l === "medium") return "warning";
  return "destructive";
}

function labelize(label: DifficultyLabel): string {
  const l = String(label).toLowerCase();
  if (l === "very-hard" || l === "very hard") return "Very Hard";
  return l.charAt(0).toUpperCase() + l.slice(1);
}

/* --------------------------------- Page ---------------------------------- */

export default function KeywordDifficultyPage() {
  const { toast } = useToast();

  const [keyword, setKeyword] = useState("");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<KeywordDifficultyReport | null>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  const [reports, setReports] = useState<KeywordDifficultyReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/keyword-difficulty", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load keyword difficulty reports");
      const list: KeywordDifficultyReport[] = json.data || [];
      setReports(list);
      return list;
    } catch (err) {
      toast(
        "error",
        "Could not load history",
        err instanceof Error ? err.message : "Try again later"
      );
      setReports([]);
      return [];
    } finally {
      setLoadingHistory(false);
    }
  }, [toast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const analyze = async (override?: string) => {
    const trimmed = (override ?? keyword).trim();
    if (trimmed.length < 2) {
      toast("warning", "Enter a keyword", "Keyword must be at least 2 characters.");
      return;
    }
    setRunning(true);
    setCurrent(null);
    try {
      const res = await fetch("/api/keyword-difficulty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Keyword difficulty analysis failed");
      const report: KeywordDifficultyReport | undefined = json.data?.report;
      if (!report) throw new Error("Malformed response from server");
      if (json.data?.credits_left !== undefined) setCreditsLeft(json.data.credits_left);
      setCurrent(report);
      toast(
        "success",
        "Analysis complete",
        `Difficulty ${report.results.difficulty} for "${report.keyword}"`
      );
      const fresh = await loadHistory();
      const match = fresh.find((r) => r.id === report.id);
      if (match) setCurrent(match);
    } catch (err) {
      toast(
        "error",
        "Analysis failed",
        err instanceof Error ? err.message : "Try again later"
      );
    } finally {
      setRunning(false);
    }
  };

  const selectReport = (report: KeywordDifficultyReport) => {
    setCurrent(report);
    setKeyword(report.keyword);
    toast("info", "Loaded report", `${report.keyword} · ${formatDate(report.created_at)}`);
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
            <Sparkles className="h-3.5 w-3.5" />
            AI-powered
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Keyword Difficulty</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              Estimate how hard it is to rank for any keyword. Get a 0-100 difficulty score,
              CPC, search volume, SERP overview and a strategy recommendation.
            </p>
          </div>
        </div>
      </section>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-brand-600" />
            Analyze a keyword
          </CardTitle>
          <CardDescription>
            Enter a single keyword to estimate ranking difficulty. Each analysis costs 1 credit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Label htmlFor="keyword" className="text-xs font-medium text-ink-600">
              Keyword
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  id="keyword"
                  type="text"
                  placeholder="best running shoes"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={submitOnEnter}
                  disabled={running}
                  className="pl-9"
                  maxLength={120}
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
                    <Target className="h-4 w-4" />
                    Analyze difficulty
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {running && <DifficultySkeleton />}

      {/* Results */}
      {!running && current && (
        <DifficultyResults
          report={current}
          creditsLeft={creditsLeft}
          reports={reports}
          loadingHistory={loadingHistory}
          onRefreshHistory={loadHistory}
          onSelectReport={selectReport}
        />
      )}

      {/* Empty state — no reports */}
      {!running && !current && reports.length === 0 && !loadingHistory && (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Target className="h-6 w-6 text-brand-500" />}
              title="Analyze your first keyword"
              description="Enter a keyword above to estimate ranking difficulty and get a strategy recommendation."
              action={
                <Button
                  variant="gradient"
                  onClick={() => analyze("best running shoes")}
                  disabled={running}
                >
                  <Target className="h-4 w-4" />
                  Try "best running shoes"
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

function DifficultyResults({
  report,
  creditsLeft,
  reports,
  loadingHistory,
  onRefreshHistory,
  onSelectReport,
}: {
  report: KeywordDifficultyReport;
  creditsLeft: number | null;
  reports: KeywordDifficultyReport[];
  loadingHistory: boolean;
  onRefreshHistory: () => void;
  onSelectReport: (report: KeywordDifficultyReport) => void;
}) {
  const result = report.results;
  const serp = result.serpOverview || {
    avgWordCount: 0,
    avgDomainAuthority: 0,
    hasFeaturedSnippet: false,
    serpFeatures: [],
  };

  return (
    <div className="space-y-6">
      {/* Score header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="px-2 py-0.5">
              <Search className="h-3 w-3" />
              {report.keyword}
            </Badge>
            <Badge variant="outline" className="px-2 py-0 text-[10px]">
              {formatDate(report.created_at)}
            </Badge>
            {creditsLeft !== null && (
              <Badge variant="outline" className="px-2 py-0 text-[10px]">
                {creditsLeft} credits left
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-4">
            <ScoreGauge score={result.difficulty} size="lg" label="Difficulty" />
            <div className="flex flex-col items-center gap-2">
              <Badge
                variant={difficultyVariant(result.difficultyLabel)}
                className="px-3 py-1 text-sm"
              >
                {labelize(result.difficultyLabel)}
              </Badge>
              <p className="text-xs text-ink-500">
                Based on SERP authority, content depth, and link signals.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          iconWrapClass="bg-blue-50 text-blue-600"
          label="Search Volume"
          value={result.searchVolume ? formatCompact(result.searchVolume) : "—"}
          sub={result.searchVolume ? `${formatNumber(result.searchVolume)} /mo` : "No estimate"}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          iconWrapClass="bg-emerald-50 text-emerald-600"
          label="CPC"
          value={
            Number.isFinite(result.cpc)
              ? `$${result.cpc.toFixed(2)}`
              : "—"
          }
          sub="Cost per click (est.)"
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          iconWrapClass="bg-amber-50 text-amber-600"
          label="Competition"
          value={<Badge variant={competitionVariant(result.competition)} className="capitalize">
            {result.competition}
          </Badge>}
          sub="Advertiser competition"
        />
        <KpiCard
          icon={<Gauge className="h-4 w-4" />}
          iconWrapClass="bg-purple-50 text-purple-600"
          label="Topical Authority"
          value={<Badge variant={authorityVariant(result.topicalAuthority)} className="capitalize">
            {result.topicalAuthority}
          </Badge>}
          sub="Authority required"
        />
      </div>

      {/* Two-column SERP + Strategy */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* SERP overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileBarChart className="h-4 w-4 text-brand-600" />
              SERP Overview
            </CardTitle>
            <CardDescription>
              Snapshot of the current top-10 ranking pages for this keyword.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MetricTile
                label="Avg word count"
                value={serp.avgWordCount ? formatNumber(serp.avgWordCount) : "—"}
              />
              <MetricTile
                label="Avg domain authority"
                value={
                  Number.isFinite(serp.avgDomainAuthority)
                    ? `${Math.round(serp.avgDomainAuthority)}`
                    : "—"
                }
              />
              <MetricTile
                label="Featured snippet"
                value={
                  <Badge variant={serp.hasFeaturedSnippet ? "success" : "secondary"}>
                    {serp.hasFeaturedSnippet ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" /> Yes
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" /> No
                      </>
                    )}
                  </Badge>
                }
              />
              <MetricTile
                label="SERP features"
                value={`${Array.isArray(serp.serpFeatures) ? serp.serpFeatures.length : 0} detected`}
              />
            </div>
            {Array.isArray(serp.serpFeatures) && serp.serpFeatures.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {serp.serpFeatures.map((f, i) => (
                  <Badge key={`${f}-${i}`} variant="outline" className="px-2 py-0.5 text-[11px]">
                    {f}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Strategy */}
        <Card className="border-l-brand-500" style={{ borderLeftWidth: 4 }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-600" />
              Strategy
            </CardTitle>
            <CardDescription>
              How long it would take a new page to rank and what to focus on.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-ink-50 p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Estimated time to rank
              </p>
              <p
                className={cn(
                  "mt-1 text-2xl font-bold",
                  difficultyColorClass(result.difficultyLabel)
                )}
              >
                {result.timeToRank || "—"}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <p className="text-sm leading-relaxed text-ink-700">
                {result.recommendation}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

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
  icon,
  iconWrapClass,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  iconWrapClass: string;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card className="card-hover">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
            <div className="mt-1 text-2xl font-bold text-ink-900 tabular-nums">{value}</div>
            {sub && <p className="mt-1 text-xs text-ink-400">{sub}</p>}
          </div>
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              iconWrapClass
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-ink-50/50 p-3">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink-900">{value}</p>
    </div>
  );
}

function ReportsList({
  reports,
  loading,
  onRefresh,
  onSelect,
}: {
  reports: KeywordDifficultyReport[];
  loading: boolean;
  onRefresh: () => void;
  onSelect: (report: KeywordDifficultyReport) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-ink-400" />
            Recent analyses
          </CardTitle>
          <CardDescription>Click any keyword to view its difficulty report.</CardDescription>
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
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Target className="h-6 w-6" />}
              title="No analyses yet"
              description="Your keyword difficulty reports will appear here."
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
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Target className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium text-ink-900"
                      title={report.keyword}
                    >
                      {truncate(report.keyword, 50)}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-ink-500">
                      <Clock className="h-3 w-3" />
                      {formatDate(report.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{
                        color:
                          report.results.difficulty >= 60
                            ? "#ef4444"
                            : report.results.difficulty >= 30
                            ? "#f59e0b"
                            : "#10b981",
                      }}
                    >
                      {report.results.difficulty}
                    </span>
                    <Badge
                      variant={difficultyVariant(report.results.difficultyLabel)}
                      className="px-2 py-0 text-[10px]"
                    >
                      {labelize(report.results.difficultyLabel)}
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

function DifficultySkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6">
          <Skeleton className="h-[180px] w-[180px] rounded-full" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-64" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-2 h-3 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
