"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  Globe,
  Sparkles,
  Search,
  Target,
  DollarSign,
  Gauge,
  Award,
  History,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  Calendar,
  ArrowDownRight,
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
import { useToast } from "@/components/ui/toast";
import {
  cn,
  formatDate,
  formatNumber,
  formatCompact,
  truncate,
} from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ----------------------------- Types & helpers ---------------------------- */

interface ForecastMonth {
  month: number;
  position: number;
  traffic: number;
  revenue: number;
}

interface SeoForecastResult {
  domain: string;
  targetKeyword: string;
  monthlyBudget: number;
  currentPosition: number;
  forecast: ForecastMonth[];
  timelineToRank: string;
  totalInvestment: number;
  projectedROI: number;
  assumptions: string[];
  risks: string[];
  recommendation: string;
}

interface SeoForecastReport {
  id: string;
  domain: string;
  results: SeoForecastResult;
  created_at: string;
}

function normalizeDomainInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.includes("://") ? trimmed : `https://${trimmed}`;
}

function positionBand(pos: number) {
  if (pos <= 3) return { label: "Top 3", color: "#10b981" };
  if (pos <= 10) return { label: "Page 1", color: "#3b82f6" };
  if (pos <= 30) return { label: "Page 2-3", color: "#f59e0b" };
  return { label: "Beyond page 3", color: "#ef4444" };
}

/* --------------------------------- Page ---------------------------------- */

export default function SeoForecastPage() {
  const { toast } = useToast();

  const [domain, setDomain] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<SeoForecastReport | null>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  const [reports, setReports] = useState<SeoForecastReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState("chart");

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/seo-forecast", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load forecasts");
      const list: SeoForecastReport[] = json.data || [];
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

  const analyze = async (override?: Partial<{ domain: string; keyword: string }>) => {
    const rawDomain = (override?.domain ?? domain).trim();
    const rawKeyword = (override?.keyword ?? targetKeyword).trim();
    if (!rawDomain) {
      toast("warning", "Enter a domain", "Provide a domain or URL.");
      return;
    }
    if (!rawKeyword) {
      toast("warning", "Enter a target keyword", "Provide a keyword to forecast.");
      return;
    }
    const normalized = normalizeDomainInput(rawDomain);
    const budgetNum = parseFloat(monthlyBudget);
    const budget = Number.isFinite(budgetNum) && budgetNum > 0 ? budgetNum : undefined;
    setRunning(true);
    setCurrent(null);
    try {
      const res = await fetch("/api/seo-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: normalized,
          targetKeyword: rawKeyword,
          monthlyBudget: budget,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Forecast failed");
      const report: SeoForecastReport | undefined = json.data?.report;
      if (!report) throw new Error("Malformed response from server");
      if (json.data?.credits_left !== undefined) setCreditsLeft(json.data.credits_left);
      setCurrent(report);
      toast(
        "success",
        "Forecast ready",
        `Timeline to rank: ${report.results.timelineToRank}`
      );
      const fresh = await loadHistory();
      const match = fresh.find((r) => r.id === report.id);
      if (match) setCurrent(match);
      setActiveTab("chart");
    } catch (err) {
      toast("error", "Forecast failed", err instanceof Error ? err.message : "Try again later");
    } finally {
      setRunning(false);
    }
  };

  const selectReport = (report: SeoForecastReport) => {
    setCurrent(report);
    setDomain(report.domain);
    setTargetKeyword(report.results.targetKeyword);
    setMonthlyBudget(String(report.results.monthlyBudget || ""));
    setActiveTab("chart");
    toast("info", "Loaded forecast", `${report.domain} · ${formatDate(report.created_at)}`);
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
            <TrendingUp className="h-3.5 w-3.5" />
            12-month SEO projection
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">SEO Forecasting Tool</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              Project the 12-month trajectory of a target keyword with position, traffic, revenue
              and ROI based on your monthly budget — plus assumptions, risks and a recommendation.
            </p>
          </div>
        </div>
      </section>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-brand-600" />
            Run a new forecast
          </CardTitle>
          <CardDescription>
            Provide a domain, target keyword and an optional monthly budget. Each forecast costs 2 credits.
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
              <Label htmlFor="keyword">Target keyword</Label>
              <div className="relative">
                <Target className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  id="keyword"
                  placeholder="best running shoes"
                  className="pl-9"
                  value={targetKeyword}
                  onChange={(e) => setTargetKeyword(e.target.value)}
                  onKeyDown={submitOnEnter}
                  disabled={running}
                />
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget">Monthly budget (optional, USD)</Label>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  id="budget"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="3000"
                  className="pl-9"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  onKeyDown={submitOnEnter}
                  disabled={running}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-ink-500">
              {creditsLeft !== null ? `${creditsLeft} credits remaining` : "Costs 2 credits per forecast"}
            </p>
            <Button variant="gradient" onClick={() => analyze()} disabled={running}>
              {running ? <Spinner size="sm" /> : <Sparkles className="h-4 w-4" />}
              {running ? "Forecasting…" : "Generate forecast"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {running && <ForecastSkeleton />}

      {/* Results */}
      {!running && current && (
        <ForecastResults
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
                Recent forecasts
              </span>
              <Button variant="ghost" size="sm" onClick={() => loadHistory()} disabled={loadingHistory}>
                <RefreshCw className={cn("h-4 w-4", loadingHistory && "animate-spin")} />
                Refresh
              </Button>
            </CardTitle>
            <CardDescription>Your last 20 SEO forecasts.</CardDescription>
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
                icon={<TrendingUp className="h-6 w-6" />}
                title="No forecasts yet"
                description="Project your SEO trajectory with a 12-month position, traffic and revenue forecast."
                action={
                  <Button
                    variant="gradient"
                    onClick={() => {
                      setDomain("example.com");
                      setTargetKeyword("best running shoes");
                      analyze({ domain: "example.com", keyword: "best running shoes" });
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
                      <Badge variant="secondary">{r.results.timelineToRank}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-600">{truncate(r.results.targetKeyword, 40)}</p>
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

function ForecastSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

function ForecastResults({
  report,
  creditsLeft,
  activeTab,
  setActiveTab,
}: {
  report: SeoForecastReport;
  creditsLeft: number | null;
  activeTab: string;
  setActiveTab: (t: string) => void;
}) {
  const r = report.results;
  const startingPos = r.currentPosition || r.forecast[0]?.position || 100;
  const endPos = r.forecast[r.forecast.length - 1]?.position ?? startingPos;
  const startBand = positionBand(startingPos);
  const endBand = positionBand(endPos);
  const isRoiPositive = r.projectedROI >= 1;
  const chartData = r.forecast.map((f) => ({
    month: `M${f.month}`,
    position: f.position,
    traffic: f.traffic,
    revenue: Math.round(f.revenue),
  }));

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-brand-600" />
          <div>
            <p className="font-semibold text-ink-900">{report.domain}</p>
            <p className="text-xs text-ink-500">
              Keyword: <span className="font-medium text-ink-700">{r.targetKeyword}</span> ·{" "}
              Generated {formatDate(report.created_at)}
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
            <Calendar className="h-3 w-3" />
            {r.timelineToRank}
          </Badge>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-2 py-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Current position
              </span>
              <Gauge className="h-4 w-4" style={{ color: startBand.color }} />
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: startBand.color }}>
              #{startingPos}
            </p>
            <p className="text-xs text-ink-500">{startBand.label}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 py-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Projected position
              </span>
              <TrendingUp className="h-4 w-4" style={{ color: endBand.color }} />
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: endBand.color }}>
              #{endPos}
            </p>
            <p className="text-xs text-ink-500">{endBand.label} in 12 months</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 py-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Total investment
              </span>
              <DollarSign className="h-4 w-4 text-brand-600" />
            </div>
            <p className="text-2xl font-bold tabular-nums text-ink-900">
              ${formatNumber(Math.round(r.totalInvestment))}
            </p>
            <p className="text-xs text-ink-500">
              ${formatNumber(r.monthlyBudget)}/mo × {r.timelineToRank}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 py-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Projected ROI
              </span>
              <Award
                className="h-4 w-4"
                style={{ color: isRoiPositive ? "#10b981" : "#ef4444" }}
              />
            </div>
            <p
              className="text-2xl font-bold tabular-nums"
              style={{ color: isRoiPositive ? "#10b981" : "#ef4444" }}
            >
              {Math.round(r.projectedROI * 100)}%
            </p>
            <p className="text-xs text-ink-500">
              {isRoiPositive ? "Positive 12-month return" : "Below break-even"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recommendation */}
      <Card className="border-l-4 border-l-brand-500 bg-brand-50/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-brand-600" />
            Recommendation
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm leading-relaxed text-ink-700">{r.recommendation}</p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="chart">
            <TrendingUp className="h-3.5 w-3.5" />
            Trajectory
          </TabsTrigger>
          <TabsTrigger value="position">
            <ArrowDownRight className="h-3.5 w-3.5" />
            Position
          </TabsTrigger>
          <TabsTrigger value="assumptions">
            <Info className="h-3.5 w-3.5" />
            Assumptions
          </TabsTrigger>
          <TabsTrigger value="risks">
            <AlertTriangle className="h-3.5 w-3.5" />
            Risks
          </TabsTrigger>
        </TabsList>

        {/* Trajectory chart */}
        <TabsContent value="chart" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-brand-600" />
                12-month traffic & revenue projection
              </CardTitle>
              <CardDescription>Monthly organic traffic and revenue from the target keyword.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                      tickFormatter={(value) => `$${formatCompact(Number(value))}`}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                      formatter={(value, name) => {
                        if (name === "revenue") return [`$${formatNumber(Number(value))}`, "Revenue"];
                        if (name === "traffic") return [formatNumber(Number(value)), "Traffic"];
                        return [String(value), name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="traffic"
                      name="Traffic"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Position chart */}
        <TabsContent value="position" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowDownRight className="h-4 w-4 text-brand-600" />
                Position projection (lower = better)
              </CardTitle>
              <CardDescription>
                Average SERP position for the target keyword, by month.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis
                      reversed
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                      domain={[1, 100]}
                      allowDataOverflow
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                      formatter={(value) => [`#${value}`, "Position"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="position"
                      name="Position"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assumptions */}
        <TabsContent value="assumptions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-brand-600" />
                Model assumptions
              </CardTitle>
              <CardDescription>What this forecast assumes to hold true.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {r.assumptions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {a}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risks */}
        <TabsContent value="risks" className="mt-4">
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Risks to the projection
              </CardTitle>
              <CardDescription>Factors that could derail the forecast.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {r.risks.map((risk, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    {risk}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
