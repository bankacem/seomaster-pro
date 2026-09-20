"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  FileText,
  Hash,
  Gauge,
  Tag,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Lightbulb,
  Code2,
  ArrowUpRight,
  History,
  RotateCcw,
  Wand2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/spinner";
import { ScoreGauge } from "@/components/shared/score-gauge";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate, formatNumber, getDomain, truncate } from "@/lib/utils";
import type { Analysis, SEOAnalysis } from "@/lib/types";

const MIN_CHARS = 100;
const MAX_CHARS = 40_000;

type Severity = "error" | "warning" | "info" | "passed";

const ISSUE_TYPE_TO_SEVERITY: Record<string, Severity> = {
  title: "warning",
  meta: "warning",
  headings: "warning",
  content: "info",
  keywords: "info",
  links: "info",
  readability: "info",
  technical: "error",
};

const SEVERITY_ICON: Record<Severity, React.ElementType> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  passed: CheckCircle2,
};

const SEVERITY_BADGE: Record<Severity, "destructive" | "warning" | "info" | "success"> = {
  error: "destructive",
  warning: "warning",
  info: "info",
  passed: "success",
};

const SEVERITY_COLOR: Record<Severity, string> = {
  error: "text-red-600 bg-red-50",
  warning: "text-amber-600 bg-amber-50",
  info: "text-blue-600 bg-blue-50",
  passed: "text-emerald-600 bg-emerald-50",
};

interface AnalysisRecord {
  id: string;
  url: string | null;
  content: string;
  score: number | null;
  results: SEOAnalysis;
  created_at: string;
}

export default function AnalyzerPage() {
  const { toast } = useToast();

  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [result, setResult] = useState<AnalysisRecord | null>(null);
  const [activeTab, setActiveTab] = useState("issues");

  const charCount = content.length;
  const canAnalyze = charCount >= MIN_CHARS && charCount <= MAX_CHARS && !analyzing;

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/analyze", { cache: "no-store" });
      if (!res.ok) {
        // GET endpoint may not exist; fall back to empty list.
        setHistory([]);
        return;
      }
      const json = await res.json();
      const list: AnalysisRecord[] = json.data || [];
      setHistory(list);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const runAnalysis = async () => {
    const trimmed = content.trim();
    if (trimmed.length < MIN_CHARS) {
      toast("warning", "Content too short", `Paste at least ${MIN_CHARS} characters to analyze.`);
      return;
    }
    const trimmedUrl = url.trim();
    let normalizedUrl: string | undefined;
    if (trimmedUrl) {
      let candidate = trimmedUrl;
      if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
      try {
        normalizedUrl = new URL(candidate).toString();
      } catch {
        toast("error", "Invalid URL", "Please provide a valid URL or leave it blank.");
        return;
      }
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, url: normalizedUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Analysis failed");
      }
      const analysis: Analysis = json.data?.analysis;
      const record: AnalysisRecord = {
        id: analysis.id,
        url: analysis.url,
        content: trimmed,
        score: analysis.score,
        results: analysis.results,
        created_at: analysis.created_at,
      };
      setResult(record);
      setHistory((prev) => [record, ...prev.filter((h) => h.id !== record.id)].slice(0, 20));
      setActiveTab("issues");
      toast(
        "success",
        "Analysis complete",
        `SEO score: ${analysis.results.score}/100 · ${analysis.results.issues.length} issues found`
      );
    } catch (err) {
      toast("error", "Analysis failed", err instanceof Error ? err.message : "Try again later");
    } finally {
      setAnalyzing(false);
    }
  };

  const loadHistoryItem = (record: AnalysisRecord) => {
    setResult(record);
    setContent(record.content);
    setUrl(record.url || "");
    setActiveTab("issues");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const clearAll = () => {
    setContent("");
    setUrl("");
    setResult(null);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl gradient-brand p-6 sm:p-8">
        <div className="absolute inset-0 gradient-hero opacity-60" />
        <div className="relative flex flex-col gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            AI-powered content intelligence
          </div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Content Analyzer</h1>
          <p className="max-w-2xl text-sm text-white/85">
            Paste your article and get an instant SEO score with readability, keyword extraction,
            prioritized issues and actionable suggestions — powered by AI.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: input + results (3/5 = 60%) */}
        <div className="space-y-6 lg:col-span-3">
          {/* Input card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-brand-600" />
                  Article input
                </CardTitle>
                <CardDescription>Paste the article body (HTML or plain text).</CardDescription>
              </div>
              {(content || url) && (
                <Button variant="ghost" size="sm" onClick={clearAll} disabled={analyzing}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="article-url" className="text-xs font-medium text-ink-600">
                  Source URL <span className="text-ink-400">(optional)</span>
                </Label>
                <Input
                  id="article-url"
                  type="url"
                  placeholder="https://example.com/blog/post"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={analyzing}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="article-content" className="text-xs font-medium text-ink-600">
                    Article content
                  </Label>
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      charCount < MIN_CHARS ? "text-ink-400" : charCount > MAX_CHARS ? "text-red-600" : "text-ink-500"
                    )}
                  >
                    {formatNumber(charCount)} / {formatNumber(MIN_CHARS)} min · {formatNumber(MAX_CHARS)} max
                  </span>
                </div>
                <Textarea
                  id="article-content"
                  placeholder="Paste your article here. Minimum 100 characters — include the title, headings and body text for the most accurate analysis."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={analyzing}
                  className="min-h-[260px] font-sans"
                />
                {charCount > 0 && charCount < MIN_CHARS && (
                  <p className="text-xs text-amber-600">
                    {MIN_CHARS - charCount} more characters needed before you can analyze.
                  </p>
                )}
                {charCount > MAX_CHARS && (
                  <p className="text-xs text-red-600">
                    Content exceeds the {formatNumber(MAX_CHARS)} character limit.
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between gap-3 border-t border-ink-100 bg-ink-50/40">
              <p className="text-xs text-ink-500">
                Each analysis costs <span className="font-medium text-ink-700">1 credit</span>.
              </p>
              <Button onClick={runAnalysis} disabled={!canAnalyze} size="lg">
                {analyzing ? (
                  <>
                    <Spinner size="sm" className="border-white/40 border-t-white" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyze
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Loading skeleton */}
          {analyzing && <AnalysisSkeleton />}

          {/* Results */}
          {result && !analyzing && (
            <AnalysisResults record={result} activeTab={activeTab} onTabChange={setActiveTab} />
          )}
        </div>

        {/* Right: history (2/5 = 40%) */}
        <div className="lg:col-span-2">
          <Card className="lg:sticky lg:top-6">
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4 text-ink-400" />
                  History
                </CardTitle>
                <CardDescription>Recent analyses</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadHistory} disabled={loadingHistory}>
                <RotateCcw className={cn("h-3.5 w-3.5", loadingHistory && "animate-spin")} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-2.5 w-44" />
                      </div>
                      <Skeleton className="h-7 w-12" />
                    </div>
                  ))}
                </div>
              ) : history.length === 0 ? (
                <EmptyState
                  icon={<FileText className="h-6 w-6" />}
                  title="No analyses yet"
                  description="Your past analyses will show up here. Run your first one to get started."
                />
              ) : (
                <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
                  {history.map((item) => (
                    <HistoryRow
                      key={item.id}
                      record={item}
                      active={result?.id === item.id}
                      onClick={() => loadHistoryItem(item)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Analysis results block ------------------------- */

function AnalysisResults({
  record,
  activeTab,
  onTabChange,
}: {
  record: AnalysisRecord;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const analysis = record.results;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Score + meta summary */}
      <Card className="card-hover">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex flex-col items-center gap-2">
              <ScoreGauge score={analysis.score} size="lg" label="SEO" />
              <Badge
                variant={
                  analysis.score >= 80 ? "success" : analysis.score >= 60 ? "warning" : "destructive"
                }
              >
                {analysis.score >= 80 ? "Strong" : analysis.score >= 60 ? "Needs work" : "Weak"}
              </Badge>
            </div>

            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-2">
              <MetaStat
                icon={FileText}
                label="Title"
                value={analysis.title ? truncate(analysis.title, 50) : "—"}
                empty={!analysis.title}
              />
              <MetaStat
                icon={Tag}
                label="Meta description"
                value={analysis.metaDescription ? truncate(analysis.metaDescription, 60) : "—"}
                empty={!analysis.metaDescription}
              />
              <MetaStat
                icon={Hash}
                label="Word count"
                value={formatNumber(analysis.wordCount)}
              />
              <MetaStat
                icon={Gauge}
                label="Readability"
                value={`${analysis.readability}/100`}
                hint={
                  analysis.readability >= 70
                    ? "Easy to read"
                    : analysis.readability >= 50
                    ? "Average"
                    : "Difficult"
                }
              />
            </div>
          </div>

          {analysis.keywords.length > 0 && (
            <div className="mt-5 border-t border-ink-100 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                Extracted keywords
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.keywords.slice(0, 15).map((kw, i) => (
                  <Badge key={`${kw}-${i}`} variant="secondary" className="font-mono text-xs">
                    {kw}
                  </Badge>
                ))}
                {analysis.keywords.length > 15 && (
                  <Badge variant="outline" className="text-xs">
                    +{analysis.keywords.length - 15} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed findings</CardTitle>
          <CardDescription>
            AI-flagged issues and prioritized suggestions to improve your SEO.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="issues">
                <AlertTriangle className="h-3.5 w-3.5" />
                Issues
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                  {analysis.issues.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="suggestions">
                <Lightbulb className="h-3.5 w-3.5" />
                Suggestions
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                  {analysis.suggestions.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="raw">
                <Code2 className="h-3.5 w-3.5" />
                Raw JSON
              </TabsTrigger>
            </TabsList>

            <TabsContent value="issues" className="mt-4">
              {analysis.issues.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}
                  title="No issues detected"
                  description="This article passed all of our SEO checks. Nice work!"
                />
              ) : (
                <ul className="space-y-2">
                  {analysis.issues.map((issue, i) => {
                    const severity = (ISSUE_TYPE_TO_SEVERITY[issue.type] || "info") as Severity;
                    const Icon = SEVERITY_ICON[severity];
                    return (
                      <li
                        key={i}
                        className="flex items-start gap-3 rounded-lg border border-ink-100 p-3 transition-colors hover:bg-ink-50/60"
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            SEVERITY_COLOR[severity]
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={SEVERITY_BADGE[severity]} className="text-[10px] uppercase">
                              {issue.type}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-ink-800">{issue.message}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="suggestions" className="mt-4">
              {analysis.suggestions.length === 0 ? (
                <EmptyState
                  icon={<Lightbulb className="h-6 w-6 text-amber-500" />}
                  title="No suggestions"
                  description="There are no specific suggestions for this content."
                />
              ) : (
                <ol className="space-y-2">
                  {analysis.suggestions.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/40 p-3"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700">
                        {i + 1}
                      </div>
                      <p className="pt-0.5 text-sm text-ink-800">{s}</p>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>

            <TabsContent value="raw" className="mt-4">
              <pre className="max-h-[480px] overflow-auto rounded-lg border border-ink-100 bg-ink-950 p-4 text-xs leading-relaxed text-ink-100">
                <code>{JSON.stringify(analysis, null, 2)}</code>
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Readability bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Readability & content metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-ink-700">Readability</span>
              <span className="tabular-nums text-ink-500">{analysis.readability}/100</span>
            </div>
            <Progress
              value={analysis.readability}
              indicatorClassName={cn(
                analysis.readability >= 70
                  ? "bg-emerald-500"
                  : analysis.readability >= 50
                  ? "bg-amber-500"
                  : "bg-red-500"
              )}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-ink-700">SEO score</span>
              <span className="tabular-nums text-ink-500">{analysis.score}/100</span>
            </div>
            <Progress
              value={analysis.score}
              indicatorClassName={cn(
                analysis.score >= 80
                  ? "bg-emerald-500"
                  : analysis.score >= 60
                  ? "bg-amber-500"
                  : "bg-red-500"
              )}
            />
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <MiniStat icon={Hash} label="Words" value={formatNumber(analysis.wordCount)} />
            <MiniStat icon={Tag} label="Keywords" value={formatNumber(analysis.keywords.length)} />
            <MiniStat icon={AlertTriangle} label="Issues" value={formatNumber(analysis.issues.length)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetaStat({
  icon: Icon,
  label,
  value,
  hint,
  empty,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  empty?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-ink-100 bg-ink-50/40 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-ink-500 shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-ink-500">{label}</p>
        <p className={cn("text-sm font-medium", empty ? "italic text-ink-400" : "text-ink-900")}>
          {value}
        </p>
        {hint && <p className="text-[10px] text-ink-500">{hint}</p>}
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-ink-100 p-2.5">
      <Icon className="h-4 w-4 shrink-0 text-ink-400" />
      <div>
        <p className="text-[10px] uppercase tracking-wide text-ink-500">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-ink-900">{value}</p>
      </div>
    </div>
  );
}

function HistoryRow({
  record,
  active,
  onClick,
}: {
  record: AnalysisRecord;
  active: boolean;
  onClick: () => void;
}) {
  const score = record.score ?? record.results.score;
  const label = record.url ? getDomain(record.url) : "Pasted content";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
        active
          ? "border-brand-300 bg-brand-50/60 ring-1 ring-brand-200"
          : "border-ink-100 bg-white hover:border-brand-200 hover:bg-brand-50/30"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{label}</p>
        <p className="truncate text-xs text-ink-500">
          {formatNumber(record.results.wordCount)} words · {formatDate(record.created_at)}
        </p>
      </div>
      {score !== null && (
        <div className="flex flex-col items-end">
          <span
            className={cn(
              "text-sm font-bold tabular-nums",
              score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600"
            )}
          >
            {score}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-ink-400">score</span>
        </div>
      )}
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-300" />
    </button>
  );
}

function AnalysisSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-[180px] w-[180px] rounded-full" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}
