"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Globe,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Plus,
  Crosshair,
  X,
  ExternalLink,
  History,
  RefreshCw,
  Clock,
  Award,
  Gauge,
  Zap,
  Users,
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
  scoreColor,
  truncate,
} from "@/lib/utils";

/* ----------------------------- Types & helpers ---------------------------- */

type Impact = "low" | "medium" | "high";
type Effort = "low" | "medium" | "high";

interface ActionPlanItem {
  priority: number;
  task: string;
  impact: Impact;
  effort: Effort;
  timeline: string;
}

interface CompetitorComparison {
  domain: string;
  traffic: string;
  keywords: string;
  authority: number;
}

interface SeoReportResult {
  domain: string;
  reportDate: string;
  executiveSummary: string;
  overallScore: number;
  scores: {
    technical: number;
    content: number;
    onpage: number;
    ux: number;
    authority: number;
  };
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  actionPlan: ActionPlanItem[];
  competitorComparison: CompetitorComparison[];
}

interface SeoReport {
  id: string;
  domain: string;
  results: SeoReportResult;
  created_at: string;
}

const IMPACT_VARIANT: Record<Impact, "destructive" | "warning" | "secondary"> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

const EFFORT_VARIANT: Record<Effort, "success" | "warning" | "destructive"> = {
  low: "success",
  medium: "warning",
  high: "destructive",
};

const SCORE_LABELS: { key: keyof SeoReportResult["scores"]; label: string; icon: typeof Gauge }[] = [
  { key: "technical", label: "Technical", icon: Gauge },
  { key: "content", label: "Content", icon: FileText },
  { key: "onpage", label: "On-Page", icon: CheckCircle2 },
  { key: "ux", label: "UX", icon: Zap },
  { key: "authority", label: "Authority", icon: Award },
];

function normalizeDomainInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.includes("://") ? trimmed : `https://${trimmed}`;
}

function strengthLabel(score: number) {
  if (score >= 80) return { label: "Strong", variant: "success" as const };
  if (score >= 60) return { label: "Average", variant: "warning" as const };
  if (score >= 40) return { label: "Needs work", variant: "warning" as const };
  return { label: "Weak", variant: "destructive" as const };
}

/* --------------------------------- Page ---------------------------------- */

export default function SeoReportPage() {
  const { toast } = useToast();

  const [domain, setDomain] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState("");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<SeoReport | null>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  const [reports, setReports] = useState<SeoReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/seo-report", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load SEO reports");
      const list: SeoReport[] = json.data || [];
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

  const analyze = async (overrideDomain?: string) => {
    const raw = (overrideDomain ?? domain).trim();
    if (!raw) {
      toast("warning", "Enter a domain", "Provide a domain or URL to audit.");
      return;
    }
    const normalized = normalizeDomainInput(raw);
    setRunning(true);
    setCurrent(null);
    try {
      const res = await fetch("/api/seo-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: normalized,
          competitors: competitors.length ? competitors : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "SEO report failed");
      const report: SeoReport | undefined = json.data?.report;
      if (!report) throw new Error("Malformed response from server");
      if (json.data?.credits_left !== undefined) setCreditsLeft(json.data.credits_left);
      setCurrent(report);
      toast(
        "success",
        "Report complete",
        `${report.domain} scored ${report.results.overallScore}/100`
      );
      const fresh = await loadHistory();
      const match = fresh.find((r) => r.id === report.id);
      if (match) setCurrent(match);
      setActiveTab("summary");
    } catch (err) {
      toast("error", "Audit failed", err instanceof Error ? err.message : "Try again later");
    } finally {
      setRunning(false);
    }
  };

  const selectReport = (report: SeoReport) => {
    setCurrent(report);
    setDomain(report.domain);
    setActiveTab("summary");
    toast("info", "Loaded report", `${report.domain} · ${formatDate(report.created_at)}`);
  };

  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !running) analyze();
  };

  const summaryParagraphs = useMemo(() => {
    if (!current?.results.executiveSummary) return [];
    return current.results.executiveSummary
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [current]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl gradient-brand p-6 sm:p-8">
        <div className="absolute inset-0 gradient-hero opacity-60" />
        <div className="relative flex flex-col gap-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            <FileText className="h-3.5 w-3.5" />
            Comprehensive SEO audit
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">SEO Report Generator</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              Generate a full audit covering technical, content, on-page, UX and authority factors —
              with SWOT analysis, a prioritised action plan, and competitor comparison.
            </p>
          </div>
        </div>
      </section>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-brand-600" />
            Run a new audit
          </CardTitle>
          <CardDescription>
            Enter your domain and up to 5 competitors. The audit costs 3 credits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  id="domain"
                  placeholder="example.com"
                  className="pl-9"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  onKeyDown={submitOnEnter}
                  disabled={running}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="competitor">Competitor (optional, max 5)</Label>
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
              {creditsLeft !== null ? `${creditsLeft} credits remaining` : "Costs 3 credits per audit"}
            </p>
            <Button variant="gradient" onClick={() => analyze()} disabled={running}>
              {running ? <Spinner size="sm" /> : <Sparkles className="h-4 w-4" />}
              {running ? "Generating report…" : "Generate report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading skeleton */}
      {running && <ReportSkeleton />}

      {/* Results */}
      {!running && current && (
        <ReportResults
          report={current}
          creditsLeft={creditsLeft}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          summaryParagraphs={summaryParagraphs}
        />
      )}

      {/* Empty / History */}
      {!running && !current && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <History className="h-5 w-5 text-brand-600" />
                Recent reports
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadHistory()}
                disabled={loadingHistory}
              >
                <RefreshCw className={cn("h-4 w-4", loadingHistory && "animate-spin")} />
                Refresh
              </Button>
            </CardTitle>
            <CardDescription>Your last 20 generated SEO reports.</CardDescription>
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
                icon={<FileText className="h-6 w-6" />}
                title="No SEO reports yet"
                description="Run your first comprehensive audit to see scores, SWOT, action plan and competitors."
                action={
                  <Button
                    variant="gradient"
                    onClick={() => {
                      setDomain("example.com");
                      analyze("example.com");
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    Try with example.com
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {reports.map((r) => {
                  const score = r.results.overallScore;
                  const variant = strengthLabel(score).variant;
                  return (
                    <button
                      key={r.id}
                      onClick={() => selectReport(r)}
                      className="card-hover text-left rounded-lg border border-ink-200 bg-white p-4 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-ink-900">{r.domain}</p>
                        <Badge variant={variant}>{score}/100</Badge>
                      </div>
                      <p className="mt-2 flex items-center gap-1 text-xs text-ink-500">
                        <Clock className="h-3 w-3" />
                        {formatDate(r.created_at)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.results.actionPlan.slice(0, 2).map((a) => (
                          <Badge key={a.priority} variant="outline" className="text-[10px]">
                            #{a.priority} {truncate(a.task, 30)}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------ Sub-components ----------------------------- */

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Skeleton className="h-44 w-44 rounded-full" />
            <Skeleton className="mt-4 h-4 w-32" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </div>
  );
}

function ReportResults({
  report,
  creditsLeft,
  activeTab,
  setActiveTab,
  summaryParagraphs,
}: {
  report: SeoReport;
  creditsLeft: number | null;
  activeTab: string;
  setActiveTab: (t: string) => void;
  summaryParagraphs: string[];
}) {
  const r = report.results;
  const strength = strengthLabel(r.overallScore);
  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-brand-600" />
          <div>
            <p className="font-semibold text-ink-900">{report.domain}</p>
            <p className="text-xs text-ink-500">
              Report date: {r.reportDate} · Generated {formatDate(report.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {creditsLeft !== null && (
            <Badge variant="outline">
              <Award className="h-3 w-3" />
              {creditsLeft} credits
            </Badge>
          )}
          <Badge variant={strength.variant}>{strength.label}</Badge>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center justify-center py-6">
            <ScoreGauge score={r.overallScore} size="lg" label="Overall" />
            <p className="mt-3 text-xs text-ink-500">Overall SEO score</p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-brand-600" />
              Executive summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {summaryParagraphs.length === 0 ? (
              <p className="text-sm text-ink-500">No summary available.</p>
            ) : (
              summaryParagraphs.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-ink-700">
                  {p}
                </p>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sub-scores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {SCORE_LABELS.map(({ key, label, icon: Icon }) => {
          const score = r.scores[key] || 0;
          const color = scoreColor(score);
          return (
            <Card key={key}>
              <CardContent className="space-y-3 py-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                    {label}
                  </span>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div className="text-2xl font-bold tabular-nums" style={{ color }}>
                  {score}
                </div>
                <Progress value={score} indicatorClassName="" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <TabsTrigger value="summary">
            <Sparkles className="h-3.5 w-3.5" />
            SWOT
          </TabsTrigger>
          <TabsTrigger value="action">
            <Zap className="h-3.5 w-3.5" />
            Action plan
            <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
              {r.actionPlan.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="competitors">
            <Users className="h-3.5 w-3.5" />
            Competitors
          </TabsTrigger>
          <TabsTrigger value="strengths">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Strengths
          </TabsTrigger>
          <TabsTrigger value="weaknesses" className="col-span-2 sm:col-span-1">
            <AlertCircle className="h-3.5 w-3.5" />
            Weaknesses
          </TabsTrigger>
        </TabsList>

        {/* SWOT */}
        <TabsContent value="summary" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <SwotCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="Strengths"
              tone="success"
              items={r.strengths}
            />
            <SwotCard
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Weaknesses"
              tone="destructive"
              items={r.weaknesses}
            />
            <SwotCard
              icon={<TrendingUp className="h-4 w-4" />}
              title="Opportunities"
              tone="info"
              items={r.opportunities}
            />
            <SwotCard
              icon={<Crosshair className="h-4 w-4" />}
              title="Threats"
              tone="warning"
              items={r.threats}
            />
          </div>
        </TabsContent>

        {/* Action plan */}
        <TabsContent value="action" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-brand-600" />
                Prioritised action plan
              </CardTitle>
              <CardDescription>
                {r.actionPlan.length} tasks ordered by priority. Impact × effort helps you sequence fast wins first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                      <th className="py-2 pr-3 font-medium">#</th>
                      <th className="py-2 pr-3 font-medium">Task</th>
                      <th className="py-2 pr-3 font-medium">Impact</th>
                      <th className="py-2 pr-3 font-medium">Effort</th>
                      <th className="py-2 font-medium">Timeline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.actionPlan
                      .slice()
                      .sort((a, b) => a.priority - b.priority)
                      .map((item) => (
                        <tr key={item.priority} className="border-b border-ink-100 last:border-0 hover:bg-brand-50/30">
                          <td className="py-3 pr-3 font-semibold tabular-nums text-ink-900">
                            {item.priority}
                          </td>
                          <td className="py-3 pr-3 text-ink-800">{item.task}</td>
                          <td className="py-3 pr-3">
                            <Badge variant={IMPACT_VARIANT[item.impact]} className="capitalize">
                              {item.impact}
                            </Badge>
                          </td>
                          <td className="py-3 pr-3">
                            <Badge variant={EFFORT_VARIANT[item.effort]} className="capitalize">
                              {item.effort}
                            </Badge>
                          </td>
                          <td className="py-3 text-ink-600">{item.timeline}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Competitors */}
        <TabsContent value="competitors" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-brand-600" />
                Competitor comparison
              </CardTitle>
              <CardDescription>
                Includes the target domain and competitors with traffic, keyword and authority estimates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                      <th className="py-2 pr-3 font-medium">Domain</th>
                      <th className="py-2 pr-3 font-medium">Traffic</th>
                      <th className="py-2 pr-3 font-medium">Keywords</th>
                      <th className="py-2 font-medium">Authority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.competitorComparison.map((c) => {
                      const isTarget = c.domain === report.domain;
                      const color = scoreColor(c.authority);
                      return (
                        <tr
                          key={c.domain}
                          className={cn(
                            "border-b border-ink-100 last:border-0 hover:bg-brand-50/30",
                            isTarget && "bg-brand-50/40"
                          )}
                        >
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-2">
                              <a
                                href={`https://${c.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 font-medium text-ink-900 hover:underline"
                              >
                                {c.domain}
                                <ExternalLink className="h-3 w-3 text-ink-400" />
                              </a>
                              {isTarget && <Badge variant="default">You</Badge>}
                            </div>
                          </td>
                          <td className="py-3 pr-3 text-ink-700">{c.traffic}</td>
                          <td className="py-3 pr-3 text-ink-700">{c.keywords}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16">
                                <Progress
                                  value={c.authority}
                                  indicatorClassName=""
                                />
                              </div>
                              <span className="tabular-nums font-medium" style={{ color }}>
                                {c.authority}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Strengths */}
        <TabsContent value="strengths" className="mt-4">
          <SwotList
            title="Strengths"
            tone="success"
            icon={<CheckCircle2 className="h-4 w-4" />}
            items={r.strengths}
          />
        </TabsContent>

        {/* Weaknesses */}
        <TabsContent value="weaknesses" className="mt-4">
          <SwotList
            title="Weaknesses"
            tone="destructive"
            icon={<AlertTriangle className="h-4 w-4" />}
            items={r.weaknesses}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type SwotTone = "success" | "destructive" | "info" | "warning";

function SwotCard({
  icon,
  title,
  tone,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  tone: SwotTone;
  items: string[];
}) {
  const toneClasses: Record<SwotTone, string> = {
    success: "border-l-emerald-500 bg-emerald-50/30",
    destructive: "border-l-red-500 bg-red-50/30",
    info: "border-l-blue-500 bg-blue-50/30",
    warning: "border-l-amber-500 bg-amber-50/30",
  };
  return (
    <Card className={cn("border-l-4", toneClasses[tone])}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-auto">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="text-sm text-ink-500">Nothing identified.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-300" />
                {item}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SwotList({
  title,
  tone,
  icon,
  items,
}: {
  title: string;
  tone: SwotTone;
  icon: React.ReactNode;
  items: string[];
}) {
  return (
    <SwotCard icon={icon} title={title} tone={tone} items={items} />
  );
}
