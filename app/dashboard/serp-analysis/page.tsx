"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Sparkles,
  Globe,
  Clock,
  History,
  RefreshCw,
  Target,
  ExternalLink,
  FileText,
  ListChecks,
  Boxes,
  Video,
  Image as ImageIcon,
  HelpCircle,
  Brain,
  Trophy,
  Zap,
  Hash,
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

interface SerpResult {
  position: number;
  url: string;
  title: string;
  domain: string;
  domainAuthority: number;
  wordCount: number;
  loadTimeMs: number;
  hasSchema: boolean;
  backlinks: number;
}

interface SerpAnalysisResult {
  keyword: string;
  country: string;
  topResults: SerpResult[];
  contentGaps: string[];
  serpFeatures: string[];
  commonEntities: string[];
  avgWordCount: number;
  summary: string;
}

interface SerpReport {
  id: string;
  keyword: string;
  results: SerpAnalysisResult;
  created_at: string;
}

/** Map a SERP feature name (case-insensitive) to an icon. */
function serpFeatureIcon(name: string): React.ReactNode {
  const l = name.toLowerCase();
  if (l.includes("snippet")) return <FileText className="h-3.5 w-3.5" />;
  if (l.includes("people") || l.includes("ask")) return <HelpCircle className="h-3.5 w-3.5" />;
  if (l.includes("video")) return <Video className="h-3.5 w-3.5" />;
  if (l.includes("image")) return <ImageIcon className="h-3.5 w-3.5" />;
  if (l.includes("knowledge")) return <Brain className="h-3.5 w-3.5" />;
  if (l.includes("local") || l.includes("map")) return <Globe className="h-3.5 w-3.5" />;
  if (l.includes("news")) return <ListChecks className="h-3.5 w-3.5" />;
  return <Boxes className="h-3.5 w-3.5" />;
}

function daColorClass(da: number): string {
  if (da >= 70) return "bg-red-500";
  if (da >= 40) return "bg-amber-500";
  return "bg-emerald-500";
}

function loadTimeBadge(ms: number): { label: string; variant: "success" | "warning" | "destructive" } {
  if (ms <= 1500) return { label: `${ms} ms`, variant: "success" };
  if (ms <= 3000) return { label: `${ms} ms`, variant: "warning" };
  return { label: `${ms} ms`, variant: "destructive" };
}

/* --------------------------------- Page ---------------------------------- */

export default function SerpAnalysisPage() {
  const { toast } = useToast();

  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState("us");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<SerpReport | null>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  const [reports, setReports] = useState<SerpReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/serp-analysis", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load SERP analyses");
      const list: SerpReport[] = json.data || [];
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

  const analyze = async () => {
    const trimmed = keyword.trim();
    if (trimmed.length < 2) {
      toast("warning", "Enter a keyword", "Keyword must be at least 2 characters.");
      return;
    }
    const cleanCountry = country.trim().toLowerCase() || "us";
    setRunning(true);
    setCurrent(null);
    try {
      const res = await fetch("/api/serp-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: trimmed, country: cleanCountry }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "SERP analysis failed");
      const report: SerpReport | undefined = json.data?.analysis;
      if (!report) throw new Error("Malformed response from server");
      if (json.data?.credits_left !== undefined) setCreditsLeft(json.data.credits_left);
      setCurrent(report);
      toast(
        "success",
        "SERP analyzed",
        `${report.results.topResults.length} top results for "${report.keyword}"`
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

  const selectReport = (report: SerpReport) => {
    setCurrent(report);
    setKeyword(report.keyword);
    setCountry(report.results.country || "us");
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
            <h1 className="text-2xl font-bold text-white sm:text-3xl">SERP Analysis</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              See what&apos;s ranking and find content gaps. Get a simulated top-10 of ranking
              pages, their domain authority, technical signals, SERP features and common entities.
            </p>
          </div>
        </div>
      </section>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-brand-600" />
            Analyze a SERP
          </CardTitle>
          <CardDescription>
            Enter a keyword (and optionally a country code) to simulate a top-10 SERP analysis.
            Each analysis costs 1 credit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_160px]">
            <div className="space-y-2">
              <Label htmlFor="keyword" className="text-xs font-medium text-ink-600">
                Keyword <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  id="keyword"
                  type="text"
                  placeholder="content marketing tools"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={submitOnEnter}
                  disabled={running}
                  className="pl-9"
                  maxLength={120}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="country" className="text-xs font-medium text-ink-600">
                Country
              </Label>
              <Input
                id="country"
                type="text"
                placeholder="us"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                onKeyDown={submitOnEnter}
                disabled={running}
                maxLength={5}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
            <Button onClick={analyze} disabled={running} variant="gradient" size="lg">
              {running ? (
                <>
                  <Spinner size="sm" className="border-white/40 border-t-white" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Analyze SERP
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {running && <SerpSkeleton />}

      {/* Results */}
      {!running && current && (
        <SerpResults
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
              icon={<Search className="h-6 w-6 text-brand-500" />}
              title="Analyze your first SERP"
              description="Enter a keyword above to see what&apos;s ranking, technical signals, and content gaps."
              action={
                <Button
                  variant="gradient"
                  onClick={() => {
                    setKeyword("content marketing tools");
                    setCountry("us");
                    analyze();
                  }}
                  disabled={running}
                >
                  <Search className="h-4 w-4" />
                  Try a demo
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* History list */}
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

function SerpResults({
  report,
  creditsLeft,
  reports,
  loadingHistory,
  onRefreshHistory,
  onSelectReport,
}: {
  report: SerpReport;
  creditsLeft: number | null;
  reports: SerpReport[];
  loadingHistory: boolean;
  onRefreshHistory: () => void;
  onSelectReport: (report: SerpReport) => void;
}) {
  const result = report.results;
  const topResults = useMemo(
    () =>
      [...(result.topResults || [])].sort((a, b) => (a.position || 0) - (b.position || 0)),
    [result.topResults]
  );

  return (
    <div className="space-y-6">
      {/* AI summary */}
      <Card className="border-l-brand-500" style={{ borderLeftWidth: 4 }}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="px-2 py-0.5">
              <Search className="h-3 w-3" />
              {report.keyword}
            </Badge>
            <Badge variant="outline" className="px-2 py-0.5 uppercase">
              {result.country}
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
          <div className="mt-3 flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
            <p className="text-sm leading-relaxed text-ink-700">{result.summary}</p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-brand-600" />
            SERP breakdown
          </CardTitle>
          <CardDescription>
            {topResults.length} top results · {result.serpFeatures.length} SERP features ·{" "}
            {result.contentGaps.length} content gaps · {result.commonEntities.length} entities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="top">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="top">
                <Trophy className="h-3.5 w-3.5" />
                Top Results
              </TabsTrigger>
              <TabsTrigger value="features">
                <Zap className="h-3.5 w-3.5" />
                SERP Features
              </TabsTrigger>
              <TabsTrigger value="gaps">
                <Target className="h-3.5 w-3.5" />
                Content Gaps
              </TabsTrigger>
              <TabsTrigger value="entities">
                <Boxes className="h-3.5 w-3.5" />
                Entities
              </TabsTrigger>
            </TabsList>

            {/* Top results table */}
            <TabsContent value="top" className="mt-4">
              {topResults.length === 0 ? (
                <EmptyState
                  icon={<Trophy className="h-6 w-6 text-ink-400" />}
                  title="No top results"
                  description="The AI did not return any ranking pages."
                />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-ink-100">
                  <table className="w-full min-w-[860px] border-collapse text-sm">
                    <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">Title</th>
                        <th className="px-3 py-2 font-medium">Domain</th>
                        <th className="px-3 py-2 font-medium">DA</th>
                        <th className="px-3 py-2 font-medium">Words</th>
                        <th className="px-3 py-2 font-medium">Load time</th>
                        <th className="px-3 py-2 font-medium">Schema</th>
                        <th className="px-3 py-2 font-medium">Backlinks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {topResults.map((r) => {
                        const lt = loadTimeBadge(r.loadTimeMs);
                        return (
                          <tr key={`${r.position}-${r.url}`} className="hover:bg-ink-50/60">
                            <td className="px-3 py-2.5">
                              <span
                                className={cn(
                                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                                  r.position <= 3
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-ink-100 text-ink-600"
                                )}
                              >
                                {r.position}
                              </span>
                            </td>
                            <td className="max-w-[280px] px-3 py-2.5">
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-start gap-1 text-ink-900 hover:text-brand-700"
                              >
                                <span className="line-clamp-2">{truncate(r.title, 70)}</span>
                                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-ink-300 group-hover:text-brand-500" />
                              </a>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-ink-600">{getDomain(r.url)}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="w-8 text-xs tabular-nums text-ink-700">
                                  {Math.round(r.domainAuthority)}
                                </span>
                                <Progress
                                  value={Math.max(2, Math.min(100, r.domainAuthority))}
                                  className="h-1.5 w-14"
                                  indicatorClassName={daColorClass(r.domainAuthority)}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-ink-700">
                              {r.wordCount ? formatNumber(r.wordCount) : "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge variant={lt.variant} className="px-2 py-0 text-[10px]">
                                {lt.label}
                              </Badge>
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge
                                variant={r.hasSchema ? "success" : "secondary"}
                                className="px-2 py-0 text-[10px]"
                              >
                                {r.hasSchema ? "Yes" : "No"}
                              </Badge>
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-ink-700">
                              {r.backlinks ? formatCompact(r.backlinks) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-xs text-ink-500">
                Average word count across top results:{" "}
                <span className="font-medium text-ink-700">
                  {result.avgWordCount ? formatNumber(Math.round(result.avgWordCount)) : "—"}
                </span>{" "}
                words.
              </p>
            </TabsContent>

            {/* SERP features */}
            <TabsContent value="features" className="mt-4">
              {result.serpFeatures.length === 0 ? (
                <EmptyState
                  icon={<Zap className="h-6 w-6 text-ink-400" />}
                  title="No SERP features detected"
                  description="The AI did not surface any special SERP features for this keyword."
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {result.serpFeatures.map((f, i) => (
                    <div
                      key={`${f}-${i}`}
                      className="card-hover flex items-center gap-3 rounded-lg border border-ink-200 bg-white p-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        {serpFeatureIcon(f)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-900">{f}</p>
                        <p className="text-xs text-ink-500">SERP feature</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Content gaps */}
            <TabsContent value="gaps" className="mt-4">
              <Card className="border-0 bg-ink-50/60 shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <Target className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <p className="text-sm text-ink-700">
                      Topics competitors cover that you should add to your page to outrank them.
                    </p>
                  </div>
                </CardContent>
              </Card>
              {result.contentGaps.length === 0 ? (
                <div className="mt-3">
                  <EmptyState
                    icon={<ListChecks className="h-6 w-6 text-emerald-500" />}
                    title="No content gaps found"
                    description="The AI didn't identify any obvious content gaps in the top-10."
                  />
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.contentGaps.map((g, i) => (
                    <Badge
                      key={`${g}-${i}`}
                      variant="warning"
                      className="px-3 py-1 text-xs"
                    >
                      <Target className="h-3 w-3" />
                      {g}
                    </Badge>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Entities */}
            <TabsContent value="entities" className="mt-4">
              {result.commonEntities.length === 0 ? (
                <EmptyState
                  icon={<Boxes className="h-6 w-6 text-ink-400" />}
                  title="No entities detected"
                  description="The AI did not surface any common entities across the top results."
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {result.commonEntities.map((e, i) => (
                    <Badge
                      key={`${e}-${i}`}
                      variant="outline"
                      className="px-3 py-1 text-xs"
                    >
                      <Hash className="h-3 w-3 text-brand-500" />
                      {e}
                    </Badge>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
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

function ReportsList({
  reports,
  loading,
  onRefresh,
  onSelect,
}: {
  reports: SerpReport[];
  loading: boolean;
  onRefresh: () => void;
  onSelect: (report: SerpReport) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-ink-400" />
            Recent SERP analyses
          </CardTitle>
          <CardDescription>Click any keyword to view its full SERP report.</CardDescription>
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
              icon={<Search className="h-6 w-6" />}
              title="No SERP analyses yet"
              description="Your SERP analyses will appear here."
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
                    <Search className="h-4 w-4" />
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
                      <span className="text-ink-300">·</span>
                      <span className="uppercase">{report.results.country}</span>
                    </p>
                  </div>
                  <Badge variant="outline" className="px-2 py-0 text-[10px]">
                    {report.results.topResults.length} results
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SerpSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-3 w-64" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/4" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
