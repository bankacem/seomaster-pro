"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  Globe,
  ExternalLink,
  Target,
  Search,
  Sparkles,
  History,
  RefreshCw,
  Clock,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Hash,
  Layers,
  Crosshair,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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

type CompetitionLevel = "low" | "medium" | "high";

interface Competitor {
  domain: string;
  traffic_estimate: number;
  keywords_overlap: number;
  competition_level: CompetitionLevel;
}

interface CompetitorAnalysisResult {
  domain: string;
  competitors: Competitor[];
  shared_keywords: string[];
  gaps: string[];
  summary: string;
}

interface CompetitorReport {
  id: string;
  domain: string;
  results: CompetitorAnalysisResult;
  created_at: string;
}

const COMPETITION_VARIANT: Record<CompetitionLevel, "success" | "warning" | "destructive"> = {
  low: "success",
  medium: "warning",
  high: "destructive",
};

const COMPETITION_LABEL: Record<CompetitionLevel, string> = {
  low: "Low competition",
  medium: "Medium",
  high: "High",
};

function normalizeDomainInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.includes("://") ? trimmed : `https://${trimmed}`;
}

/* --------------------------------- Page ---------------------------------- */

export default function CompetitorsPage() {
  const { toast } = useToast();

  const [domain, setDomain] = useState("");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<CompetitorReport | null>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  const [reports, setReports] = useState<CompetitorReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState("competitors");

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/competitors", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load competitor analyses");
      const list: CompetitorReport[] = json.data || [];
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
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: normalized }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Competitor analysis failed");
      // POST returns { data: { analysis: <record>, credits_left } } per the API route.
      // We defensively accept `report` as well in case the contract changes.
      const report: CompetitorReport | undefined = json.data?.report ?? json.data?.analysis;
      if (!report) throw new Error("Malformed response from server");
      if (json.data?.credits_left !== undefined) setCreditsLeft(json.data.credits_left);
      setCurrent(report);
      toast(
        "success",
        "Analysis complete",
        `${report.results.competitors.length} competitors found for ${report.domain}`
      );
      // Refresh history so the new run shows up in the History tab.
      const fresh = await loadHistory();
      const match = fresh.find((r) => r.id === report.id);
      if (match) setCurrent(match);
      setActiveTab("competitors");
    } catch (err) {
      toast("error", "Analysis failed", err instanceof Error ? err.message : "Try again later");
    } finally {
      setRunning(false);
    }
  };

  const selectReport = (report: CompetitorReport) => {
    setCurrent(report);
    setDomain(report.domain);
    setActiveTab("competitors");
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
            <Users className="h-3.5 w-3.5" />
            Discover your rivals
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Competitor Analysis</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              Uncover who you&apos;re competing with in the SERPs — overlapping keywords, content
              gaps, traffic estimates and an AI-written summary of the competitive landscape.
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
            Enter your domain (e.g. yourdomain.com) to find up to 5 competitors and keyword gaps.
            Each analysis costs 1 credit.
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
                  placeholder="yourdomain.com"
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
                    Find competitors
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {running && <CompetitorsSkeleton />}

      {/* Results */}
      {!running && current && (
        <CompetitorResults
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

      {/* Empty state */}
      {!running && !current && reports.length === 0 && !loadingHistory && (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Users className="h-6 w-6 text-brand-500" />}
              title="Discover your competitors"
              description="Enter your domain above to generate an AI-powered competitive analysis."
              action={
                <Button
                  variant="gradient"
                  onClick={() => analyze("example.com")}
                  disabled={running}
                >
                  <Users className="h-4 w-4" />
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

function CompetitorResults({
  report,
  activeTab,
  onTabChange,
  creditsLeft,
  reports,
  loadingHistory,
  onRefreshHistory,
  onSelectReport,
}: {
  report: CompetitorReport;
  activeTab: string;
  onTabChange: (tab: string) => void;
  creditsLeft: number | null;
  reports: CompetitorReport[];
  loadingHistory: boolean;
  onRefreshHistory: () => void;
  onSelectReport: (report: CompetitorReport) => void;
}) {
  const analysis = report.results;
  const maxOverlap = useMemo(
    () => analysis.competitors.reduce((max, c) => Math.max(max, c.keywords_overlap), 0) || 1,
    [analysis.competitors]
  );

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-emerald-700 text-white shadow-sm">
              <Users className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink-900">{analysis.domain}</p>
              <p className="flex items-center gap-1.5 text-xs text-ink-500">
                <Clock className="h-3 w-3" />
                Analyzed {formatDate(report.created_at)}
                {creditsLeft !== null && <span> · {creditsLeft} credits left</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="px-2.5">
              <Users className="h-3 w-3" />
              {analysis.competitors.length} competitors
            </Badge>
            <Badge variant="outline" className="px-2.5">
              <Hash className="h-3 w-3" />
              {analysis.shared_keywords.length} shared
            </Badge>
            <Badge variant="warning" className="px-2.5">
              <Target className="h-3 w-3" />
              {analysis.gaps.length} gaps
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Summary card */}
      <Card className="overflow-hidden border-l-4 border-l-brand-500">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-brand-600" />
            AI summary
          </CardTitle>
          <CardDescription className="text-xs">
            Auto-generated competitive landscape overview for {analysis.domain}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-ink-700">{analysis.summary}</p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detailed breakdown</CardTitle>
          <CardDescription className="text-xs">
            Competitors, shared keywords, content gaps and full history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="competitors">
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Competitors</span>
                <span className="sm:hidden">Rivals</span>
              </TabsTrigger>
              <TabsTrigger value="shared">
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Shared</span>
                <span className="sm:hidden">Shared</span>
              </TabsTrigger>
              <TabsTrigger value="gaps">
                <Target className="h-3.5 w-3.5" />
                Gaps
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-3.5 w-3.5" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="competitors" className="mt-4">
              <CompetitorGrid competitors={analysis.competitors} maxOverlap={maxOverlap} />
            </TabsContent>

            <TabsContent value="shared" className="mt-4">
              <SharedKeywords keywords={analysis.shared_keywords} />
            </TabsContent>

            <TabsContent value="gaps" className="mt-4">
              <ContentGaps gaps={analysis.gaps} />
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

function CompetitorGrid({
  competitors,
  maxOverlap,
}: {
  competitors: Competitor[];
  maxOverlap: number;
}) {
  if (!competitors || competitors.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="No competitors found"
        description="The AI didn't surface any competitors for this domain. Try a different domain."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {competitors.map((c, idx) => {
        const overlapPct = Math.round((c.keywords_overlap / maxOverlap) * 100);
        const url = c.domain.includes("://") ? c.domain : `https://${c.domain}`;
        return (
          <Card key={`${c.domain}-${idx}`} className="card-hover flex flex-col overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <Globe className="h-4 w-4 shrink-0 text-brand-600" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-brand-700 hover:text-brand-900 hover:underline"
                      title={c.domain}
                    >
                      {truncate(getDomain(c.domain) || c.domain, 24)}
                    </a>
                    <ExternalLink className="h-3 w-3 shrink-0 text-ink-300" />
                  </CardTitle>
                  <CardDescription className="mt-1 truncate text-xs">
                    {getDomain(c.domain) || c.domain}
                  </CardDescription>
                </div>
                <Badge variant={COMPETITION_VARIANT[c.competition_level]} className="shrink-0 px-2 py-0.5 text-[10px]">
                  {COMPETITION_LABEL[c.competition_level]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Traffic estimate</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-ink-900">
                  {formatCompact(c.traffic_estimate)}
                  <span className="ml-1 text-xs font-medium text-ink-400">visits/mo</span>
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium uppercase tracking-wide text-ink-500">Keyword overlap</span>
                  <span className="font-semibold tabular-nums text-ink-700">
                    {formatNumber(c.keywords_overlap)}
                  </span>
                </div>
                <Progress
                  value={overlapPct}
                  className="mt-1.5 h-1.5"
                  indicatorClassName="bg-gradient-to-r from-brand-500 to-emerald-500"
                />
              </div>
            </CardContent>
            <CardFooter className="border-t border-ink-100 bg-ink-50/40 px-4 py-2.5">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-900"
              >
                View details
                <ArrowRight className="h-3 w-3" />
              </a>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

function SharedKeywords({ keywords }: { keywords: string[] }) {
  if (!keywords || keywords.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="h-6 w-6" />}
        title="No shared keywords"
        description="The AI didn't find keyword overlap between this domain and its competitors."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-600">
        <span className="font-semibold text-ink-900">{keywords.length}</span> keywords both you and
        your competitors are ranking for.
      </p>
      <div className="flex flex-wrap gap-2">
        {keywords.map((kw, idx) => (
          <Badge key={`${kw}-${idx}`} variant="outline" className="px-3 py-1 text-sm">
            <Hash className="h-3 w-3 text-ink-400" />
            {kw}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ContentGaps({ gaps }: { gaps: string[] }) {
  if (!gaps || gaps.length === 0) {
    return (
      <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/30">
        <CardContent className="flex items-start gap-3 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-emerald-900">No gaps found</p>
            <p className="mt-1 text-sm text-emerald-700">
              You&apos;re covering all the keywords your competitors rank for. Great work!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Crosshair className="h-4 w-4 text-amber-500" />
          Content gaps
        </CardTitle>
        <CardDescription className="text-xs">
          Keywords your competitors rank for but you don&apos;t.{" "}
          <span className="font-semibold text-amber-700">{gaps.length} opportunities</span> to close
          the gap.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {gaps.map((kw, idx) => (
            <Badge key={`${kw}-${idx}`} variant="warning" className="px-3 py-1 text-sm">
              <Target className="h-3 w-3" />
              {kw}
            </Badge>
          ))}
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
  reports: CompetitorReport[];
  loading: boolean;
  onRefresh: () => void;
  onSelect: (report: CompetitorReport) => void;
  embedded?: boolean;
}) {
  return (
    <div className={embedded ? "" : "contents"}>
      <Card className={embedded ? "border-0 shadow-none" : ""}>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-ink-400" />
              {embedded ? "Past analyses" : "Recent reports"}
            </CardTitle>
            <CardDescription>
              {embedded
                ? "Click any report to view its full breakdown."
                : "Your recent competitor analyses."}
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
                icon={<Users className="h-6 w-6" />}
                title="No reports yet"
                description="Your competitor analyses will appear here."
              />
            </div>
          ) : (
            <ul className="max-h-[420px] divide-y divide-ink-100 overflow-y-auto">
              {reports.map((report) => (
                <li key={report.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(report)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50/70"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <Users className="h-4 w-4" />
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
                        {report.results.competitors.length} rivals
                      </Badge>
                      {report.results.gaps.length > 0 && (
                        <Badge variant="warning" className="px-2 py-0 text-[10px]">
                          {report.results.gaps.length} gaps
                        </Badge>
                      )}
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

function CompetitorsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
      {/* Tabs skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-3 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-9 w-full" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-3 h-6 w-24" />
                  <Skeleton className="mt-3 h-2 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
