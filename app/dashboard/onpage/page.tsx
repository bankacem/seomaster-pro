"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Globe,
  Search,
  Wrench,
  CheckSquare,
  History,
  RefreshCw,
  Clock,
  AlertTriangle,
  AlertCircle,
  Info,
  ListChecks,
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
import { EmptyState, Skeleton, Spinner } from "@/components/ui/spinner";
import { ScoreGauge } from "@/components/shared/score-gauge";
import { useToast } from "@/components/ui/toast";
import {
  cn,
  formatDate,
  truncate,
  getDomain,
  scoreColor,
} from "@/lib/utils";

/* ----------------------------- Types & helpers ---------------------------- */

type Priority = "high" | "medium" | "low";

interface OnPageRecommendation {
  category: string;
  priority: Priority;
  title: string;
  description: string;
  how_to_fix: string;
}

interface OnPageResult {
  score: number;
  recommendations: OnPageRecommendation[];
  summary: string;
}

interface OnPageReport {
  id: string;
  url: string;
  results: OnPageResult;
  created_at: string;
}

const PRIORITY_VARIANT: Record<Priority, "destructive" | "warning" | "info"> = {
  high: "destructive",
  medium: "warning",
  low: "info",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High Priority",
  medium: "Medium Priority",
  low: "Low Priority",
};

function priorityIcon(priority: Priority) {
  if (priority === "high") return <AlertCircle className="h-3 w-3" />;
  if (priority === "medium") return <AlertTriangle className="h-3 w-3" />;
  return <Info className="h-3 w-3" />;
}

function normalizeUrlInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.includes("://") ? trimmed : `https://${trimmed}`;
}

/* --------------------------------- Page ---------------------------------- */

export default function OnPagePage() {
  const { toast } = useToast();

  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<OnPageReport | null>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  const [reports, setReports] = useState<OnPageReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState("high");

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/onpage", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load on-page reports");
      const list: OnPageReport[] = json.data || [];
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

  const check = async (overrideUrl?: string) => {
    const raw = (overrideUrl ?? url).trim();
    if (!raw) {
      toast("warning", "Enter a URL", "Provide a page URL to analyze.");
      return;
    }
    const normalized = normalizeUrlInput(raw);
    setRunning(true);
    setCurrent(null);
    try {
      const res = await fetch("/api/onpage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "On-page analysis failed");
      // POST returns { data: { report: <record>, credits_left } }.
      const report: OnPageReport | undefined = json.data?.report;
      if (!report) throw new Error("Malformed response from server");
      if (json.data?.credits_left !== undefined) setCreditsLeft(json.data.credits_left);
      setCurrent(report);
      toast(
        "success",
        "Check complete",
        `${report.results.recommendations.length} recommendations for ${getDomain(report.url)}`
      );
      // Refresh history so the new run shows up in the History tab.
      const fresh = await loadHistory();
      const match = fresh.find((r) => r.id === report.id);
      if (match) setCurrent(match);
      // Pick the first non-empty priority tab.
      const counts = countByPriority(report.results.recommendations);
      const firstNonEmpty = counts.high > 0 ? "high" : counts.medium > 0 ? "medium" : counts.low > 0 ? "low" : "high";
      setActiveTab(firstNonEmpty);
    } catch (err) {
      toast("error", "Analysis failed", err instanceof Error ? err.message : "Try again later");
    } finally {
      setRunning(false);
    }
  };

  const selectReport = (report: OnPageReport) => {
    setCurrent(report);
    setUrl(report.url);
    const counts = countByPriority(report.results.recommendations);
    const firstNonEmpty = counts.high > 0 ? "high" : counts.medium > 0 ? "medium" : counts.low > 0 ? "low" : "high";
    setActiveTab(firstNonEmpty);
    toast("info", "Loaded report", `${getDomain(report.url)} · ${formatDate(report.created_at)}`);
  };

  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !running) check();
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
            <h1 className="text-2xl font-bold text-white sm:text-3xl">On-Page SEO Checker</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              Get actionable recommendations for any URL — content gaps, meta issues, technical SEO and
              performance improvements, prioritized so you know what to fix first.
            </p>
          </div>
        </div>
      </section>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-brand-600" />
            Check a page
          </CardTitle>
          <CardDescription>
            Paste any URL to receive an AI-powered on-page SEO audit. Each check costs 1 credit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Label htmlFor="url" className="text-xs font-medium text-ink-600">
              Page URL
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  id="url"
                  type="text"
                  placeholder="https://example.com/blog/post"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={submitOnEnter}
                  disabled={running}
                  className="pl-9"
                />
              </div>
              <Button
                onClick={() => check()}
                disabled={running}
                variant="gradient"
                size="lg"
                className="shrink-0"
              >
                {running ? (
                  <>
                    <Spinner size="sm" className="border-white/40 border-t-white" />
                    Checking…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Check page
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading skeleton */}
      {running && <OnPageSkeleton />}

      {/* Results */}
      {!running && current && (
        <OnPageResults
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
              icon={<CheckSquare className="h-6 w-6 text-brand-500" />}
              title="Check your first URL"
              description="Paste any page URL above to get an instant AI-powered on-page SEO audit with prioritized recommendations."
              action={
                <Button
                  variant="gradient"
                  onClick={() => {
                    const demoUrl = "https://example.com/blog/seo-guide";
                    setUrl(demoUrl);
                    check(demoUrl);
                  }}
                  disabled={running}
                >
                  <CheckSquare className="h-4 w-4" />
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

function countByPriority(recs: readonly OnPageRecommendation[]) {
  return recs.reduce(
    (acc, r) => {
      acc[r.priority] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 } as Record<Priority, number>
  );
}

function OnPageResults({
  report,
  activeTab,
  onTabChange,
  creditsLeft,
  reports,
  loadingHistory,
  onRefreshHistory,
  onSelectReport,
}: {
  report: OnPageReport;
  activeTab: string;
  onTabChange: (tab: string) => void;
  creditsLeft: number | null;
  reports: OnPageReport[];
  loadingHistory: boolean;
  onRefreshHistory: () => void;
  onSelectReport: (report: OnPageReport) => void;
}) {
  const result = report.results;
  const counts = useMemo(() => countByPriority(result.recommendations), [result.recommendations]);

  const high = useMemo(
    () => result.recommendations.filter((r) => r.priority === "high"),
    [result.recommendations]
  );
  const medium = useMemo(
    () => result.recommendations.filter((r) => r.priority === "medium"),
    [result.recommendations]
  );
  const low = useMemo(
    () => result.recommendations.filter((r) => r.priority === "low"),
    [result.recommendations]
  );

  return (
    <div className="space-y-6">
      {/* Score + summary */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex shrink-0 items-center justify-center">
              <ScoreGauge score={result.score} size="lg" label="SEO" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium uppercase tracking-wide text-ink-500">
                  On-page SEO score
                </p>
                <Badge
                  variant={result.score >= 80 ? "success" : result.score >= 60 ? "warning" : "destructive"}
                  className="px-2 py-0.5"
                >
                  {result.score >= 80 ? "Strong" : result.score >= 60 ? "Needs work" : "Weak"}
                </Badge>
              </div>
              <div className="mt-3 flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <p className="text-sm leading-relaxed text-ink-700">{result.summary}</p>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3 w-3" />
                  <a
                    href={report.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-ink-700 hover:text-brand-700"
                  >
                    {truncate(report.url, 70)}
                    <ExternalLink className="h-3 w-3 text-ink-300" />
                  </a>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {formatDate(report.created_at)}
                </span>
                {creditsLeft !== null && (
                  <Badge variant="outline" className="px-2 py-0 text-[10px]">
                    {creditsLeft} credits left
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Priority tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-brand-600" />
            Recommendations
          </CardTitle>
          <CardDescription>
            {result.recommendations.length} actionable items across {high.length + medium.length + low.length > 0 ? "high, medium and low priorities" : "all priorities"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="high">
                <span className="flex items-center gap-1.5">
                  High
                  <Badge
                    variant={counts.high > 0 ? "destructive" : "secondary"}
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {counts.high}
                  </Badge>
                </span>
              </TabsTrigger>
              <TabsTrigger value="medium">
                <span className="flex items-center gap-1.5">
                  Medium
                  <Badge
                    variant={counts.medium > 0 ? "warning" : "secondary"}
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {counts.medium}
                  </Badge>
                </span>
              </TabsTrigger>
              <TabsTrigger value="low">
                <span className="flex items-center gap-1.5">
                  Low
                  <Badge
                    variant={counts.low > 0 ? "info" : "secondary"}
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {counts.low}
                  </Badge>
                </span>
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-3.5 w-3.5" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="high" className="mt-4">
              <RecommendationList
                items={high}
                priority="high"
                emptyTitle="No high-priority issues"
                emptyDescription="Great — no critical on-page issues were detected."
              />
            </TabsContent>

            <TabsContent value="medium" className="mt-4">
              <RecommendationList
                items={medium}
                priority="medium"
                emptyTitle="No medium-priority issues"
                emptyDescription="No medium-priority recommendations for this page."
              />
            </TabsContent>

            <TabsContent value="low" className="mt-4">
              <RecommendationList
                items={low}
                priority="low"
                emptyTitle="No low-priority issues"
                emptyDescription="No low-priority recommendations for this page."
              />
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

/* ----------------------------- Recommendations ---------------------------- */

function RecommendationList({
  items,
  priority,
  emptyTitle,
  emptyDescription,
}: {
  items: OnPageRecommendation[];
  priority: Priority;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={priorityIcon(priority)}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item, idx) => (
        <RecommendationCard key={`${item.title}-${idx}`} item={item} />
      ))}
    </div>
  );
}

function RecommendationCard({ item }: { item: OnPageRecommendation }) {
  return (
    <Card className="card-hover flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={PRIORITY_VARIANT[item.priority]} className="px-2 py-0.5">
            {priorityIcon(item.priority)}
            {PRIORITY_LABEL[item.priority]}
          </Badge>
          <Badge variant="outline" className="px-2 py-0.5 capitalize">
            {item.category}
          </Badge>
        </div>
        <CardTitle className="mt-2 text-base font-semibold text-ink-900">
          {item.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="text-sm leading-relaxed text-ink-600">{item.description}</p>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
            <Wrench className="h-3 w-3" />
            How to fix
          </p>
          <div className="bg-ink-50 mt-2 rounded-md p-3 font-mono text-xs leading-relaxed text-ink-700 whitespace-pre-wrap">
            {item.how_to_fix}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Sub components ----------------------------- */

function ReportsList({
  reports,
  loading,
  onRefresh,
  onSelect,
  embedded = false,
}: {
  reports: OnPageReport[];
  loading: boolean;
  onRefresh: () => void;
  onSelect: (report: OnPageReport) => void;
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
                ? "Click any report to view its recommendations."
                : "Your recent on-page audits."}
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
                icon={<CheckSquare className="h-6 w-6" />}
                title="No reports yet"
                description="Your on-page audits will appear here."
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
                      <CheckSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900" title={report.url}>
                        {truncate(report.url, 60)}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-ink-500">
                        <Clock className="h-3 w-3" />
                        {formatDate(report.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-bold tabular-nums"
                        style={{ color: scoreColor(report.results.score) }}
                      >
                        {report.results.score}
                      </span>
                      <Badge variant="outline" className="px-2 py-0 text-[10px]">
                        {report.results.recommendations.length} recs
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

function OnPageSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <Skeleton className="h-[180px] w-[180px] rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-3 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
