import Link from "next/link";

const features = [
  {
    icon: "✦",
    title: "Instant SEO Analysis",
    description:
      "Scan your website in seconds and uncover the technical, content, and performance issues holding you back.",
  },
  {
    icon: "◎",
    title: "AI-Powered Optimization Agent",
    description:
      "Get practical, prioritized recommendations from an AI agent that turns complex SEO data into clear next steps.",
  },
  {
    icon: "▣",
    title: "Professional Reports",
    description:
      "Create polished, shareable reports that show progress clearly to your team, clients, and stakeholders.",
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "A simple way to start improving your SEO.",
    features: ["5 analyses per month", "Core SEO health score", "Basic recommendations"],
    cta: "Start for free",
  },
  {
    name: "Pro",
    price: "$19",
    description: "Powerful SEO workflows for growing businesses.",
    features: ["50 analyses per month", "AI Optimization Agent", "Professional PDF reports", "Priority support"],
    cta: "Start free trial",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "$99",
    description: "Scale your SEO operation without limits.",
    features: ["Unlimited analyses", "Advanced AI insights", "Team collaboration", "Dedicated support"],
    cta: "Contact sales",
  },
];

const faqs = [
  {
    question: "What is included in the free plan?",
    answer: "The free plan includes five website analyses every month, a core SEO health score, and actionable recommendations to help you get started.",
  },
  {
    question: "Do I need SEO experience to use SEOMaster Pro?",
    answer: "Not at all. SEOMaster Pro translates technical findings into plain-language priorities, so anyone can make meaningful improvements.",
  },
  {
    question: "Can I cancel my subscription at any time?",
    answer: "Yes. You can cancel your paid plan at any time, and you will retain access to its features through the end of your billing period.",
  },
  {
    question: "How quickly will I receive my analysis?",
    answer: "Most analyses are ready in under a minute. Larger sites may take a little longer while we inspect every important page and signal.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,rgba(59,130,246,0.18),transparent_32%),radial-gradient(circle_at_85%_20%,rgba(124,58,237,0.2),transparent_32%)]" />

      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-violet-500 text-sm shadow-lg shadow-blue-500/20">S</span>
          <span>SEO<span className="text-blue-400">Master</span> Pro</span>
        </Link>
        <div className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
          <a href="#features" className="transition hover:text-white">Features</a>
          <a href="#pricing" className="transition hover:text-white">Pricing</a>
          <a href="#contact" className="transition hover:text-white">Contact</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-white sm:block">Sign in</Link>
          <Link href="/register" className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-blue-50">Start free</Link>
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl items-center gap-16 px-6 pb-24 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-32 lg:pt-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-sm text-blue-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" /> Built for ambitious websites
          </div>
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">Double Your Traffic with <span className="bg-gradient-to-r from-blue-300 via-indigo-300 to-violet-400 bg-clip-text text-transparent">AI-Powered SEO</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">Turn search data into growth. SEOMaster Pro finds what is limiting your visibility and gives you an intelligent, prioritized plan to rank higher.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3.5 text-center font-semibold shadow-xl shadow-blue-500/20 transition hover:scale-[1.02]">Start free trial →</Link>
            <a href="#demo" className="rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-center font-semibold text-slate-200 backdrop-blur transition hover:bg-white/10">▶&nbsp; Watch demo</a>
          </div>
          <div className="mt-8 flex items-center gap-3 text-sm text-slate-400"><span className="text-amber-300">★★★★★</span> Trusted by 2,000+ growth teams</div>
        </div>

        <div id="demo" className="relative mx-auto w-full max-w-xl animate-[float_6s_ease-in-out_infinite]">
          <div className="absolute -inset-8 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative rounded-2xl border border-white/15 bg-white/[0.07] p-3 shadow-2xl shadow-blue-950/50 backdrop-blur-xl">
            <div className="rounded-xl border border-white/10 bg-slate-900/90 p-5">
              <div className="mb-6 flex items-center justify-between"><div><p className="text-xs text-slate-400">Website overview</p><p className="mt-1 font-semibold">yourbrand.com</p></div><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">● Live</span></div>
              <div className="grid grid-cols-3 gap-3"><div className="rounded-xl bg-white/5 p-4"><p className="text-xs text-slate-400">SEO score</p><p className="mt-2 text-3xl font-bold text-emerald-300">92</p></div><div className="rounded-xl bg-white/5 p-4"><p className="text-xs text-slate-400">Keywords</p><p className="mt-2 text-3xl font-bold">248</p></div><div className="rounded-xl bg-white/5 p-4"><p className="text-xs text-slate-400">Visibility</p><p className="mt-2 text-3xl font-bold text-blue-300">+38%</p></div></div>
              <div className="mt-5 rounded-xl bg-gradient-to-br from-blue-500/15 to-violet-500/15 p-5"><div className="flex items-center justify-between"><p className="font-medium">Organic traffic</p><span className="text-sm text-emerald-300">↑ 24.8%</span></div><div className="mt-6 flex h-24 items-end gap-2"><span className="h-8 flex-1 rounded-t bg-blue-500/40" /><span className="h-12 flex-1 rounded-t bg-blue-500/50" /><span className="h-10 flex-1 rounded-t bg-indigo-500/60" /><span className="h-16 flex-1 rounded-t bg-indigo-500/70" /><span className="h-20 flex-1 rounded-t bg-violet-500/80" /><span className="h-24 flex-1 rounded-t bg-gradient-to-t from-blue-500 to-violet-400" /></div></div>
              <div className="mt-5 flex items-center gap-3 text-sm text-slate-300"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-400/15 text-violet-300">✦</span><span><strong className="text-white">AI insight:</strong> Improve title tags on 12 high-potential pages.</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-24 lg:px-8"><div className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">Everything you need to grow</p><h2 className="mt-4 text-3xl font-bold sm:text-4xl">Your SEO co-pilot, always on</h2><p className="mt-4 text-slate-400">Replace guesswork with a clear strategy built from your real search data.</p></div><div className="mt-14 grid gap-5 md:grid-cols-3">{features.map((feature) => <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur transition hover:-translate-y-1 hover:border-blue-400/30"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-2xl text-blue-300">{feature.icon}</span><h3 className="mt-6 text-xl font-semibold">{feature.title}</h3><p className="mt-3 leading-7 text-slate-400">{feature.description}</p></div>)}</div></section>

      <section id="pricing" className="border-y border-white/5 bg-white/[0.02] px-6 py-24 lg:px-8"><div className="mx-auto max-w-7xl"><div className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">Simple pricing</p><h2 className="mt-4 text-3xl font-bold sm:text-4xl">Start free. Scale when ready.</h2></div><div className="mt-14 grid gap-5 lg:grid-cols-3">{plans.map((plan) => <div key={plan.name} className={`relative rounded-2xl border p-7 ${plan.featured ? "border-blue-400/60 bg-gradient-to-b from-blue-500/15 to-violet-500/10 shadow-xl shadow-blue-950/30" : "border-white/10 bg-white/[0.04]"}`}>{plan.featured && <span className="absolute -top-3 right-6 rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold">Most popular</span>}<h3 className="text-xl font-semibold">{plan.name}</h3><p className="mt-3 text-sm text-slate-400">{plan.description}</p><p className="mt-7 text-4xl font-bold">{plan.price}<span className="text-sm font-normal text-slate-400">{plan.price !== "$0" && "/month"}</span></p><Link href="/register" className={`mt-7 block rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${plan.featured ? "bg-white text-slate-950 hover:bg-blue-50" : "border border-white/15 hover:bg-white/10"}`}>{plan.cta}</Link><ul className="mt-7 space-y-4 text-sm text-slate-300">{plan.features.map((item) => <li key={item}>✓ <span className="ml-2">{item}</span></li>)}</ul></div>)}</div></div></section>

      <section className="mx-auto max-w-3xl px-6 py-24 lg:px-8"><div className="text-center"><h2 className="text-3xl font-bold sm:text-4xl">Questions? We have answers.</h2><p className="mt-4 text-slate-400">Everything you need to know before getting started.</p></div><div className="mt-10 divide-y divide-white/10">{faqs.map((faq) => <details key={faq.question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between font-medium"><span>{faq.question}</span><span className="text-xl text-blue-300 transition group-open:rotate-45">+</span></summary><p className="mt-3 max-w-2xl leading-7 text-slate-400">{faq.answer}</p></details>)}</div></section>

      <footer id="contact" className="border-t border-white/10"><div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-12 lg:flex-row lg:items-center lg:justify-between lg:px-8"><div><Link href="/" className="text-lg font-bold">SEO<span className="text-blue-400">Master</span> Pro</Link><p className="mt-2 text-sm text-slate-500">Make every search count.</p></div><div className="flex flex-wrap gap-6 text-sm text-slate-400"><a href="#features" className="hover:text-white">Features</a><a href="#pricing" className="hover:text-white">Pricing</a><a href="mailto:hello@seomaster.pro" className="hover:text-white">Contact</a><a href="#" className="hover:text-white">X / Twitter</a><a href="#" className="hover:text-white">LinkedIn</a></div><p className="text-sm text-slate-500">© 2024 SEOMaster Pro</p></div></footer>
    </main>
  );
}
