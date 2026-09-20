import Link from "next/link";
import { ArrowLeft, Sparkles, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/shared/logo";

export const metadata = {
  title: "Sign in",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: form */}
      <div className="flex flex-col px-4 sm:px-8 lg:px-12">
        <header className="flex h-16 items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 hover:text-ink-900">
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>
          <Logo withText={false} />
        </header>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      {/* Right: marketing panel */}
      <aside className="relative hidden overflow-hidden bg-ink-950 lg:block">
        <div className="absolute inset-0 gradient-hero opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950/50 to-ink-950" />
        <div className="relative flex h-full flex-col justify-center p-12">
          <div className="flex items-center gap-2 text-brand-300">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-medium uppercase tracking-wider">SEOMaster Pro</span>
          </div>
          <h2 className="mt-4 text-balance text-3xl font-bold leading-tight text-white">
            The all-in-one SEO toolkit trusted by modern teams.
          </h2>
          <p className="mt-4 text-pretty text-white/70">
            Audit, research, track and outrank — without juggling six tabs.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "AI-powered content analyzer built-in",
              "Crawl up to 50 pages per site audit",
              "Keyword research with difficulty & intent",
              "Backlink analysis and competitor research",
              "Stripe-secured subscription billing",
            ].map((feat) => (
              <li key={feat} className="flex items-start gap-3 text-sm text-white/90">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
          <div className="mt-12 rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-sm font-semibold text-white">
                MK
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Mehdi K.</p>
                <p className="text-xs text-white/60">SEO Consultant · Casablanca</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-white/80">
              &ldquo;I switched from three separate subscriptions to SEOMaster Pro. The audit alone pays for the whole plan.&rdquo;
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
