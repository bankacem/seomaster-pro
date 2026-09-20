"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Layers,
  Globe,
  Sparkles,
  Search,
  TrendingUp,
  Target,
  DollarSign,
  Gauge,
  Plus,
  X,
  History,
  RefreshCw,
  Clock,
  Award,
  CheckCircle2,
  Eye,
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
import {
  cn,
  formatDate,
  formatNumber,
  truncate,
  scoreColor,
} from "@/lib/utils";

/* ----------------------------- Types & helpers ---------------------------- */

type Intent = "informational" | "commercial" | "transactional";
type RecommendedAction = "create-new" | "optimize-existing" | "monitor";

interface ContentGap {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  cpc: number;
  intent: Intent;
  competitorsRanking: string[];
  recommendedAction: RecommendedAction;
}

interface ContentGapResult {
  domain: string;
  competitors: string[];
  gaps: ContentGap[];
  summary: string;
  totalOpportunityScore: number;
}

interface ContentGapReport {
  id: string;
  domain: string;
  results: ContentGapResult;
  created_at: string;
}

const INTENT_META: Record<
  Intent,
  { variant: "info" | "warning" | "success"; icon: typeof Search; label: string }
> = {
  informational: { variant: "info", icon: Search, label: "Informational" },
  commercial: { variant: "warning", icon: Gauge, label: "Commercial" },
  transactional: { variant: "success", icon: DollarSign, label: "Transactional" },
};

const ACTION_META: Record<
  RecommendedAction,
  {
    variant: "default" | "warning" | "secondary";
    icon: typeof Plus;
    label: string;
  }
> = {
  "create-new": { variant: "default", icon: Plus, label: "Create new" },
  "optimize-existing": { variant: "warning", icon: Target, label: "Optimise" },
  monitor: { variant: "secondary", icon: Eye, label: "Monitor" },
};

function difficultyBand(score: number) {
  if (score <= 30) return { label: "Easy", color: "#10b981", variant: "success" as const };
  if (score <= 60) return { label: "Medium", color: "#f59e0b", variant: "warning" as const };
  return { label: "Hard", color: "#ef4444", variant: "destructive" as const };
}

function normalizeDomainInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.includes("://") ? trimmed : `https://${trimmed}`;
}

/* --------------------------------- Page ---------------------------------- */

export default function ContentGapPage() {
  const { toast } = useToast();

  const [domain, setDomain] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState("");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<ContentGapReport | null>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  const [reports, setReports] = useState<ContentGapReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState("gaps");

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/content-gap", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load content gap reports");
      const list: ContentGapReport[] = json.data || [];
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

  const addCompetitor = () => {
    const v = competitorInput.trim();
    if (!v) return;
    if (competitors.length >= 5) {
      toast("warning", "Max 5 competitors", "Remove one before adding more.");
      return;
    }
    if (competitors.includes(v)) {
      setCompetitorInput("");
      return;
    }
    setCompetitors([...competitors, v]);
    setCompetitorInput("");
  };

  const removeCompetitor = (c: string) => {
    setCompetitors(competitors.filter((x) => x !== c));
  };

  const analyze = async (overrideDomain?: string, overrideCompetitors?: string[]) => {
    const rawDomain = (overrideDomain ?? domain).trim();
    if (!rawDomain) {
      toast("warning", "Enter a domain", "Provide a domain to analyse.");
      return;
    }
    const competitorList = overrideCompetitors ?? competitors;
    if (competitorList.length === 0) {
      toast("warning", "Add at least one competitor", "Content gap analysis requires 1–5 competitors.");
      return;
    }
    const normalized = normalizeDomainInput(rawDomain);
    setRunning(true);
    setCurrent(null);
    try {
      const res = await fetch("/api/content-gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: normalized, competitors: competitorList }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Content gap analysis failed");
      const report: ContentGapReport | undefined = json.data?.report;
      if (!report) throw new Error("Malformed response from server");
      if (json.data?.credits_left !== undefined) setCreditsLeft(json.data.credits_left);
      setCurrent(report);
      toast(
        "success",
        "Analysis complete",
        `${report.results.gaps.length} content gaps found`
      );
      const fresh = await loadHistory();
      const match = fresh.find((r) => r.id === report.id);
      if (match) setCurrent(match);
      setActiveTab("gaps");
    } catch (err) {
      toast("error", "Analysis failed", err instanceof Error ? err.message : "Try again later");
    } finally {
      setRunning(false);
    }
  };

  const selectReport = (report: ContentGapReport) => {
    setCurrent(report);
    setDomain(report.domain);
    setCompetitors(report.results.competitors || []);
    setActiveTab("gaps");
    toast("info", "Loaded report", `${report.domain} · ${formatDate(report.created_at)}`);
  };

  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !running) analyze();
  };

  const sortedGaps = useMemo(() => {
    if (!current) return [];
    return [...current.results.gaps].sort((a, b) => b.searchVolume - a.searchVolume);
  }, [current]);

  const actionCounts = useMemo(() => {
    const counts: Record<RecommendedAction, number> = {
      "create-new": 0,
      "optimize-existing": 0,
      monitor: 0,
    };
    current?.results.gaps.forEach((g) => {
      counts[g.recommendedAction] = (counts[g.recommendedAction] || 0) + 1;
    });
    return counts;
  }, [current]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl gradient-brand p-6 sm:p-8">
        <div className="absolute inset-0 gradient-hero opacity-60" />
        <div className="relative flex flex-col gap-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            <Layers className="h-3.5 w-3.5" />
            Spot keyword opportunities
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Content Gap Analysis</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              Discover keywords your competitors rank for but you don&apos;t — with search volume,
              difficulty, intent and a recommended action for each gap.
            </p>
          </div>
        </div>
      </section>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-brand-600" />
            Run a new analysis
          </CardTitle>
          <CardDescription>
            Enter your domain and 1–5 competitors. The analysis costs 2 credits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domain">Your domain</Label>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input
                id="domain"
                placeholder="yoursite.com"
                className="pl-9"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={submitOnEnter}
                disabled={running}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="competitor">Competitors (1–5 required)</Label>
            <div className="flex gap-2">
              <Input
                id="competitor"
                placeholder="competitor.com"
                value={competitorInput}
                onChange={(e) => setCompetitorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCompetitor();
                  }
                }}
                disabled={running}
              />
              <Button type="button" variant="outline" onClick={addCompetitor} disabled={running}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
          {competitors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {competitors.map((c) => (
                <Badge key={c} variant="outline" className="gap-1">
                  {c}
                  <button
                    type="button"
                    onClick={() => removeCompetitor(c)}
                    className="ml-1 rounded-full p-0.5 hover:bg-ink-100"
                    aria-label={`Remove ${c}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-ink-500">
              {creditsLeft !== null ? `${creditsLeft} credits remaining` : "Costs 2 credits per analysis"}
            </p>
            <Button
              variant="gradient"
              onClick={() => analyze()}
              disabled={running}
            >
              {running ? <Spinner size="sm" /> : <Sparkles className="h-4 w-4" />}
              {running ? "Finding gaps…" : "Find content gaps"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {running && <GapSkeleton />}

      {/* Results */}
      {!running && current && (
        <GapResults
          report={current}
          creditsLeft={creditsLeft}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          sortedGaps={sortedGaps}
          actionCounts={actionCounts}
        />
      )}

      {/* Empty / History */}
      {!running && !current && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <History className="h-5 w-5 text-brand-600" />
                Recent analyses
              </span>
              <Button variant="ghost" size="sm" onClick={() => loadHistory()} disabled={loadingHistory}>
                <RefreshCw className={cn("h-4 w-4", loadingHistory && "animate-spin")} />
                Refresh
              </Button>
            </CardTitle>
            <CardDescription>Your last 20 content gap analyses.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : reports.length === 0 ? (
              <EmptyState
                icon={<Layers className="h-6 w-6" />}
                title="No content gap analyses yet"
                description="Find the keywords your competitors rank for that you're missing."
                action={
                  <Button
                    variant="gradient"
                    onClick={() => {
                      const demoCompetitors = ["ahrefs.com", "semrush.com"];
                      setDomain("moz.com");
                      setCompetitors(demoCompetitors);
                      analyze("moz.com", demoCompetitors);
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    Try a demo
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {reports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => selectReport(r)}
                    className="card-hover text-left rounded-lg border border-ink-200 bg-white p-4 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-ink-900">{r.domain}</p>
                      <Badge variant="secondary">{r.results.gaps.length} gaps</Badge>
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-xs text-ink-500">
                      <Clock className="h-3 w-3" />
                      {formatDate(r.created_at)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.results.competitors.slice(0, 3).map((c) => (
                        <Badge key={c} variant="outline" className="text-[10px]">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------ Sub-components ----------------------------- */

function GapSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

function GapResults({
  report,
  creditsLeft,
  activeTab,
  setActiveTab,
  sortedGaps,
  actionCounts,
}: {
  report: ContentGapReport;
  creditsLeft: number | null;
  activeTab: string;
  setActiveTab: (t: string) => void;
  sortedGaps: ContentGap[];
  actionCounts: Record<RecommendedAction, number>;
}) {
  const r = report.results;
  const totalGaps = r.gaps.length;
  const avgDifficulty = totalGaps
    ? Math.round(r.gaps.reduce((s, g) => s + g.difficulty, 0) / totalGaps)
    : 0;
  const totalVolume = r.gaps.reduce((s, g) => s + (g.searchVolume || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-brand-600" />
          <div>
            <p className="font-semibold text-ink-900">{report.domain}</p>
            <p className="text-xs text-ink-500">Generated {formatDate(report.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {creditsLeft !== null && (
            <Badge variant="outline">
              <Award className="h-3 w-3" />
              {creditsLeft} credits
            </Badge>
          )}
          <Badge variant="info">
            <Target className="h-3 w-3" />
            {totalGaps} gaps
          </Badge>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-2 py-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Opportunity score
              </span>
              <Target className="h-4 w-4" style={{ color: scoreColor(r.totalOpportunityScore) }} />
            </div>
            <div className="flex items-center gap-3">
              <ScoreGauge score={r.totalOpportunityScore} size="sm" showValue label="" />
              <p className="text-xs text-ink-500">Higher = bigger combined opportunity</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 py-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Total gaps
              </span>
              <Layers className="h-4 w-4 text-brand-600" />
            </div>
            <p className="text-2xl font-bold tabular-nums text-ink-900">{totalGaps}</p>
            <p className="text-xs text-ink-500">across {r.competitors.length} competitors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 py-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Total search volume
              </span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold tabular-nums text-ink-900">
              {formatNumber(totalVolume)}
            </p>
            <p className="text-xs text-ink-500">monthly searches combined</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 py-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Avg difficulty
              </span>
              <Gauge
                className="h-4 w-4"
                style={{ color: difficultyBand(avgDifficulty).color }}
              />
            </div>
            <p
              className="text-2xl font-bold tabular-nums"
              style={{ color: difficultyBand(avgDifficulty).color }}
            >
              {avgDifficulty}
            </p>
            <p className="text-xs text-ink-500">{difficultyBand(avgDifficulty).label}</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="border-l-4 border-l-brand-500 bg-brand-50/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-brand-600" />
            Strategic advice
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm leading-relaxed text-ink-700">{r.summary}</p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="gaps">
            <Layers className="h-3.5 w-3.5" />
            All gaps
            <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
              {totalGaps}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="create-new">
            <Plus className="h-3.5 w-3.5" />
            Create
            <Badge variant="default" className="ml-1 hidden sm:inline-flex">
              {actionCounts["create-new"]}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="optimize-existing">
            <Target className="h-3.5 w-3.5" />
            Optimise
            <Badge variant="warning" className="ml-1 hidden sm:inline-flex">
              {actionCounts["optimize-existing"]}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="monitor">
            <Eye className="h-3.5 w-3.5" />
            Monitor
            <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
              {actionCounts.monitor}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gaps" className="mt-4">
          <GapTable gaps={sortedGaps} filter="all" />
        </TabsContent>
        <TabsContent value="create-new" className="mt-4">
          <GapTable
            gaps={sortedGaps.filter((g) => g.recommendedAction === "create-new")}
            filter="create-new"
          />
        </TabsContent>
        <TabsContent value="optimize-existing" className="mt-4">
          <GapTable
            gaps={sortedGaps.filter((g) => g.recommendedAction === "optimize-existing")}
            filter="optimize-existing"
          />
        </TabsContent>
        <TabsContent value="monitor" className="mt-4">
          <GapTable
            gaps={sortedGaps.filter((g) => g.recommendedAction === "monitor")}
            filter="monitor"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GapTable({ gaps, filter }: { gaps: ContentGap[]; filter: string }) {
  const filtered = filter === "all" ? gaps : gaps.filter((g) => g.recommendedAction === filter);
  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-6 w-6" />}
        title="No gaps in this category"
        description="Try another tab or run a new analysis with different competitors."
      />
    );
  }
  return (
    <Card>
      <CardContent className="py-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="py-2 pr-3 font-medium">Keyword</th>
                <th className="py-2 pr-3 font-medium">Volume</th>
                <th className="py-2 pr-3 font-medium">Difficulty</th>
                <th className="py-2 pr-3 font-medium">CPC</th>
                <th className="py-2 pr-3 font-medium">Intent</th>
                <th className="py-2 pr-3 font-medium">Ranking competitors</th>
                <th className="py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g, idx) => {
                const band = difficultyBand(g.difficulty);
                const intent = INTENT_META[g.intent];
                const IntentIcon = intent.icon;
                const action = ACTION_META[g.recommendedAction];
                const ActionIcon = action.icon;
                return (
                  <tr
                    key={`${g.keyword}-${idx}`}
                    className="border-b border-ink-100 last:border-0 hover:bg-brand-50/30"
                  >
                    <td className="py-3 pr-3 font-medium text-ink-900">{g.keyword}</td>
                    <td className="py-3 pr-3 tabular-nums text-ink-700">
                      {formatNumber(g.searchVolume)}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <Progress
                            value={g.difficulty}
                            indicatorClassName=""
                          />
                        </div>
                        <span className="tabular-nums text-xs font-medium" style={{ color: band.color }}>
                          {g.difficulty}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 tabular-nums text-ink-700">
                      ${g.cpc.toFixed(2)}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge variant={intent.variant}>
                        <IntentIcon className="h-3 w-3" />
                        {intent.label}
                      </Badge>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {g.competitorsRanking.slice(0, 3).map((c) => (
                          <Badge key={c} variant="outline" className="text-[10px]">
                            {truncate(c, 22)}
                          </Badge>
                        ))}
                        {g.competitorsRanking.length > 3 && (
                          <Badge variant="secondary" className="text-[10px]">
                            +{g.competitorsRanking.length - 3}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <Badge variant={action.variant}>
                        <ActionIcon className="h-3 w-3" />
                        {action.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
