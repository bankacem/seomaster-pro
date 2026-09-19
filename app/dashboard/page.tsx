import Link from "next/link";
import { ArrowRight, BarChart3, FileText, Zap } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: analyses } = await supabase.from("analyses").select("id, score, url, created_at").order("created_at", { ascending: false }).limit(5);
  const scores = (analyses ?? []).map((item) => item.score);
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  return <main className="mx-auto max-w-7xl px-6 py-10 text-white"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-slate-400">Welcome back</p><h1 className="mt-1 text-3xl font-bold">{user?.email}</h1></div><Link href="/dashboard/analyze" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold hover:bg-blue-500">New analysis <ArrowRight size={16} /></Link></div><div className="mt-10 grid gap-4 md:grid-cols-3">{[["Total analyses", analyses?.length ?? 0, BarChart3], ["Average score", `${average}/100`, Zap], ["Credits left", "5", FileText]].map(([label, value, Icon]) => <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900 p-6"><Icon className="text-blue-400" size={20} /><p className="mt-5 text-sm text-slate-400">{label}</p><p className="mt-1 text-3xl font-bold">{value as string}</p></div>)}</div><section className="mt-10 rounded-xl border border-slate-800 bg-slate-900 p-6"><h2 className="text-xl font-semibold">Recent analyses</h2><div className="mt-5 divide-y divide-slate-800">{analyses?.length ? analyses.map((analysis) => <div key={analysis.id} className="flex justify-between py-4 text-sm"><span>{analysis.url ?? "Article analysis"}</span><span className="font-semibold text-emerald-400">{analysis.score}/100</span></div>) : <p className="py-6 text-slate-400">No analyses yet. Start your first analysis to see results here.</p>}</div></section></main>;
}
