import Link from "next/link";
import {
  ArrowRight,
  Search,
  Globe,
  TrendingUp,
  Link2,
  Target,
  FileText,
  Users,
  Sparkles,
  CheckCircle2,
  Zap,
  ShieldCheck,
  LineChart,
  Gauge,
  ChevronRight,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/shared/logo";

export const runtime = "nodejs";

const FEATURES = [
  {
    icon: Search,
    title: "Keyword Research",
    desc: "Discover high-intent keywords with search volume, difficulty scores, CPC estimates and SERP intent — powered by AI.",
    accent: "from-emerald-500 to-teal-600",
  },
  {
    icon: Globe,
    title: "Site Audit",
    desc: "Crawl up to 50 pages per audit. Detect technical issues, broken links, missing meta tags, slow pages and structured-data problems.",
    accent: "from-blue-500 to-cyan-600",
  },
  {
    icon: TrendingUp,
    title: "Position Tracking",
    desc: "Track daily rankings across desktop and mobile. Spot winners, losers and new opportunities at a glance.",
    accent: "from-amber-500 to-orange-600",
  },
  {
    icon: Link2,
    title: "Backlink Analysis",
    desc: "Audit your link profile, monitor new and lost backlinks, estimate authority and find toxic links to disavow.",
    accent: "from-purple-500 to-fuchsia-600",
  },
  {
    icon: Users,
    title: "Competitor Research",
    desc: "Reveal competitor traffic sources, top pages, shared keywords and gaps where they outrank you.",
    accent: "from-rose-500 to-pink-600",
  },
  {
    icon: FileText,
    title: "Content Analyzer",
    desc: "Paste any article and get an instant SEO score with AI-driven suggestions for titles, structure and readability.",
    accent: "from-indigo-500 to-violet-600",
  },
];

const STATS = [
  { value: "50+", label: "Pages per audit" },
  { value: "10K+", label: "Keyword ideas generated" },
  { value: "<60s", label: "Avg audit runtime" },
  { value: "99.9%", label: "API uptime" },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    cadence: "/month",
    desc: "Try the platform with limited credits.",
    features: ["5 credits / month", "1 site audit at a time", "Article analyzer", "Basic keyword ideas", "Community support"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$49",
    cadence: "/month",
    desc: "For freelancers and small agencies.",
    features: [
      "100 credits / month",
      "Up to 50 pages per audit",
      "Keyword research & tracking",
      "Backlink analysis",
      "Competitor insights",
      "Email support",
    ],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    desc: "For teams that need scale and SLAs.",
    features: [
      "1,000+ credits / month",
      "Unlimited projects",
      "API access",
      "White-label reports",
      "Dedicated manager",
      "99.9% SLA",
    ],
    cta: "Contact sales",
    highlight: false,
  },
];

const FAQ = [
  {
    q: "How does SEOMaster Pro compare to SEMrush?",
    a: "SEOMaster Pro covers the core SEO workflow — site audits, keyword research, rank tracking, backlink analysis and competitor insights — in a single, modern interface. While SEMrush has a deeper historical database, SEOMaster Pro is significantly more affordable, faster to set up, and ships with an AI-powered content analyzer that helps you act on findings immediately.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. SEOMaster Pro runs entirely in the browser. Sign in, paste a URL or article, and start analyzing. Perfect for non-technical marketers and SEOs alike.",
  },
  {
    q: "Can I cancel my subscription at any time?",
    a: "Yes. Subscriptions are managed through Stripe and can be cancelled instantly from your dashboard. You keep access until the end of the current billing period.",
  },
  {
    q: "Is my data secure?",
    a: "All credentials are stored using Supabase Auth with row-level security. We never store your payment details — Stripe handles all billing. Your audit history is private to your account.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Top navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-ink-100 bg-white/80 glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-ink-600 transition-colors hover:text-ink-900">Features</a>
            <a href="#pricing" className="text-sm font-medium text-ink-600 transition-colors hover:text-ink-900">Pricing</a>
            <a href="#faq" className="text-sm font-medium text-ink-600 transition-colors hover:text-ink-900">FAQ</a>
            <a href="https://github.com/bankacem/seomaster-pro" className="text-sm font-medium text-ink-600 transition-colors hover:text-ink-900" target="_blank" rel="noopener noreferrer">Docs</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="gradient" size="sm">
              <Link href="/signup">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden gradient-hero">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="success" className="mb-6">
              <Sparkles className="h-3 w-3" />
              AI-powered SEO suite
            </Badge>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight text-ink-900 sm:text-6xl">
              The complete <span className="gradient-text">SEO platform</span> for teams that ship
            </h1>
            <p className="mt-6 text-pretty text-lg leading-7 text-ink-600 sm:text-xl">
              Audit, research, track and outrank — all in one place. SEOMaster Pro combines site audits, keyword research, backlink analysis, rank tracking and AI content analysis into a single, modern dashboard.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="gradient" size="lg">
                <Link href="/signup">
                  Start free — 5 credits included
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#features">
                  <Gauge className="h-4 w-4" />
                  See features
                </a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-ink-500">
              No credit card required · Cancel anytime · Stripe-secured billing
            </p>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl border border-ink-100 bg-white/70 p-4 text-center backdrop-blur">
                <div className="text-2xl font-bold text-ink-900 sm:text-3xl">{s.value}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-ink-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Logos / trust bar */}
      <section className="border-y border-ink-100 bg-ink-50/50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-ink-500">
            Built on a modern, production-grade stack
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-ink-400">
            {["Next.js 16", "TypeScript", "Supabase", "OpenAI", "Stripe", "Tailwind CSS 4", "Vercel-ready"].map((t) => (
              <span key={t} className="text-sm font-medium">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">Everything you need</Badge>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            Six powerful tools. One unified workflow.
          </h2>
          <p className="mt-4 text-pretty text-ink-600">
            Stop juggling six tabs. SEOMaster Pro brings every SEO workflow into one fast, modern dashboard — designed for agencies and in-house teams alike.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="card-hover relative overflow-hidden border-ink-100">
              <div className={`absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${f.accent} opacity-10 blur-2xl`} />
              <CardContent className="p-6">
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${f.accent} text-white shadow-sm`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-ink-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{f.desc}</p>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600">
                  Learn more <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Highlighted feature: Audit */}
      <section className="border-y border-ink-100 bg-ink-50/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge variant="info" className="mb-4">
                <Zap className="h-3 w-3" /> Built-in crawler
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
                Technical site audits in under 60 seconds
              </h2>
              <p className="mt-4 text-pretty text-ink-600">
                Our crawler respects robots.txt, follows redirects safely, and detects 14 classes of SEO issues — from missing H1s to broken canonicals, thin content and missing image alt text.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Crawls up to 50 pages per audit in parallel",
                  "Detects missing titles, descriptions, canonicals, alt text",
                  "Flags thin content, multiple H1s, HTTP errors, slow pages",
                  "Per-issue summary with severity and page-level drill-down",
                  "Full audit history saved to your account",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                    <span className="text-sm text-ink-700">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button asChild variant="default">
                  <Link href="/signup">
                    Run your first audit
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-50 blur-2xl" />
              <Card className="overflow-hidden border-ink-200 shadow-xl">
                <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-red-400" />
                      <span className="h-3 w-3 rounded-full bg-amber-400" />
                      <span className="h-3 w-3 rounded-full bg-emerald-400" />
                    </div>
                    <span className="ml-2 font-mono text-xs text-ink-500">audit · example.com</span>
                  </div>
                  <Badge variant="warning">3 warnings</Badge>
                </div>
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-ink-700">Overall health</span>
                    <span className="text-2xl font-bold text-emerald-600">87</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full bg-emerald-500" style={{ width: "87%" }} />
                  </div>
                  <div className="mt-6 space-y-3">
                    {[
                      { label: "Pages crawled", value: "23", icon: Globe },
                      { label: "Issues found", value: "12", icon: Target },
                      { label: "Broken pages", value: "2", icon: AlertCircle },
                      { label: "Avg load time", value: "1.4s", icon: Zap },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-ink-600">
                          <row.icon className="h-4 w-4 text-ink-400" />
                          {row.label}
                        </span>
                        <span className="font-mono font-semibold text-ink-900">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <Card className="overflow-hidden border-ink-100">
          <CardContent className="grid gap-8 p-8 lg:grid-cols-3 lg:p-12">
            <div className="lg:col-span-2">
              <div className="flex gap-1 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-4 text-pretty text-lg font-medium leading-relaxed text-ink-800 sm:text-xl">
                &ldquo;SEOMaster Pro replaced three separate subscriptions for our agency. The site audit alone pays for itself the first time a client sees their broken-canonical report. The AI content analyzer is the cherry on top — we ship articles that rank faster because the suggestions are genuinely actionable.&rdquo;
              </blockquote>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white">
                  SA
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900">Sara Ahmed</p>
                  <p className="text-xs text-ink-500">Head of SEO · Atlas Digital Agency</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center rounded-lg bg-ink-50 p-6">
              <div className="text-3xl font-bold text-ink-900">3 subscriptions</div>
              <p className="mt-1 text-sm text-ink-600">replaced by one SEOMaster Pro plan</p>
              <div className="mt-6 text-3xl font-bold text-ink-900">$1,820/yr</div>
              <p className="mt-1 text-sm text-ink-600">average savings per seat</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-ink-100 bg-ink-50/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="mb-4">Simple pricing</Badge>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
              Pay for what you use. Cancel anytime.
            </h2>
            <p className="mt-4 text-pretty text-ink-600">
              Start with 5 free credits — no credit card required. Upgrade when you need more volume.
            </p>
          </div>

          <div className="mt-16 grid gap-6 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <Card
                key={plan.name}
                className={
                  plan.highlight
                    ? "relative border-2 border-brand-500 shadow-lg"
                    : "relative border-ink-200"
                }
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="success" className="border-2 border-white shadow">Most popular</Badge>
                  </div>
                )}
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-ink-900">{plan.name}</h3>
                  <p className="mt-1 text-sm text-ink-500">{plan.desc}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-ink-900">{plan.price}</span>
                    {plan.cadence && <span className="text-sm text-ink-500">{plan.cadence}</span>}
                  </div>
                  <Button
                    asChild
                    variant={plan.highlight ? "gradient" : "outline"}
                    className="mt-6 w-full"
                  >
                    <Link href="/signup">{plan.cta}</Link>
                  </Button>
                  <ul className="mt-6 space-y-3 border-t border-ink-100 pt-6">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                        <span className="text-sm text-ink-700">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="text-center">
          <Badge variant="outline" className="mb-4">FAQ</Badge>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>
        <div className="mt-12 space-y-6">
          {FAQ.map((item) => (
            <div key={item.q} className="rounded-xl border border-ink-100 bg-white p-6">
              <h3 className="text-base font-semibold text-ink-900">{item.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden">
        <div className="gradient-brand px-4 py-20 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-white/90" />
            <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Stop guessing. Start ranking.
            </h2>
            <p className="mt-4 text-pretty text-white/90">
              Run your first audit in less than 60 seconds. No credit card, no setup, no fluff.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary">
                <Link href="/signup">
                  Create free account
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <Logo />
              <p className="mt-3 text-sm text-ink-500">
                The modern SEO platform for agencies and in-house teams. Built for speed, designed for clarity.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Product</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><a href="#features" className="text-ink-600 hover:text-ink-900">Features</a></li>
                <li><a href="#pricing" className="text-ink-600 hover:text-ink-900">Pricing</a></li>
                <li><Link href="/signup" className="text-ink-600 hover:text-ink-900">Sign up</Link></li>
                <li><Link href="/login" className="text-ink-600 hover:text-ink-900">Sign in</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Tools</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/dashboard/audit" className="text-ink-600 hover:text-ink-900">Site Audit</Link></li>
                <li><Link href="/dashboard/keywords" className="text-ink-600 hover:text-ink-900">Keyword Research</Link></li>
                <li><Link href="/dashboard/backlinks" className="text-ink-600 hover:text-ink-900">Backlink Analysis</Link></li>
                <li><Link href="/dashboard/analyzer" className="text-ink-600 hover:text-ink-900">Content Analyzer</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Resources</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><a href="https://github.com/bankacem/seomaster-pro" target="_blank" rel="noopener noreferrer" className="text-ink-600 hover:text-ink-900">GitHub</a></li>
                <li><a href="#faq" className="text-ink-600 hover:text-ink-900">FAQ</a></li>
                <li><a href="mailto:hello@seomaster.pro" className="text-ink-600 hover:text-ink-900">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-ink-100 pt-6 sm:flex-row">
            <p className="text-xs text-ink-500">© {new Date().getFullYear()} SEOMaster Pro. All rights reserved.</p>
            <div className="flex items-center gap-4 text-xs text-ink-500">
              <span className="flex items-center gap-1"><LineChart className="h-3 w-3" /> All systems operational</span>
              <span>v1.0.0</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function AlertCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
