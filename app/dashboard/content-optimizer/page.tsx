"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wand2,
  Sparkles,
  Target,
  ArrowRight,
  Copy,
  Download,
  History,
  RefreshCw,
  Clock,
  FileText,
  Tag,
  ListOrdered,
  TrendingUp,
  TrendingDown,
  Type,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/spinner";
import { ScoreGauge } from "@/components/shared/score-gauge";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate, truncate } from "@/lib/utils";

/* ----------------------------- Types & helpers ---------------------------- */

type Tone = "professional" | "casual" | "expert";

type ImprovementArea =
  | "keyword-density"
  | "title"
  | "headings"
  | "readability"
  | "internal-links";

interface Improvement {
  area: ImprovementArea | string;
  before: string;
  after: string;
  reason: string;
}

interface OptimizationResult {
  originalContent: string;
  optimizedContent: string;
  targetKeyword: string;
  titleSuggestion: string;
  metaDescriptionSuggestion: string;
  changesSummary: string[];
  scoreBefore: number;
  scoreAfter: number;
  improvements: Improvement[];
  requestedTone?: Tone;
}

interface ContentOptimization {
  id: string;
  target_keyword: string;
  results: OptimizationResult;
  created_at: string;
}

const MIN_CHARS = 200;
const MAX_CHARS = 15_000;

const TONES: { value: Tone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "expert", label: "Expert" },
];

const AREA_LABELS: Record<string, string> = {
  "keyword-density": "Keyword density",
  title: "Title",
  headings: "Headings",
  readability: "Readability",
  "internal-links": "Internal links",
};

/* --------------------------- Markdown renderer ---------------------------- */

/** Lightweight markdown renderer — shared with the content-writer page. */
function Markdown({ content }: { content: string }) {
  const blocks = useMemo(() => {
    const lines = content.split(/\r?\n/u);
    const out: { type: string; text: string; items?: string[] }[] = [];
    let listType: "ul" | "ol" | null = null;
    let items: string[] = [];

    const flush = () => {
      if (listType && items.length > 0) {
        out.push({ type: listType, text: "", items });
        listType = null;
        items = [];
      }
    };

    for (const raw of lines) {
      const line = raw.replace(/\s+$/u, "");
      if (!line.trim()) {
        flush();
        continue;
      }
      const h1 = /^#\s+(.*)$/u.exec(line);
      const h2 = /^##\s+(.*)$/u.exec(line);
      const h3 = /^###\s+(.*)$/u.exec(line);
      const h4 = /^####\s+(.*)$/u.exec(line);
      const ul = /^[-*]\s+(.*)$/u.exec(line);
      const ol = /^\d+\.\s+(.*)$/u.exec(line);
      if (h4) {
        flush();
        out.push({ type: "h4", text: h4[1] });
      } else if (h3) {
        flush();
        out.push({ type: "h3", text: h3[1] });
      } else if (h2) {
        flush();
        out.push({ type: "h2", text: h2[1] });
      } else if (h1) {
        flush();
        out.push({ type: "h1", text: h1[1] });
      } else if (ul) {
        if (listType !== "ul") {
          flush();
          listType = "ul";
        }
        items.push(ul[1]);
      } else if (ol) {
        if (listType !== "ol") {
          flush();
          listType = "ol";
        }
        items.push(ol[1]);
      } else {
        flush();
        out.push({ type: "p", text: line });
      }
    }
    flush();
    return out;
  }, [content]);

  return (
    <div className="space-y-3 text-ink-700">
      {blocks.map((b, i) => {
        if (b.type === "h1")
          return (
            <h1 key={i} className="text-2xl font-bold text-ink-900 sm:text-3xl">
              <Inline text={b.text} />
            </h1>
          );
        if (b.type === "h2")
          return (
            <h2 key={i} className="mt-4 text-xl font-bold text-ink-900 sm:text-2xl">
              <Inline text={b.text} />
            </h2>
          );
        if (b.type === "h3")
          return (
            <h3 key={i} className="mt-3 text-lg font-semibold text-ink-900">
              <Inline text={b.text} />
            </h3>
          );
        if (b.type === "h4")
          return (
            <h4 key={i} className="mt-2 text-base font-semibold text-ink-900">
              <Inline text={b.text} />
            </h4>
          );
        if (b.type === "ul")
          return (
            <ul key={i} className="ml-5 list-disc space-y-1.5">
              {b.items!.map((it, j) => (
                <li key={j} className="text-sm leading-relaxed">
                  <Inline text={it} />
                </li>
              ))}
            </ul>
          );
        if (b.type === "ol")
          return (
            <ol key={i} className="ml-5 list-decimal space-y-1.5">
              {b.items!.map((it, j) => (
                <li key={j} className="text-sm leading-relaxed">
                  <Inline text={it} />
                </li>
              ))}
            </ol>
          );
        return (
          <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">
            <Inline text={b.text} />
          </p>
        );
      })}
    </div>
  );
}

function Inline({ text }: { text: string }) {
  const parts = text
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/gu)
    .filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (/^\*\*[^*]+\*\*$/u.test(part))
          return (
            <strong key={i} className="font-semibold text-ink-900">
              {part.slice(2, -2)}
            </strong>
          );
        if (/^`[^`]+`$/u.test(part))
          return (
            <code
              key={i}
              className="rounded bg-ink-100 px-1 py-0.5 font-mono text-xs text-ink-800"
            >
              {part.slice(1, -1)}
            </code>
          );
        if (/^\*[^*]+\*$/u.test(part))
          return (
            <em key={i} className="italic">
              {part.slice(1, -1)}
            </em>
          );
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/* --------------------------------- Page ---------------------------------- */

export default function ContentOptimizerPage() {
  const { toast } = useToast();

  const [targetKeyword, setTargetKeyword] = useState("");
  const [content, setContent] = useState("");
  const [tone, setTone] = useState<Tone>("professional");

  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<ContentOptimization | null>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  const [reports, setReports] = useState<ContentOptimization[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const charCount = content.length;
  const canOptimize =
    targetKeyword.trim().length >= 2 &&
    charCount >= MIN_CHARS &&
    charCount <= MAX_CHARS &&
    !running;

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/content-optimizer", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load optimizations");
      const list: ContentOptimization[] = json.data || [];
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

  const optimize = async () => {
    const kw = targetKeyword.trim();
    const body = content.trim();
    if (kw.length < 2) {
      toast("warning", "Enter a target keyword", "Target keyword must be at least 2 characters.");
      return;
    }
    if (body.length < MIN_CHARS) {
      toast(
        "warning",
        "Content too short",
        `Content must be at least ${MIN_CHARS} characters.`
      );
      return;
    }
    if (body.length > MAX_CHARS) {
      toast(
        "warning",
        "Content too long",
        `Content must be at most ${MAX_CHARS.toLocaleString()} characters.`
      );
      return;
    }
    setRunning(true);
    setCurrent(null);
    try {
      const res = await fetch("/api/content-optimizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: body,
          targetKeyword: kw,
          tone,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Content optimization failed");
      const optimization: ContentOptimization | undefined = json.data?.optimization;
      if (!optimization) throw new Error("Malformed response from server");
      if (json.data?.credits_left !== undefined) setCreditsLeft(json.data.credits_left);
      setCurrent(optimization);
      toast(
        "success",
        "Optimization ready",
        `Score ${optimization.results.scoreBefore} → ${optimization.results.scoreAfter}`
      );
      const fresh = await loadHistory();
      const match = fresh.find((r) => r.id === optimization.id);
      if (match) setCurrent(match);
    } catch (err) {
      toast(
        "error",
        "Optimization failed",
        err instanceof Error ? err.message : "Try again later"
      );
    } finally {
      setRunning(false);
    }
  };

  const selectReport = (report: ContentOptimization) => {
    setCurrent(report);
    setTargetKeyword(report.target_keyword || report.results.targetKeyword);
    setContent(report.results.originalContent || "");
    if (report.results.requestedTone) setTone(report.results.requestedTone);
    toast("info", "Loaded optimization", formatDate(report.created_at));
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
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Content Optimizer</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              Rewrite your content for better SEO. Paste an article, choose a target keyword,
              and get an optimized version with a higher score, suggested title and meta
              description.
            </p>
          </div>
        </div>
      </section>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-brand-600" />
            Optimize an article
          </CardTitle>
          <CardDescription>
            Each optimization costs 2 credits. Paste 200–15,000 characters and pick a target
            keyword.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Target keyword */}
          <div className="space-y-2">
            <Label htmlFor="targetKeyword" className="text-xs font-medium text-ink-600">
              Target keyword <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Target className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input
                id="targetKeyword"
                type="text"
                placeholder="best running shoes"
                value={targetKeyword}
                onChange={(e) => setTargetKeyword(e.target.value)}
                disabled={running}
                className="pl-9"
                maxLength={120}
              />
            </div>
          </div>

          {/* Content textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content" className="text-xs font-medium text-ink-600">
                Content <span className="text-red-500">*</span>
              </Label>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  charCount < MIN_CHARS
                    ? "text-amber-600"
                    : charCount > MAX_CHARS
                    ? "text-red-600"
                    : "text-ink-500"
                )}
              >
                {charCount.toLocaleString()} / {MIN_CHARS}–{MAX_CHARS.toLocaleString()}
              </span>
            </div>
            <Textarea
              id="content"
              placeholder="Paste your article here…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={running}
              className="min-h-[260px] font-mono text-xs leading-relaxed"
              maxLength={MAX_CHARS + 100}
            />
          </div>

          {/* Tone chips */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-ink-600">Tone</Label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTone(t.value)}
                  disabled={running}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors disabled:opacity-50",
                    tone === t.value
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-500">
              <span className="font-medium text-amber-700">Costs 2 credits</span> · {tone} tone
            </p>
            <Button
              onClick={optimize}
              disabled={!canOptimize}
              variant="gradient"
              size="lg"
              className="shrink-0"
            >
              {running ? (
                <>
                  <Spinner size="sm" className="border-white/40 border-t-white" />
                  Optimizing…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Optimize content
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {running && <OptimizerSkeleton />}

      {/* Results */}
      {!running && current && (
        <OptimizerResults
          optimization={current}
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
              icon={<Wand2 className="h-6 w-6 text-brand-500" />}
              title="Optimize your first article"
              description="Paste your content above, choose a target keyword, and the AI will rewrite it for better SEO."
              action={
                <Button
                  variant="gradient"
                  onClick={() => {
                    setTargetKeyword("best running shoes");
                    setContent(
                      `Looking for the best running shoes? You're not alone.\n\nRunning is one of the most accessible ways to stay fit, but the wrong pair of shoes can lead to injuries and discomfort. In this guide, we'll walk you through everything you need to know about picking the best running shoes for your feet and your goals.\n\nWhy the right shoes matter\nWearing the right running shoes can prevent common injuries such as shin splints, plantar fasciitis, and runner's knee. The wrong shoes can also lead to blisters, black toenails, and general fatigue.\n\nHow to choose running shoes\nThere are several factors to consider when shopping for running shoes. First, know your foot type: flat, neutral, or high arch. Next, consider the surface you'll be running on — road, trail, or track. Finally, think about cushioning and drop.\n\nConclusion\nFinding the best running shoes takes some trial and error, but it's worth it. Visit a specialty running store if you can, and don't be afraid to test multiple pairs before committing.`
                    );
                    setTone("professional");
                  }}
                  disabled={running}
                >
                  <Wand2 className="h-4 w-4" />
                  Use a sample article
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

function OptimizerResults({
  optimization,
  creditsLeft,
  reports,
  loadingHistory,
  onRefreshHistory,
  onSelectReport,
}: {
  optimization: ContentOptimization;
  creditsLeft: number | null;
  reports: ContentOptimization[];
  loadingHistory: boolean;
  onRefreshHistory: () => void;
  onSelectReport: (report: ContentOptimization) => void;
}) {
  const result = optimization.results;
  const { toast } = useToast();

  const delta = result.scoreAfter - result.scoreBefore;
  const isImprovement = delta >= 0;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("success", "Copied", `${label} copied to clipboard`);
    } catch {
      toast("error", "Copy failed", "Clipboard access was denied");
    }
  };

  const downloadMarkdown = () => {
    const filename = `${result.targetKeyword.replace(/[^a-z0-9]+/giu, "-").toLowerCase().slice(0, 60) || "optimized"}.md`;
    const blob = new Blob([result.optimizedContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("success", "Download started", filename);
  };

  return (
    <div className="space-y-6">
      {/* Score comparison header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="px-2 py-0.5">
              <Target className="h-3 w-3" />
              {result.targetKeyword}
            </Badge>
            <Badge variant="outline" className="px-2 py-0 text-[10px]">
              {formatDate(optimization.created_at)}
            </Badge>
            {creditsLeft !== null && (
              <Badge variant="outline" className="px-2 py-0 text-[10px]">
                {creditsLeft} credits left
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-4 sm:flex-row sm:gap-6">
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Before</p>
              <ScoreGauge score={result.scoreBefore} size="md" label="SEO" />
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1 text-ink-400">
                <ArrowRight className="h-6 w-6" />
              </div>
              <Badge
                variant={isImprovement ? "success" : "warning"}
                className="px-3 py-1 text-sm"
              >
                {isImprovement ? (
                  <>
                    <TrendingUp className="h-3 w-3" />+{delta}
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3 w-3" />{delta}
                  </>
                )}
              </Badge>
            </div>

            <div className="flex flex-col items-center gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">After</p>
              <ScoreGauge score={result.scoreAfter} size="md" label="SEO" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-600" />
            Optimization detail
          </CardTitle>
          <CardDescription>
            Read the optimized content, suggested title/meta, or browse past optimizations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="optimized">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
              <TabsTrigger value="optimized">
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Content</span>
              </TabsTrigger>
              <TabsTrigger value="meta">
                <Tag className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Title &amp; Meta</span>
              </TabsTrigger>
              <TabsTrigger value="summary">
                <ListOrdered className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Summary</span>
              </TabsTrigger>
              <TabsTrigger value="improvements">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Improvements</span>
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">History</span>
              </TabsTrigger>
            </TabsList>

            {/* Optimized content */}
            <TabsContent value="optimized" className="mt-4">
              <div className="relative">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(result.optimizedContent, "Optimized content")
                    }
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadMarkdown}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download as .md
                  </Button>
                </div>
                <div className="mt-2 max-h-[700px] overflow-y-auto rounded-lg border border-ink-100 bg-white p-5 sm:p-6">
                  <Markdown content={result.optimizedContent} />
                </div>
              </div>
            </TabsContent>

            {/* Title & Meta */}
            <TabsContent value="meta" className="mt-4 space-y-4">
              <Card className="card-hover">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Type className="h-4 w-4 text-brand-600" />
                      Title suggestion
                    </CardTitle>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() =>
                        copyToClipboard(result.titleSuggestion, "Title")
                      }
                      aria-label="Copy title"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-base font-semibold text-ink-900">
                    {result.titleSuggestion}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {result.titleSuggestion.length} characters
                  </p>
                </CardContent>
              </Card>
              <Card className="card-hover">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Tag className="h-4 w-4 text-brand-600" />
                      Meta description suggestion
                    </CardTitle>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() =>
                        copyToClipboard(result.metaDescriptionSuggestion, "Meta description")
                      }
                      aria-label="Copy meta description"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-ink-700">
                    {result.metaDescriptionSuggestion}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {result.metaDescriptionSuggestion.length} characters
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Changes summary */}
            <TabsContent value="summary" className="mt-4">
              {!Array.isArray(result.changesSummary) ||
              result.changesSummary.length === 0 ? (
                <EmptyState
                  icon={<ListOrdered className="h-6 w-6 text-ink-400" />}
                  title="No change summary"
                  description="The AI did not provide a summary of changes."
                />
              ) : (
                <ol className="space-y-2">
                  {result.changesSummary.map((change, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-lg border border-ink-100 bg-white p-3"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                        {i + 1}
                      </span>
                      <p className="text-sm leading-relaxed text-ink-700">{change}</p>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>

            {/* Improvements detail */}
            <TabsContent value="improvements" className="mt-4">
              {!Array.isArray(result.improvements) ||
              result.improvements.length === 0 ? (
                <EmptyState
                  icon={<Sparkles className="h-6 w-6 text-ink-400" />}
                  title="No improvement details"
                  description="The AI did not surface any structured improvement entries."
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.improvements.map((imp, i) => (
                    <ImprovementCard key={i} imp={imp} index={i} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* History */}
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

function ImprovementCard({ imp, index }: { imp: Improvement; index: number }) {
  const areaLabel = AREA_LABELS[imp.area] || imp.area || "General";
  return (
    <Card className="card-hover flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
            {index + 1}
          </span>
          <Badge variant="outline" className="px-2 py-0.5 capitalize">
            {areaLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-ink-100 bg-ink-50/40 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Before</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-700">
              {imp.before || "—"}
            </p>
          </div>
          <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-600">After</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-800">
              {imp.after || "—"}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <ArrowRight className="mt-0.5 hidden h-3.5 w-3.5 shrink-0 rotate-0 text-ink-300 sm:block" />
          <p className="text-xs italic leading-relaxed text-ink-500">{imp.reason}</p>
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
  reports: ContentOptimization[];
  loading: boolean;
  onRefresh: () => void;
  onSelect: (report: ContentOptimization) => void;
  embedded?: boolean;
}) {
  return (
    <Card className={embedded ? "border-0 shadow-none" : ""}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-ink-400" />
            {embedded ? "Past optimizations" : "Recent optimizations"}
          </CardTitle>
          <CardDescription>
            {embedded
              ? "Click any optimization to view its result."
              : "Your recently optimized articles."}
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
              icon={<Wand2 className="h-6 w-6" />}
              title="No optimizations yet"
              description="Your content optimizations will appear here."
            />
          </div>
        ) : (
          <ul className="max-h-[640px] divide-y divide-ink-100 overflow-y-auto">
            {reports.map((report) => {
              const r = report.results;
              const delta = r.scoreAfter - r.scoreBefore;
              return (
                <li key={report.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(report)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50/70"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <Wand2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium text-ink-900"
                        title={report.target_keyword || r.targetKeyword}
                      >
                        {truncate(report.target_keyword || r.targetKeyword, 50)}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-ink-500">
                        <Clock className="h-3 w-3" />
                        {formatDate(report.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-500 tabular-nums">{r.scoreBefore}</span>
                      <ArrowRight className="h-3 w-3 text-ink-300" />
                      <span
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          delta >= 0 ? "text-emerald-600" : "text-amber-600"
                        )}
                      >
                        {r.scoreAfter}
                      </span>
                      <Badge
                        variant={delta >= 0 ? "success" : "warning"}
                        className="px-2 py-0 text-[10px]"
                      >
                        {delta >= 0 ? `+${delta}` : delta}
                      </Badge>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function OptimizerSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-ink-100 p-4">
            <Skeleton className="h-[120px] w-[120px] rounded-full" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
