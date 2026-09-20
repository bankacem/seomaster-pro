"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Sparkles,
  Download,
  TrendingUp,
  Target,
  DollarSign,
  Gauge,
  History,
  RefreshCw,
  ArrowRight,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState, Skeleton } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate, formatNumber, truncate } from "@/lib/utils";

/* ----------------------------- Types & helpers ---------------------------- */

type Competition = "low" | "medium" | "high";
type Intent = "informational" | "commercial" | "transactional" | "navigational";

interface KeywordIdea {
  keyword: string;
  search_volume: number;
  difficulty: number;
  cpc: number;
  competition: Competition;
  intent: Intent;
}

interface KeywordHistoryItem {
  id: string;
  topic: string;
  results: { keywords: KeywordIdea[] };
  created_at: string;
}

const EXAMPLE_CHIPS = ["content marketing", "saas growth", "email outreach", "local seo"];

function difficultyMeta(score: number): { label: string; color: string; bar: string } {
  if (score <= 30) return { label: "Easy", color: "text-emerald-600", bar: "bg-emerald-500" };
  if (score <= 60) return { label: "Medium", color: "text-amber-600", bar: "bg-amber-500" };
  return { label: "Hard", color: "text-red-600", bar: "bg-red-500" };
}

const COMPETITION_VARIANT: Record<Competition, "success" | "warning" | "destructive"> = {
  low: "success",
  medium: "warning",
  high: "destructive",
};

const INTENT_VARIANT: Record<Intent, "info" | "warning" | "success" | "secondary"> = {
  informational: "info",
  commercial: "warning",
  transactional: "success",
  navigational: "secondary",
};

const INTENT_ICON: Record<Intent, React.ElementType> = {
  informational: Target,
  commercial: Gauge,
  transactional: DollarSign,
  navigational: Search,
};

function buildCsv(rows: KeywordIdea[]): string {
  const header = ["Keyword", "Search Volume", "Difficulty", "CPC (USD)", "Competition", "Intent"];
  const escape = (val: string | number) => {
    const s = String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        escape(r.keyword),
        r.search_volume,
        r.difficulty,
        r.cpc.toFixed(2),
        r.competition,
        r.intent,
      ].join(",")
    );
  }
  return lines.join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* --------------------------------- Page ---------------------------------- */

export default function KeywordResearchPage() {
  const { toast } = useToast();

  const [topic, setTopic] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<KeywordIdea[] | null>(null);
  const [activeTopic, setActiveTopic] = useState<string>("");
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  const [history, setHistory] = useState<KeywordHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/keywords", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load keyword research history");
      const list: KeywordHistoryItem[] = json.data || [];
      setHistory(list);
      return list;
    } catch (err) {
      toast("error", "Could not load history", err instanceof Error ? err.message : "Try again later");
      setHistory([]);
      return [];
    } finally {
      setLoadingHistory(false);
    }
  }, [toast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const generate = async (overrideTopic?: string) => {
    const trimmed = (overrideTopic ?? topic).trim();
    if (!trimmed) {
      toast("warning", "Enter a topic", "Provide a topic to generate keyword ideas.");
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 100) {
      toast("warning", "Topic length", "Topic must be 2–100 characters.");
      return;
    }
    setRunning(true);
    setResults(null);
    setActiveTopic(trimmed);
    setActiveId(null);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Keyword research failed");
      const keywords: KeywordIdea[] = json.data?.keywords || [];
      if (json.data?.credits_left !== undefined) setCreditsLeft(json.data.credits_left);
      setResults(keywords);
      toast("success", "Keywords generated", `Found ${keywords.length} ideas for "${trimmed}"`);
      // Refresh history in the background so the new run appears.
      const fresh = await loadHistory();
      const match = fresh.find((h) => h.topic === trimmed);
      if (match) setActiveId(match.id);
    } catch (err) {
      toast("error", "Generation failed", err instanceof Error ? err.message : "Try again later");
    } finally {
      setRunning(false);
    }
  };

  const selectHistory = (item: KeywordHistoryItem) => {
    setResults(item.results.keywords);
    setActiveTopic(item.topic);
    setActiveId(item.id);
    setTopic(item.topic);
    toast("info", "Loaded research", `"${item.topic}" · ${formatDate(item.created_at)}`);
  };

  const handleExport = () => {
    if (!results || results.length === 0) return;
    const slug = activeTopic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "keywords";
    downloadCsv(`keywords-${slug}.csv`, buildCsv(results));
    toast("success", "Exported CSV", `${results.length} keywords downloaded.`);
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
            Powered by AI
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Keyword Research</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              Discover high-intent keyword ideas with AI-powered estimates for search volume, difficulty, CPC,
              competition and intent. Find opportunities in seconds.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Search + Results — left 60% */}
        <div className="space-y-6 lg:col-span-3">
          {/* Search form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-4 w-4 text-brand-600" />
                Research a topic
              </CardTitle>
              <CardDescription>
                Enter any topic or niche. We&apos;ll generate 10 keyword ideas with realistic SEO estimates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="topic" className="text-xs font-medium text-ink-600">
                  Topic
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                    <Input
                      id="topic"
                      type="text"
                      placeholder="e.g. content marketing"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      onKeyDown={submitOnEnter}
                      disabled={running}
                      maxLength={100}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    onClick={() => generate()}
                    disabled={running}
                    variant="gradient"
                    size="lg"
                    className="shrink-0"
                  >
                    {running ? (
                      <>
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        Generating…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate ideas
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-500">Try:</span>
                {EXAMPLE_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={running}
                    onClick={() => {
                      setTopic(chip);
                      generate(chip);
                    }}
                    className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-700 transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Loading state */}
          {running && <ResultsSkeleton />}

          {/* Results */}
          {!running && results && results.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-brand-600" />
                    Keyword ideas for &ldquo;{truncate(activeTopic, 40)}&rdquo;
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {results.length} ideas generated{creditsLeft !== null ? ` · ${creditsLeft} credits left` : ""}.
                    AI estimates for guidance only.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0">
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <KeywordsTable rows={results} />
              </CardContent>
              <CardFooter className="justify-between gap-3 border-t border-ink-100 px-6 py-3">
                <p className="text-xs text-ink-500">
                  Tip: focus on low-difficulty, high-intent keywords first.
                </p>
                <Button variant="ghost" size="sm" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Empty state — only when no results at all and not loading */}
          {!running && !results && history.length === 0 && (
            <Card>
              <CardContent className="p-6">
                <EmptyState
                  icon={<Search className="h-6 w-6 text-brand-500" />}
                  title="Start your first keyword research"
                  description="Enter a topic above (or pick an example chip) and we'll surface 10 keyword ideas with metrics."
                  action={
                    <Button
                      variant="gradient"
                      onClick={() => generate("content marketing")}
                      disabled={running}
                    >
                      <Sparkles className="h-4 w-4" />
                      Try &ldquo;content marketing&rdquo;
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          )}

          {/* Hint state — history exists but no results loaded yet */}
          {!running && !results && history.length > 0 && (
            <Card className="border-dashed bg-ink-50/40">
              <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink-400 shadow-sm">
                  <Search className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-medium text-ink-900">Pick a research from history or start fresh</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Click any item on the right to view past results, or enter a new topic above.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* History sidebar — right 40% */}
        <div className="lg:col-span-2">
          <Card className="lg:sticky lg:top-6">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4 text-ink-400" />
                  Recent research
                </CardTitle>
                <CardDescription>Your last 5 keyword research runs.</CardDescription>
              </div>
              {history.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => loadHistory()} disabled={loadingHistory}>
                  <RefreshCw className={cn("h-3.5 w-3.5", loadingHistory && "animate-spin")} />
                  Refresh
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {loadingHistory ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-12" />
                    </div>
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={<History className="h-6 w-6" />}
                    title="No research yet"
                    description="Your keyword research history will appear here."
                  />
                </div>
              ) : (
                <ul className="max-h-[640px] divide-y divide-ink-100 overflow-y-auto">
                  {history.slice(0, 5).map((item) => {
                    const isActive = item.id === activeId;
                    const count = item.results?.keywords?.length ?? 0;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => selectHistory(item)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50/70",
                            isActive && "bg-brand-50/60"
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                              isActive ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-500"
                            )}
                          >
                            <Search className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink-900">{item.topic}</p>
                            <p className="flex items-center gap-1 text-xs text-ink-500">
                              <Clock className="h-3 w-3" />
                              {formatDate(item.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                              {count}
                            </Badge>
                            <ArrowRight className="h-3.5 w-3.5 text-ink-300" />
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Sub components ----------------------------- */

function ResultsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-2 h-3 w-72" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function KeywordsTable({ rows }: { rows: readonly KeywordIdea[] }) {
  const ordered = useMemo(() => [...rows].sort((a, b) => b.search_volume - a.search_volume), [rows]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
            <th className="px-4 py-3 text-left font-medium">Keyword</th>
            <th className="px-4 py-3 text-right font-medium">Volume</th>
            <th className="px-4 py-3 text-left font-medium">Difficulty</th>
            <th className="px-4 py-3 text-right font-medium">CPC</th>
            <th className="px-4 py-3 text-left font-medium">Competition</th>
            <th className="px-4 py-3 text-left font-medium">Intent</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((row, idx) => {
            const meta = difficultyMeta(row.difficulty);
            const IntentIcon = INTENT_ICON[row.intent];
            return (
              <tr
                key={`${row.keyword}-${idx}`}
                className="border-b border-ink-50 transition-colors last:border-0 hover:bg-brand-50/30"
              >
                <td className="px-4 py-3">
                  <span className="font-medium text-ink-900">{row.keyword}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-700">
                  {formatNumber(row.search_volume)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Progress
                      value={row.difficulty}
                      indicatorClassName={meta.bar}
                      className="h-1.5 w-16 bg-ink-100"
                    />
                    <span className={cn("text-xs font-medium tabular-nums", meta.color)}>
                      {row.difficulty}
                    </span>
                    <span className={cn("text-xs", meta.color)}>{meta.label}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-700">
                  ${row.cpc.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={COMPETITION_VARIANT[row.competition]} className="capitalize">
                    {row.competition}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={INTENT_VARIANT[row.intent]} className="capitalize">
                    <IntentIcon className="h-3 w-3" />
                    {row.intent}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
