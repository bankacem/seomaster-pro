"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link2,
  Globe,
  Sparkles,
  Search,
  Award,
  Target,
  Mail,
  Plus,
  X,
  History,
  RefreshCw,
  Clock,
  ExternalLink,
  TrendingUp,
  BarChart3,
  Mailbox,
  Lightbulb,
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
  truncate,
  scoreColor,
} from "@/lib/utils";

/* ----------------------------- Types & helpers ---------------------------- */

type OpportunityType =
  | "guest-post"
  | "resource-page"
  | "broken-link"
  | "directory"
  | "forum"
  | "social";
type ResponseRate = "low" | "medium" | "high";

interface BacklinkOpportunity {
  site: string;
  domainAuthority: number;
  type: OpportunityType;
  relevanceScore: number;
  contactMethod: string;
  estimatedResponseRate: ResponseRate;
  outreachTemplate: string;
  anchorTextSuggestion: string;
}

interface BacklinkOpportunityResult {
  domain: string;
  opportunities: BacklinkOpportunity[];
  summary: string;
  strategyRecommendation: string;
}

interface BacklinkOppReport {
  id: string;
  domain: string;
  results: BacklinkOpportunityResult;
  created_at: string;
}

const TYPE_META: Record<
  OpportunityType,
  { label: string; variant: "default" | "secondary" | "warning" | "info" | "success" }
> = {
  "guest-post": { label: "Guest post", variant: "default" },
  "resource-page": { label: "Resource page", variant: "info" },
  "broken-link": { label: "Broken link", variant: "warning" },
  directory: { label: "Directory", variant: "secondary" },
  forum: { label: "Forum", variant: "info" },
  social: { label: "Social", variant: "success" },
};

const RESPONSE_VARIANT: Record<ResponseRate, "destructive" | "warning" | "success"> = {
  low: "destructive",
  medium: "warning",
  high: "success",
};

function normalizeDomainInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.includes("://") ? trimmed : `https://${trimmed}`;
}

/* --------------------------------- Page ---------------------------------- */

export default function BacklinkOpportunitiesPage() {
  const { toast } = useToast();

  const [domain, setDomain] = useState("");
  const [niche, setNiche] = useState("");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<BacklinkOppReport | null>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [reports, setReports] = useState<BacklinkOppReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState("opportunities");

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/backlink-opportunities", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load history");
      const list: BacklinkOppReport[] = json.data || [];
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
      toast("warning", "Enter a domain", "Provide a domain or URL.");
      return;
    }
    const normalized = normalizeDomainInput(raw);
    setRunning(true);
    setCurrent(null);
    setExpanded(null);
    try {
      const res = await fetch("/api/backlink-opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: normalized,
          niche: niche.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Backlink opportunity search failed");
      const report: BacklinkOppReport | undefined = json.data?.report;
      if (!report) throw new Error("Malformed response from server");
      if (json.data?.credits_left !== undefined) setCreditsLeft(json.data.credits_left);
      setCurrent(report);
      toast(
        "success",
        "Search complete",
        `${report.results.opportunities.length} opportunities found`
      );
      const fresh = await loadHistory();
      const match = fresh.find((r) => r.id === report.id);
      if (match) setCurrent(match);
      setActiveTab("opportunities");
    } catch (err) {
      toast("error", "Search failed", err instanceof Error ? err.message : "Try again later");
    } finally {
      setRunning(false);
    }
  };

  const selectReport = (report: BacklinkOppReport) => {
    setCurrent(report);
    setDomain(report.domain);
    setExpanded(null);
    setActiveTab("opportunities");
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
            Link-building opportunities
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Backlink Opportunity Finder</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              Discover prospective linking sites with domain authority, contact method, outreach
              template and anchor text — sorted by relevance and response rate.
            </p>
          </div>
        </div>
      </section>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-brand-600" />
            Find new opportunities
          </CardTitle>
          <CardDescription>
            Enter your domain (and optionally a niche). Each search costs 2 credits.
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
              <Label htmlFor="niche">Niche (optional)</Label>
              <div className="relative">
                <Target className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  id="niche"
                  placeholder="e.g. SaaS marketing"
                  className="pl-9"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  onKeyDown={submitOnEnter}
                  disabled={running}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-ink-500">
              {creditsLeft !== null ? `${creditsLeft} credits remaining` : "Costs 2 credits per search"}
            </p>
            <Button variant="gradient" onClick={() => analyze()} disabled={running}>
              {running ? <Spinner size="sm" /> : <Search className="h-4 w-4" />}
              {running ? "Finding opportunities…" : "Find opportunities"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {running && <OppSkeleton />}

      {/* Results */}
      {!running && current && (
        <OppResults
          report={current}
          creditsLeft={creditsLeft}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          expanded={expanded}
          setExpanded={setExpanded}
        />
      )}

      {/* Empty / History */}
      {!running && !current && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <History className="h-5 w-5 text-brand-600" />
                Recent searches
              </span>
              <Button variant="ghost" size="sm" onClick={() => loadHistory()} disabled={loadingHistory}>
                <RefreshCw className={cn("h-4 w-4", loadingHistory && "animate-spin")} />
                Refresh
              </Button>
            </CardTitle>
            <CardDescription>Your last 20 backlink opportunity searches.</CardDescription>
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
                icon={<Link2 className="h-6 w-6" />}
                title="No backlink opportunity searches yet"
                description="Find websites likely to link to your domain with ready-to-send outreach templates."
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
                {reports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => selectReport(r)}
                    className="card-hover text-left rounded-lg border border-ink-200 bg-white p-4 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-ink-900">{r.domain}</p>
                      <Badge variant="secondary">
                        {r.results.opportunities.length}
                      </Badge>
                    </div>
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

function OppSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}

function OppResults({
  report,
  creditsLeft,
  activeTab,
  setActiveTab,
  expanded,
  setExpanded,
}: {
  report: BacklinkOppReport;
  creditsLeft: number | null;
  activeTab: string;
  setActiveTab: (t: string) => void;
  expanded: string | null;
  setExpanded: (s: string | null) => void;
}) {
  const r = report.results;
  const total = r.opportunities.length;
  const avgDa = total
    ? Math.round(r.opportunities.reduce((s, o) => s + o.domainAuthority, 0) / total)
    : 0;
  const highResponseCount = r.opportunities.filter((o) => o.estimatedResponseRate === "high").length;
  const avgRelevance = total
    ? Math.round(r.opportunities.reduce((s, o) => s + o.relevanceScore, 0) / total)
    : 0;

  const typeCounts = useMemo(() => {
    const map = new Map<OpportunityType, number>();
    r.opportunities.forEach((o) => {
      map.set(o.type, (map.get(o.type) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [r.opportunities]);

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
            <Link2 className="h-3 w-3" />
            {total} opportunities
          </Badge>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-2 py-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Total opportunities
              </span>
              <Link2 className="h-4 w-4 text-brand-600" />
            </div>
            <p className="text-2xl font-bold tabular-nums text-ink-900">{total}</p>
            <p className="text-xs text-ink-500">across {typeCounts.length} types</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 py-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Avg domain authority
              </span>
              <Award
                className="h-4 w-4"
                style={{ color: scoreColor(avgDa) }}
              />
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: scoreColor(avgDa) }}>
              {avgDa}
            </p>
            <p className="text-xs text-ink-500">of prospective sites</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 py-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Avg relevance
              </span>
              <Target className="h-4 w-4" style={{ color: scoreColor(avgRelevance) }} />
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: scoreColor(avgRelevance) }}>
              {avgRelevance}
            </p>
            <p className="text-xs text-ink-500">topical match score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 py-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                High response rate
              </span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">
              {highResponseCount}
            </p>
            <p className="text-xs text-ink-500">likely to respond</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="border-l-4 border-l-brand-500 bg-brand-50/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-brand-600" />
            Strategy recommendation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="text-sm leading-relaxed text-ink-700">{r.strategyRecommendation}</p>
          <p className="text-sm leading-relaxed text-ink-600">{r.summary}</p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3">
          <TabsTrigger value="opportunities">
            <Link2 className="h-3.5 w-3.5" />
            Opportunities
          </TabsTrigger>
          <TabsTrigger value="by-type">
            <BarChart3 className="h-3.5 w-3.5" />
            By type
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-3.5 w-3.5" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities" className="mt-4 space-y-3">
          {r.opportunities.map((o, idx) => (
            <OppCard
              key={`${o.site}-${idx}`}
              opp={o}
              expanded={expanded === o.site}
              onToggle={() => setExpanded(expanded === o.site ? null : o.site)}
            />
          ))}
        </TabsContent>

        <TabsContent value="by-type" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-brand-600" />
                Opportunities by type
              </CardTitle>
              <CardDescription>How the suggested opportunities break down by link type.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {typeCounts.map(([type, count]) => {
                const meta = TYPE_META[type];
                const pct = total ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={type} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </div>
                      <span className="tabular-nums text-ink-600">
                        {count} · {pct}%
                      </span>
                    </div>
                    <Progress value={pct} indicatorClassName="" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-brand-600" />
                Past searches
              </CardTitle>
              <CardDescription>Click any row to view that report.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-ink-500">
                Use the history panel below the form on the main page to navigate past reports.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OppCard({
  opp,
  expanded,
  onToggle,
}: {
  opp: BacklinkOpportunity;
  expanded: boolean;
  onToggle: () => void;
}) {
  const meta = TYPE_META[opp.type];
  const daColor = scoreColor(opp.domainAuthority);
  const relColor = scoreColor(opp.relevanceScore);
  return (
    <Card className="card-hover">
      <CardContent className="py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <a
                href={`https://${opp.site}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-ink-900 hover:underline"
              >
                {opp.site}
              </a>
              <ExternalLink className="h-3 w-3 text-ink-400" />
              <Badge variant={meta.variant}>{meta.label}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
              <span className="flex items-center gap-1">
                <Award className="h-3 w-3" style={{ color: daColor }} />
                DA <span className="font-medium tabular-nums" style={{ color: daColor }}>{opp.domainAuthority}</span>
              </span>
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" style={{ color: relColor }} />
                Relevance <span className="font-medium tabular-nums" style={{ color: relColor }}>{opp.relevanceScore}</span>
              </span>
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {opp.contactMethod}
              </span>
              <Badge variant={RESPONSE_VARIANT[opp.estimatedResponseRate]} className="capitalize">
                {opp.estimatedResponseRate} response
              </Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onToggle}>
            {expanded ? "Hide template" : "View outreach"}
          </Button>
        </div>
        {expanded && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Outreach template
              </p>
              <div className="rounded-md bg-ink-50 p-3 text-sm leading-relaxed text-ink-700 whitespace-pre-wrap">
                {opp.outreachTemplate}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Anchor text suggestion
              </p>
              <div className="rounded-md bg-brand-50/40 border border-brand-100 p-3 text-sm text-ink-800">
                <Mailbox className="mb-2 h-4 w-4 text-brand-600" />
                <code className="font-mono text-sm">{opp.anchorTextSuggestion}</code>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
