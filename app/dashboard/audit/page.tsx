"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Globe,
  Play,
  RefreshCw,
  AlertTriangle,
  Info,
  CheckCircle2,
  FileText,
  Clock,
  Link2,
  Bot,
  ArrowUpRight,
  History,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageLoader, Skeleton, Spinner } from "@/components/ui/spinner";
import { ScoreGauge } from "@/components/shared/score-gauge";
import { useToast } from "@/components/ui/toast";
import {
  cn,
  formatDate,
  formatNumber,
  getDomain,
  scoreColor,
  truncate,
  isValidUrl,
} from "@/lib/utils";
import type { SiteAudit, SiteAuditResult } from "@/lib/types";

type Severity = "error" | "warning" | "info";

const ISSUE_LABELS: Record<string, { label: string; severity: Severity }> = {
  "http-error": { label: "HTTP error", severity: "error" },
  "not-html": { label: "Non-HTML resource", severity: "info" },
  "missing-title": { label: "Missing title tag", severity: "error" },
  "title-too-long": { label: "Title too long (>60 chars)", severity: "warning" },
  "title-too-short": { label: "Title too short (<15 chars)", severity: "warning" },
  "missing-meta-description": { label: "Missing meta description", severity: "error" },
  "meta-description-too-long": { label: "Meta description too long", severity: "warning" },
  "missing-h1": { label: "Missing H1", severity: "error" },
  "multiple-h1": { label: "Multiple H1s", severity: "warning" },
  "missing-canonical": { label: "Missing canonical", severity: "info" },
  "images-missing-alt": { label: "Images missing alt text", severity: "warning" },
  "thin-content": { label: "Thin content (<100 words)", severity: "warning" },
  "fetch-error": { label: "Page failed to load", severity: "error" },
};

const MAX_PAGES_OPTIONS = [10, 20, 30, 50] as const;

const SEVERITY_BADGE: Record<Severity, "destructive" | "warning" | "info"> = {
  error: "destructive",
  warning: "warning",
  info: "info",
};

const SEVERITY_ICON: Record<Severity, React.ElementType> = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

interface AuditPageRow {
  url: string;
  status: number;
  contentType: string;
  title: string;
  metaDescription: string;
  canonical: string | null;
  h1Count: number;
  wordCount: number;
  internalLinks: number;
  images: number;
  imagesMissingAlt: number;
  loadTimeMs: number;
  issues: string[];
}

function computeHealthScore(result: SiteAuditResult): number {
  const { pagesCrawled, totalIssues } = result.summary;
  if (pagesCrawled === 0) return 0;
  const maxIssues = pagesCrawled * 5;
  const ratio = Math.min(1, totalIssues / maxIssues);
  return Math.round((1 - ratio) * 100);
}

function avgLoadTime(result: SiteAuditResult): number {
  const pages = (result.pages as unknown as AuditPageRow[]) ?? [];
  if (!pages?.length) return 0;
  const valid = pages.filter((p) => p.loadTimeMs > 0);
  if (!valid.length) return 0;
  return Math.round(valid.reduce((sum, p) => sum + p.loadTimeMs, 0) / valid.length);
}

export default function AuditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState<number>(20);
  const [running, setRunning] = useState(false);
  const [audits, setAudits] = useState<SiteAudit[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [current, setCurrent] = useState<SiteAudit | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [activeTab, setActiveTab] = useState("issues");

  const selectedId = searchParams.get("id");

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/audit", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load audit history");
      const list: SiteAudit[] = json.data || [];
      setAudits(list);
      return list;
    } catch (err) {
      toast("error", "Could not load history", err instanceof Error ? err.message : "Try again later");
      setAudits([]);
      return [];
    } finally {
      setLoadingHistory(false);
    }
  }, [toast]);

  // Initial load of history
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Load specific audit by ?id=
  useEffect(() => {
    if (!selectedId) {
      setCurrent(null);
      return;
    }
    let active = true;
    setLoadingCurrent(true);
    (async () => {
      try {
        const list = await loadHistory();
        if (!active) return;
        const found = list.find((a) => a.id === selectedId);
        if (!found) {
          toast("error", "Audit not found", "We could not find that audit. Try running a new one.");
          router.replace("/dashboard/audit");
          return;
        }
        setCurrent(found);
      } finally {
        if (active) setLoadingCurrent(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const runAudit = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast("warning", "Enter a URL", "Provide a website URL to audit.");
      return;
    }
    let normalized = trimmed;
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    if (!isValidUrl(normalized)) {
      toast("error", "Invalid URL", "Please provide a valid URL like https://example.com");
      return;
    }
    setRunning(true);
    setCurrent(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized, max_pages: maxPages }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Audit failed");
      }
      const audit: SiteAudit = json.data?.audit;
      setCurrent(audit);
      // Prepend to history (and remove dupes)
      setAudits((prev) => [audit, ...prev.filter((a) => a.id !== audit.id)].slice(0, 20));
      router.replace(`/dashboard/audit?id=${audit.id}`);
      toast("success", "Audit complete", `Crawled ${audit.pages_crawled} pages on ${getDomain(audit.url)}`);
    } catch (err) {
      toast("error", "Audit failed", err instanceof Error ? err.message : "Try again later");
    } finally {
      setRunning(false);
    }
  };

  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !running) runAudit();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Hero / form card */}
      <div className="relative overflow-hidden rounded-2xl gradient-brand p-6 sm:p-8">
        <div className="absolute inset-0 gradient-hero opacity-60" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
              <Globe className="h-3.5 w-3.5" />
              Technical SEO crawler
            </div>
            <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Site Audit</h1>
            <p className="mt-2 text-sm text-white/85">
              Crawl up to {maxPages} pages of any site and surface technical SEO issues — broken
              links, missing tags, duplicate canonicals, thin content and more.
            </p>
          </div>

          <Card className="w-full bg-white/95 backdrop-blur lg:max-w-2xl">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="audit-url" className="text-xs font-medium text-ink-600">
                    Website URL
                  </Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                      <Input
                        id="audit-url"
                        type="url"
                        inputMode="url"
                        autoComplete="url"
                        placeholder="https://example.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={submitOnEnter}
                        disabled={running}
                        className="pl-9"
                      />
                    </div>
                    <Button
                      onClick={runAudit}
                      disabled={running}
                      className="shrink-0"
                      size="lg"
                    >
                      {running ? (
                        <>
                          <Spinner size="sm" className="border-white/40 border-t-white" />
                          Auditing…
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Run audit
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium text-ink-600">Max pages to crawl</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {MAX_PAGES_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setMaxPages(opt)}
                        disabled={running}
                        className={cn(
                          "h-8 min-w-[2.5rem] rounded-md border px-2.5 text-xs font-medium transition-all",
                          maxPages === opt
                            ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                            : "border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700",
                          running && "cursor-not-allowed opacity-60"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Running progress */}
      {running && (
        <Card className="border-brand-200 bg-brand-50/40">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <Spinner size="lg" />
            <div>
              <p className="text-sm font-semibold text-ink-900">Crawling pages…</p>
              <p className="mt-1 text-xs text-ink-500">
                Fetching URLs, parsing HTML, checking robots.txt. This usually takes 10–30 seconds.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected audit results */}
      {loadingCurrent && !current && !running && <PageLoader message="Loading audit…" />}

      {current && !running && <AuditResults audit={current} activeTab={activeTab} onTabChange={setActiveTab} />}

      {/* Recent audits */}
      {!selectedId && !current && !running && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4 text-ink-400" />
                Recent audits
              </CardTitle>
              <CardDescription>Run a new audit or open a past one to view details.</CardDescription>
            </div>
            {audits.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => loadHistory()} disabled={loadingHistory}>
                <RefreshCw className={cn("h-3.5 w-3.5", loadingHistory && "animate-spin")} />
                Refresh
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>
            ) : audits.length === 0 ? (
              <EmptyState
                icon={<Globe className="h-6 w-6" />}
                title="No audits yet"
                description="Run your first site audit by entering a URL above. Results will appear here."
              />
            ) : (
              <div className="divide-y divide-ink-100">
                {audits.map((a) => (
                  <RecentAuditRow key={a.id} audit={a} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------- Audit results section ------------------------- */

function AuditResults({
  audit,
  activeTab,
  onTabChange,
}: {
  audit: SiteAudit;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const result = audit.results;
  const healthScore = computeHealthScore(result);
  const avgLoad = avgLoadTime(result);
  const pages = (result.pages as unknown as AuditPageRow[]) ?? [];

  const issueList = useMemo(() => {
    const entries = Object.entries(result.summary.issueCounts);
    return entries
      .map(([key, count]) => {
        const meta = ISSUE_LABELS[key] || { label: key, severity: "info" as Severity };
        return { key, count, ...meta };
      })
      .sort((a, b) => {
        const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
        if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
        return b.count - a.count;
      });
  }, [result.summary.issueCounts]);

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
              <Globe className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink-900">{getDomain(audit.url)}</p>
              <p className="text-xs text-ink-500">
                Audited {formatDate(audit.created_at)} · {audit.pages_crawled} pages crawled
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/audit">
              <ArrowUpRight className="h-3.5 w-3.5" />
              View all audits
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Score + KPIs */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 card-hover">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-6">
            <ScoreGauge score={healthScore} size="lg" label="Health" />
            <div className="text-center">
              <p className="text-sm font-semibold text-ink-900">Site health score</p>
              <p className="text-xs text-ink-500">
                {healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Needs work" : "Critical"}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <KpiCard
            label="Pages crawled"
            value={formatNumber(result.summary.pagesCrawled)}
            icon={FileText}
            accent="from-emerald-500 to-teal-600"
          />
          <KpiCard
            label="Total issues"
            value={formatNumber(result.summary.totalIssues)}
            icon={AlertTriangle}
            accent="from-amber-500 to-orange-600"
            sub={`${result.summary.pagesWithIssues} pages affected`}
          />
          <KpiCard
            label="Broken pages"
            value={formatNumber(result.summary.brokenPages)}
            icon={XCircle}
            accent="from-red-500 to-rose-600"
          />
          <KpiCard
            label="Avg load time"
            value={avgLoad > 0 ? `${avgLoad} ms` : "—"}
            icon={Clock}
            accent="from-blue-500 to-cyan-600"
          />
        </div>
      </div>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed findings</CardTitle>
          <CardDescription>Drill down into issues, page details and robots.txt rules.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="issues">
                <AlertTriangle className="h-3.5 w-3.5" />
                Issues
                {issueList.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                    {issueList.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="pages">
                <FileText className="h-3.5 w-3.5" />
                Pages
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                  {pages.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="robots">
                <Bot className="h-3.5 w-3.5" />
                Robots.txt
              </TabsTrigger>
            </TabsList>

            <TabsContent value="issues" className="mt-4">
              {issueList.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}
                  title="No issues found"
                  description="Every crawled page passed all SEO checks. Great job!"
                />
              ) : (
                <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
                  {issueList.map(({ key, label, count, severity }) => {
                    const Icon = SEVERITY_ICON[severity];
                    return (
                      <li
                        key={key}
                        className="flex items-center gap-3 p-3 transition-colors hover:bg-ink-50/60"
                      >
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            severity === "error" && "bg-red-50 text-red-600",
                            severity === "warning" && "bg-amber-50 text-amber-600",
                            severity === "info" && "bg-blue-50 text-blue-600"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink-900">{label}</p>
                          <p className="truncate text-xs text-ink-500">
                            Code: <code className="rounded bg-ink-100 px-1 py-0.5 text-[10px] text-ink-600">{key}</code>
                          </p>
                        </div>
                        <Badge variant={SEVERITY_BADGE[severity]}>{count}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="pages" className="mt-4">
              <PagesTable pages={pages} />
            </TabsContent>

            <TabsContent value="robots" className="mt-4">
              <RobotsPanel result={result} auditUrl={audit.url} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: string;
  sub?: string;
}) {
  return (
    <Card className="card-hover overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-ink-900">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-ink-500">{sub}</p>}
          </div>
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
              accent
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PagesTable({ pages }: { pages: readonly AuditPageRow[] }) {
  if (!pages?.length) {
    return (
      <EmptyState
        icon={<FileText className="h-6 w-6" />}
        title="No pages crawled"
        description="The crawler did not return any pages. Try a different URL or higher page limit."
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-ink-100">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <th className="px-3 py-2.5 font-medium">URL</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Title</th>
            <th className="px-3 py-2.5 text-center font-medium">H1</th>
            <th className="px-3 py-2.5 text-right font-medium">Words</th>
            <th className="px-3 py-2.5 text-center font-medium">Img alt</th>
            <th className="px-3 py-2.5 text-right font-medium">Load</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100 bg-white">
          {pages.map((p) => {
            const broken = p.status === 0 || p.status >= 400;
            return (
              <tr key={p.url} className="transition-colors hover:bg-ink-50/60">
                <td className="max-w-[260px] px-3 py-2.5">
                  <span className="block truncate font-mono text-xs text-ink-700" title={p.url}>
                    {p.url}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Badge
                    variant={broken ? "destructive" : p.status >= 300 ? "warning" : "success"}
                    className="tabular-nums"
                  >
                    {p.status || "—"}
                  </Badge>
                </td>
                <td className="max-w-[200px] px-3 py-2.5">
                  {p.title ? (
                    <span className="block truncate text-ink-900" title={p.title}>
                      {truncate(p.title, 40)}
                    </span>
                  ) : (
                    <span className="text-xs italic text-ink-400">missing</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center tabular-nums text-ink-700">{p.h1Count}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">
                  {formatNumber(p.wordCount)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {p.images === 0 ? (
                    <span className="text-xs text-ink-400">—</span>
                  ) : p.imagesMissingAlt === 0 ? (
                    <Badge variant="success" className="tabular-nums">
                      0 / {p.images}
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="tabular-nums">
                      {p.imagesMissingAlt} / {p.images}
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">
                  {p.loadTimeMs ? `${p.loadTimeMs}ms` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RobotsPanel({ result, auditUrl }: { result: SiteAuditResult; auditUrl: string }) {
  const robots = result.robots ?? { found: false, disallowedPaths: [] };
  const origin = useMemo(() => {
    try {
      return new URL(auditUrl).origin;
    } catch {
      return "";
    }
  }, [auditUrl]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-lg border border-ink-100 bg-ink-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              robots.found ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
            )}
          >
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-900">
              {robots.found ? "robots.txt found" : "robots.txt not found"}
            </p>
            <p className="text-xs text-ink-500">
              {origin ? `${origin}/robots.txt` : "Could not resolve origin URL"}
            </p>
          </div>
        </div>
        {origin && (
          <Button asChild variant="outline" size="sm">
            <a href={`${origin}/robots.txt`} target="_blank" rel="noopener noreferrer">
              <Link2 className="h-3.5 w-3.5" />
              Open robots.txt
            </a>
          </Button>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-900">Disallowed paths</p>
          <Badge variant={robots.disallowedPaths.length ? "warning" : "success"}>
            {robots.disallowedPaths.length} {robots.disallowedPaths.length === 1 ? "rule" : "rules"}
          </Badge>
        </div>
        {robots.disallowedPaths.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ink-200 bg-white p-6 text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500" />
            <p className="mt-2 text-sm font-medium text-ink-900">No disallowed paths for User-agent: *</p>
            <p className="mt-1 text-xs text-ink-500">The crawler is free to crawl the entire site.</p>
          </div>
        ) : (
          <ul className="max-h-80 divide-y divide-ink-100 overflow-y-auto rounded-lg border border-ink-100 bg-white">
            {robots.disallowedPaths.map((path, i) => (
              <li key={`${path}-${i}`} className="flex items-center gap-3 px-3 py-2">
                <XCircle className="h-4 w-4 shrink-0 text-amber-500" />
                <code className="font-mono text-xs text-ink-700">{path}</code>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RecentAuditRow({ audit }: { audit: SiteAudit }) {
  const result = audit.results;
  const healthScore = computeHealthScore(result);
  const total = result.summary.totalIssues;
  return (
    <Link
      href={`/dashboard/audit?id=${audit.id}`}
      className="flex items-center gap-4 py-3 transition-colors hover:bg-ink-50 -mx-2 px-2 rounded-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
        <Globe className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{getDomain(audit.url)}</p>
        <p className="truncate text-xs text-ink-500">
          {audit.pages_crawled} pages · {total} {total === 1 ? "issue" : "issues"} · {formatDate(audit.created_at)}
        </p>
      </div>
      <div className="hidden sm:flex flex-col items-end gap-1">
        <span className="text-[10px] uppercase tracking-wide text-ink-400">Health</span>
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: scoreColor(healthScore) }}
        >
          {healthScore}
        </span>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-400" />
    </Link>
  );
}
