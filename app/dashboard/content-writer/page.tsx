"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  PenLine,
  FileText,
  Hash,
  Clock,
  Copy,
  ListOrdered,
  History,
  RefreshCw,
  Type,
  Wand2,
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
import { cn, formatDate, truncate } from "@/lib/utils";

/* ----------------------------- Types & helpers ---------------------------- */

type Tone = "professional" | "casual" | "friendly" | "expert";

interface ArticleResult {
  title: string;
  slug: string;
  metaDescription: string;
  content: string;
  headings: string[];
  suggestedKeywords: string[];
  estimatedReadTime: number;
  seoScore: number;
  requestedWordCount?: number;
  requestedTone?: Tone;
  requestedKeywords?: string[];
}

interface ContentWrite {
  id: string;
  topic: string;
  results: ArticleResult;
  created_at: string;
}

const WORD_COUNTS = [500, 800, 1200, 2000] as const;
const TONES: { value: Tone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "friendly", label: "Friendly" },
  { value: "expert", label: "Expert" },
];

function parseKeywords(value: string): string[] {
  return value
    .split(/[,\n]+/u)
    .map((k) => k.trim())
    .filter((k) => k.length >= 2)
    .slice(0, 20);
}

/* --------------------------- Markdown renderer ---------------------------- */

/**
 * Lightweight inline markdown renderer supporting:
 * - H1/H2/H3/H4 (#, ##, ###, ####)
 * - Unordered lists (-, *)
 * - Ordered lists (1.)
 * - Bold (**text**), italic (*text*), inline code (`code`)
 * - Paragraph fallback with whitespace-pre-wrap
 */
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

/** Render inline **bold**, *italic*, and `code`. */
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

export default function ContentWriterPage() {
  const { toast } = useToast();

  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [wordCount, setWordCount] = useState<number>(800);
  const [tone, setTone] = useState<Tone>("professional");

  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<ContentWrite | null>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  const [reports, setReports] = useState<ContentWrite[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/content-writer", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load articles");
      const list: ContentWrite[] = json.data || [];
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

  const generate = async () => {
    const trimmed = topic.trim();
    if (trimmed.length < 3) {
      toast("warning", "Enter a topic", "Topic must be at least 3 characters.");
      return;
    }
    setRunning(true);
    setCurrent(null);
    try {
      const body: Record<string, unknown> = {
        topic: trimmed,
        wordCount,
        tone,
      };
      const kws = parseKeywords(keywords);
      if (kws.length > 0) body.keywords = kws;

      const res = await fetch("/api/content-writer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Content generation failed");
      const article: ContentWrite | undefined = json.data?.article;
      if (!article) throw new Error("Malformed response from server");
      if (json.data?.credits_left !== undefined) setCreditsLeft(json.data.credits_left);
      setCurrent(article);
      toast(
        "success",
        "Article ready",
        article.results.title.length > 60
          ? `${article.results.title.slice(0, 60)}…`
          : article.results.title
      );
      const fresh = await loadHistory();
      const match = fresh.find((r) => r.id === article.id);
      if (match) setCurrent(match);
    } catch (err) {
      toast(
        "error",
        "Generation failed",
        err instanceof Error ? err.message : "Try again later"
      );
    } finally {
      setRunning(false);
    }
  };

  const selectReport = (report: ContentWrite) => {
    setCurrent(report);
    setTopic(report.topic);
    if (typeof report.results.requestedWordCount === "number") {
      setWordCount(report.results.requestedWordCount);
    }
    if (report.results.requestedTone) {
      setTone(report.results.requestedTone);
    }
    toast("info", "Loaded article", formatDate(report.created_at));
  };

  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !running) generate();
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
            <h1 className="text-2xl font-bold text-white sm:text-3xl">AI Content Writer</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              Generate SEO-optimized articles in seconds. Pick a topic, choose the tone and word
              count, and get a ready-to-publish draft with title, slug, meta description and
              headings.
            </p>
          </div>
        </div>
      </section>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-brand-600" />
            Write a new article
          </CardTitle>
          <CardDescription>
            Each generation costs 2 credits and produces a complete markdown article with SEO
            metadata.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Topic */}
          <div className="space-y-2">
            <Label htmlFor="topic" className="text-xs font-medium text-ink-600">
              Topic <span className="text-red-500">*</span>
            </Label>
            <Input
              id="topic"
              type="text"
              placeholder="How to start a podcast"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={submitOnEnter}
              disabled={running}
              maxLength={200}
            />
          </div>

          {/* Keywords */}
          <div className="space-y-2">
            <Label htmlFor="keywords" className="text-xs font-medium text-ink-600">
              Keywords <span className="text-ink-400">(optional, comma-separated)</span>
            </Label>
            <Input
              id="keywords"
              type="text"
              placeholder="podcast equipment, audio editing, microphone"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              onKeyDown={submitOnEnter}
              disabled={running}
            />
          </div>

          {/* Word count chips */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-ink-600">Word count</Label>
            <div className="flex flex-wrap gap-2">
              {WORD_COUNTS.map((wc) => (
                <button
                  key={wc}
                  type="button"
                  onClick={() => setWordCount(wc)}
                  disabled={running}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                    wordCount === wc
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                  )}
                >
                  {wc.toLocaleString()} words
                </button>
              ))}
            </div>
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
              <span className="font-medium text-amber-700">Costs 2 credits</span> · roughly{" "}
              {wordCount.toLocaleString()} words · {tone} tone
            </p>
            <Button
              onClick={generate}
              disabled={running}
              variant="gradient"
              size="lg"
              className="shrink-0"
            >
              {running ? (
                <>
                  <Spinner size="sm" className="border-white/40 border-t-white" />
                  Generating…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate article
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading skeleton */}
      {running && <WriterSkeleton />}

      {/* Results */}
      {!running && current && (
        <WriterResults
          write={current}
          creditsLeft={creditsLeft}
          reports={reports}
          loadingHistory={loadingHistory}
          onRefreshHistory={loadHistory}
          onSelectReport={selectReport}
        />
      )}

      {/* Empty state — no articles at all */}
      {!running && !current && reports.length === 0 && !loadingHistory && (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<PenLine className="h-6 w-6 text-brand-500" />}
              title="Generate your first article"
              description="Enter a topic above and the AI will draft a complete SEO-optimized article in seconds."
              action={
                <Button
                  variant="gradient"
                  onClick={() => {
                    setTopic("How to start a podcast");
                    setKeywords("podcast equipment, audio editing, microphone");
                    setWordCount(800);
                    setTone("friendly");
                  }}
                  disabled={running}
                >
                  <PenLine className="h-4 w-4" />
                  Use a sample topic
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* History list — visible when no current article but reports exist */}
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

function WriterResults({
  write,
  creditsLeft,
  reports,
  loadingHistory,
  onRefreshHistory,
  onSelectReport,
}: {
  write: ContentWrite;
  creditsLeft: number | null;
  reports: ContentWrite[];
  loadingHistory: boolean;
  onRefreshHistory: () => void;
  onSelectReport: (report: ContentWrite) => void;
}) {
  const article = write.results;
  const { toast } = useToast();

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("success", "Copied", `${label} copied to clipboard`);
    } catch {
      toast("error", "Copy failed", "Clipboard access was denied");
    }
  };

  return (
    <div className="space-y-6">
      {/* Article header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start gap-2">
            <Badge
              variant={
                article.seoScore >= 80
                  ? "success"
                  : article.seoScore >= 60
                  ? "warning"
                  : "destructive"
              }
              className="px-2 py-0.5"
            >
              <Sparkles className="h-3 w-3" />
              SEO {article.seoScore}
            </Badge>
            <Badge variant="outline" className="px-2 py-0.5">
              <Clock className="h-3 w-3" />
              {article.estimatedReadTime} min read
            </Badge>
            {creditsLeft !== null && (
              <Badge variant="outline" className="px-2 py-0 text-[10px]">
                {creditsLeft} credits left
              </Badge>
            )}
            <Badge variant="outline" className="ml-auto px-2 py-0 text-[10px]">
              {formatDate(write.created_at)}
            </Badge>
          </div>
          <CardTitle className="mt-2 text-xl font-bold leading-tight text-ink-900 sm:text-2xl">
            {article.title}
          </CardTitle>
          {article.metaDescription && (
            <CardDescription className="text-sm text-ink-600">
              {article.metaDescription}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-ink-50 p-3">
            <span className="text-xs font-medium text-ink-500">Slug</span>
            <code className="font-mono text-xs text-brand-700">/{article.slug}</code>
            <Button
              size="icon-sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => copyToClipboard(article.slug, "Slug")}
              aria-label="Copy slug"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-600" />
            Article detail
          </CardTitle>
          <CardDescription>
            Read the full draft, suggested keywords, headings outline, or browse past articles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="article">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="article">
                <FileText className="h-3.5 w-3.5" />
                Article
              </TabsTrigger>
              <TabsTrigger value="keywords">
                <Hash className="h-3.5 w-3.5" />
                Keywords
              </TabsTrigger>
              <TabsTrigger value="outline">
                <ListOrdered className="h-3.5 w-3.5" />
                Outline
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-3.5 w-3.5" />
                History
              </TabsTrigger>
            </TabsList>

            {/* Article */}
            <TabsContent value="article" className="mt-4">
              <div className="relative">
                <div className="absolute right-0 top-0 z-10">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(article.content, "Article")}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy to clipboard
                  </Button>
                </div>
                <div className="max-h-[700px] overflow-y-auto rounded-lg border border-ink-100 bg-white p-5 pt-12 sm:p-6 sm:pt-12">
                  <Markdown content={article.content} />
                </div>
              </div>
            </TabsContent>

            {/* Suggested keywords */}
            <TabsContent value="keywords" className="mt-4">
              {article.suggestedKeywords.length === 0 ? (
                <EmptyState
                  icon={<Hash className="h-6 w-6 text-ink-400" />}
                  title="No suggested keywords"
                  description="The AI did not return any related keyword suggestions."
                />
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {article.suggestedKeywords.map((kw, i) => (
                    <button
                      key={`${kw}-${i}`}
                      type="button"
                      onClick={() => copyToClipboard(kw, "Keyword")}
                      className="card-hover flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-left text-sm text-ink-700 hover:border-brand-300"
                    >
                      <Hash className="h-3.5 w-3.5 text-brand-500" />
                      <span className="truncate">{kw}</span>
                      <Copy className="ml-auto h-3 w-3 text-ink-300" />
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Headings outline */}
            <TabsContent value="outline" className="mt-4">
              {article.headings.length === 0 ? (
                <EmptyState
                  icon={<ListOrdered className="h-6 w-6 text-ink-400" />}
                  title="No headings detected"
                  description="The AI did not provide a separate headings list."
                />
              ) : (
                <ol className="space-y-2">
                  {article.headings.map((h, i) => {
                    const isH3 = /^h3[:\s]/iu.test(h);
                    const cleaned = h.replace(/^h[23]\s*:\s*/iu, "").trim();
                    return (
                      <li
                        key={`${h}-${i}`}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border border-ink-100 bg-white p-3",
                          isH3 && "ml-6 bg-ink-50/40"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            isH3 ? "bg-ink-100 text-ink-600" : "bg-brand-100 text-brand-700"
                          )}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
                            {isH3 ? "H3" : "H2"}
                          </span>
                          <p className="text-sm font-medium text-ink-900">{cleaned}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
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

function ReportsList({
  reports,
  loading,
  onRefresh,
  onSelect,
  embedded = false,
}: {
  reports: ContentWrite[];
  loading: boolean;
  onRefresh: () => void;
  onSelect: (report: ContentWrite) => void;
  embedded?: boolean;
}) {
  return (
    <Card className={embedded ? "border-0 shadow-none" : ""}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-ink-400" />
            {embedded ? "Past articles" : "Recent articles"}
          </CardTitle>
          <CardDescription>
            {embedded
              ? "Click any article to view its content."
              : "Your recently generated articles."}
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
              icon={<PenLine className="h-6 w-6" />}
              title="No articles yet"
              description="Your generated articles will appear here."
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
                    <Type className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900" title={report.topic}>
                      {truncate(report.topic, 60)}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-ink-500">
                      <Clock className="h-3 w-3" />
                      {formatDate(report.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-brand-700 tabular-nums">
                      {report.results.seoScore}
                    </span>
                    <Badge variant="outline" className="px-2 py-0 text-[10px]">
                      {report.results.estimatedReadTime} min
                    </Badge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function WriterSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 animate-pulse text-brand-500" />
          <p className="text-sm font-medium text-ink-700">Writing your article…</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="space-y-2 rounded-lg border border-ink-100 p-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </CardContent>
    </Card>
  );
}
