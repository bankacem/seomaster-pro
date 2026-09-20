"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Store,
  Sparkles,
  Search,
  Award,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  ExternalLink,
  History,
  RefreshCw,
  Clock,
  Target,
  Users,
  Hash,
  Lightbulb,
  Briefcase,
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
  truncate,
  scoreColor,
} from "@/lib/utils";

/* ----------------------------- Types & helpers ---------------------------- */

type ChecklistStatus = "pass" | "fail" | "warning";
type Importance = "critical" | "high" | "medium" | "low";
type Difficulty = "low" | "medium" | "high";

interface ChecklistItem {
  item: string;
  status: ChecklistStatus;
  importance: Importance;
  recommendation: string;
}

interface CitationOpportunity {
  directory: string;
  url: string;
  difficulty: Difficulty;
}

interface LocalSeoResult {
  businessName: string;
  location: string;
  industry: string;
  localSeoScore: number;
  checklist: ChecklistItem[];
  localKeywords: string[];
  competitors: string[];
  citationOpportunities: CitationOpportunity[];
  summary: string;
}

interface LocalSeoReport {
  id: string;
  domain: string;
  results: LocalSeoResult;
  created_at: string;
}

const STATUS_META: Record<
  ChecklistStatus,
  { variant: "success" | "destructive" | "warning"; icon: typeof CheckCircle2; label: string }
> = {
  pass: { variant: "success", icon: CheckCircle2, label: "Pass" },
  fail: { variant: "destructive", icon: XCircle, label: "Fail" },
  warning: { variant: "warning", icon: AlertTriangle, label: "Warning" },
};

const IMPORTANCE_VARIANT: Record<Importance, "destructive" | "warning" | "info" | "secondary"> = {
  critical: "destructive",
  high: "warning",
  medium: "info",
  low: "secondary",
};

const DIFFICULTY_VARIANT: Record<Difficulty, "success" | "warning" | "destructive"> = {
  low: "success",
  medium: "warning",
  high: "destructive",
};

/* --------------------------------- Page ---------------------------------- */

export default function LocalSeoPage() {
  const { toast } = useToast();

  const [businessName, setBusinessName] = useState("");
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState("");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<LocalSeoReport | null>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  const [reports, setReports] = useState<LocalSeoReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState("checklist");

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/local-seo", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load local SEO reports");
      const list: LocalSeoReport[] = json.data || [];
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

  const analyze = async (override?: { businessName: string; location: string; industry: string }) => {
    const bn = (override?.businessName ?? businessName).trim();
    const loc = (override?.location ?? location).trim();
    const ind = (override?.industry ?? industry).trim();
    if (!bn || !loc || !ind) {
      toast("warning", "All fields required", "Provide business name, location and industry.");
      return;
    }
    setRunning(true);
    setCurrent(null);
    try {
      const res = await fetch("/api/local-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: bn, location: loc, industry: ind }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Local SEO analysis failed");
      const report: LocalSeoReport | undefined = json.data?.report;
      if (!report) throw new Error("Malformed response from server");
      if (json.data?.credits_left !== undefined) setCreditsLeft(json.data.credits_left);
      setCurrent(report);
      toast("success", "Analysis complete", `${report.results.businessName} scored ${report.results.localSeoScore}/100`);
      const fresh = await loadHistory();
      const match = fresh.find((r) => r.id === report.id);
      if (match) setCurrent(match);
      setActiveTab("checklist");
    } catch (err) {
      toast("error", "Analysis failed", err instanceof Error ? err.message : "Try again later");
    } finally {
      setRunning(false);
    }
  };

  const selectReport = (report: LocalSeoReport) => {
    setCurrent(report);
    setBusinessName(report.results.businessName);
    setLocation(report.results.location);
    setIndustry(report.results.industry);
    setActiveTab("checklist");
    toast("info", "Loaded report", `${report.results.businessName} · ${formatDate(report.created_at)}`);
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
            <MapPin className="h-3.5 w-3.5" />
            Local pack & Maps optimisation
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Local SEO Checker</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              Audit a local business&apos;s presence in Google Maps and the local pack — GBP claim
              status, citation opportunities, local keywords and competitor list.
            </p>
          </div>
        </div>
      </section>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-brand-600" />
            Run a local SEO audit
          </CardTitle>
          <CardDescription>
            Provide the business name, location and industry. Each audit costs 1 credit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="business">Business name</Label>
              <div className="relative">
                <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  id="business"
                  placeholder="Joe's Pizza"
                  className="pl-9"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  onKeyDown={submitOnEnter}
                  disabled={running}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  id="location"
                  placeholder="Brooklyn, NY"
                  className="pl-9"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={submitOnEnter}
                  disabled={running}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <div className="relative">
                <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  id="industry"
                  placeholder="Pizza restaurant"
                  className="pl-9"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  onKeyDown={submitOnEnter}
                  disabled={running}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-ink-500">
              {creditsLeft !== null ? `${creditsLeft} credits remaining` : "Costs 1 credit per audit"}
            </p>
            <Button variant="gradient" onClick={() => analyze()} disabled={running}>
              {running ? <Spinner size="sm" /> : <Sparkles className="h-4 w-4" />}
              {running ? "Analysing…" : "Run audit"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {running && <LocalSeoSkeleton />}

      {/* Results */}
      {!running && current && (
        <LocalSeoResults
          report={current}
          creditsLeft={creditsLeft}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      )}

      {/* Empty / History */}
      {!running && !current && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <History className="h-5 w-5 text-brand-600" />
                Recent audits
              </span>
              <Button variant="ghost" size="sm" onClick={() => loadHistory()} disabled={loadingHistory}>
                <RefreshCw className={cn("h-4 w-4", loadingHistory && "animate-spin")} />
                Refresh
              </Button>
            </CardTitle>
            <CardDescription>Your last 20 local SEO audits.</CardDescription>
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
                icon={<MapPin className="h-6 w-6" />}
                title="No local SEO audits yet"
                description="Run your first audit to see local pack checklist, citations and competitor list."
                action={
                  <Button
                    variant="gradient"
                    onClick={() => {
                      const demo = { businessName: "Joe's Pizza", location: "Brooklyn, NY", industry: "Pizza restaurant" };
                      setBusinessName(demo.businessName);
                      setLocation(demo.location);
                      setIndustry(demo.industry);
                      analyze(demo);
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
                      <p className="font-medium text-ink-900">{truncate(r.results.businessName, 24)}</p>
                      <Badge
                        variant={
                          r.results.localSeoScore >= 80
                            ? "success"
                            : r.results.localSeoScore >= 50
                            ? "warning"
                            : "destructive"
                        }
                      >
                        {r.results.localSeoScore}/100
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-600">
                      {truncate(r.results.industry, 24)} · {truncate(r.results.location, 24)}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-ink-500">
                      <Clock className="h-3 w-3" />
                      {formatDate(r.created_at)}
                    </p>
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

function LocalSeoSkeleton() {
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
            <Skeleton className="h-3 w-3/4" />
          </CardContent>
        </Card>
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

function LocalSeoResults({
  report,
  creditsLeft,
  activeTab,
  setActiveTab,
}: {
  report: LocalSeoReport;
  creditsLeft: number | null;
  activeTab: string;
  setActiveTab: (t: string) => void;
}) {
  const r = report.results;

  const counts = useMemo(() => {
    const c = { pass: 0, fail: 0, warning: 0 };
    r.checklist.forEach((item) => {
      c[item.status] += 1;
    });
    return c;
  }, [r.checklist]);

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Store className="h-5 w-5 text-brand-600" />
          <div>
            <p className="font-semibold text-ink-900">{r.businessName}</p>
            <p className="text-xs text-ink-500">
              {r.industry} · {r.location} · Generated {formatDate(report.created_at)}
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
          <Badge variant="info">
            <CheckCircle2 className="h-3 w-3" />
            {counts.pass} pass
          </Badge>
          {counts.warning > 0 && (
            <Badge variant="warning">
              <AlertTriangle className="h-3 w-3" />
              {counts.warning} warn
            </Badge>
          )}
          {counts.fail > 0 && (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3" />
              {counts.fail} fail
            </Badge>
          )}
        </div>
      </div>

      {/* Score + summary */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center justify-center py-6">
            <ScoreGauge score={r.localSeoScore} size="lg" label="Local SEO" />
            <p className="mt-3 text-xs text-ink-500">Overall local SEO score</p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-brand-600" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm leading-relaxed text-ink-700">{r.summary}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-emerald-50 py-2">
                <p className="text-lg font-bold tabular-nums text-emerald-600">{counts.pass}</p>
                <p className="text-[10px] uppercase tracking-wide text-ink-500">Pass</p>
              </div>
              <div className="rounded-md bg-amber-50 py-2">
                <p className="text-lg font-bold tabular-nums text-amber-600">{counts.warning}</p>
                <p className="text-[10px] uppercase tracking-wide text-ink-500">Warning</p>
              </div>
              <div className="rounded-md bg-red-50 py-2">
                <p className="text-lg font-bold tabular-nums text-red-600">{counts.fail}</p>
                <p className="text-[10px] uppercase tracking-wide text-ink-500">Fail</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="checklist">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Checklist
            <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
              {r.checklist.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="keywords">
            <Hash className="h-3.5 w-3.5" />
            Keywords
          </TabsTrigger>
          <TabsTrigger value="competitors">
            <Users className="h-3.5 w-3.5" />
            Competitors
          </TabsTrigger>
          <TabsTrigger value="citations">
            <ExternalLink className="h-3.5 w-3.5" />
            Citations
          </TabsTrigger>
        </TabsList>

        {/* Checklist */}
        <TabsContent value="checklist" className="mt-4 space-y-2">
          {r.checklist.map((item, idx) => {
            const meta = STATUS_META[item.status];
            const Icon = meta.icon;
            return (
              <Card key={idx} className="card-hover">
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Icon
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          item.status === "pass" && "text-emerald-500",
                          item.status === "fail" && "text-red-500",
                          item.status === "warning" && "text-amber-500"
                        )}
                      />
                      <div>
                        <p className="font-medium text-ink-900">{item.item}</p>
                        <p className="mt-1 text-sm text-ink-600">{item.recommendation}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      <Badge variant={IMPORTANCE_VARIANT[item.importance]} className="capitalize">
                        {item.importance}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Keywords */}
        <TabsContent value="keywords" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Hash className="h-4 w-4 text-brand-600" />
                Local keyword opportunities
              </CardTitle>
              <CardDescription>
                Long-tail and &quot;near me&quot; keywords to target for local visibility.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {r.localKeywords.length === 0 ? (
                <EmptyState
                  icon={<Hash className="h-6 w-6" />}
                  title="No keyword suggestions"
                  description="Try a different business or industry."
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {r.localKeywords.map((kw, i) => (
                    <Badge key={`${kw}-${i}`} variant="outline" className="py-1.5">
                      <Target className="h-3 w-3" />
                      {kw}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Competitors */}
        <TabsContent value="competitors" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-brand-600" />
                Local competitors
              </CardTitle>
              <CardDescription>Businesses competing in the same local market.</CardDescription>
            </CardHeader>
            <CardContent>
              {r.competitors.length === 0 ? (
                <EmptyState
                  icon={<Users className="h-6 w-6" />}
                  title="No competitors identified"
                  description="Try a different location."
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {r.competitors.map((c, i) => (
                    <div
                      key={`${c}-${i}`}
                      className="card-hover rounded-lg border border-ink-200 bg-white p-4"
                    >
                      <p className="font-medium text-ink-900">{c}</p>
                      <p className="mt-1 text-xs text-ink-500">Local competitor</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Citations */}
        <TabsContent value="citations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ExternalLink className="h-4 w-4 text-brand-600" />
                Citation opportunities
              </CardTitle>
              <CardDescription>
                Local directories where the business should be listed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {r.citationOpportunities.length === 0 ? (
                <EmptyState
                  icon={<ExternalLink className="h-6 w-6" />}
                  title="No citation opportunities"
                  description="Try a different industry."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                        <th className="py-2 pr-3 font-medium">Directory</th>
                        <th className="py-2 pr-3 font-medium">URL</th>
                        <th className="py-2 font-medium">Difficulty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.citationOpportunities.map((c, i) => (
                        <tr
                          key={`${c.directory}-${i}`}
                          className="border-b border-ink-100 last:border-0 hover:bg-brand-50/30"
                        >
                          <td className="py-3 pr-3 font-medium text-ink-900">{c.directory}</td>
                          <td className="py-3 pr-3">
                            <a
                              href={c.url.startsWith("http") ? c.url : `https://${c.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                            >
                              {truncate(c.url, 50)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </td>
                          <td className="py-3">
                            <Badge variant={DIFFICULTY_VARIANT[c.difficulty]} className="capitalize">
                              {c.difficulty}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
