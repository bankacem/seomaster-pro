# SEOMaster Pro

A modern, all-in-one SEO platform inspired by SEMrush. Built with Next.js 16, TypeScript, Supabase, OpenAI, and Stripe — production-ready for Vercel.

## ✨ Features

- 🏠 **Landing page** — full marketing site with pricing, FAQ, testimonials
- 🔐 **Authentication** — Supabase-powered sign up / sign in
- 📊 **Dashboard** — KPI overview, recent audits & analyses, quick actions
- 🌐 **Site Audit** — multi-page crawler (up to 50 pages), detects 14 classes of SEO issues, per-page drill-down, robots.txt analysis
- 📝 **Content Analyzer** — AI-powered article SEO scoring (score, keywords, readability, issues, suggestions)
- 🔑 **Keyword Research** — AI-generated keyword ideas with volume, difficulty, CPC, competition, intent
- 🔗 **Backlink Analysis** — backlink profile with domain authority, top backlinks, toxic links, gained/lost activity
- 📈 **Position Tracking** — track up to 10 keywords with positions, changes, volume and difficulty
- 🎯 **Competitor Analysis** — discover competitors, shared keywords, content gaps, AI summary
- ✅ **On-Page SEO Checker** — URL analyzer with priority recommendations and how-to-fix instructions
- 🌐 **Domain Overview** — estimated traffic, top keywords, top pages, domain authority
- ⚙️ **Settings & Billing** — profile management, Stripe-powered subscriptions, usage history

## 🚀 Quick start (Vercel)

### 1. Push to GitHub
The project is configured for direct Vercel deployment. Push to a GitHub repo, then import it in Vercel.

### 2. Set up Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. In the SQL Editor, run `supabase/schema.sql` and then `supabase/schema-update.sql`
3. Note your project URL, anon key, and service role key

### 3. Set up OpenAI
- Get an API key from [platform.openai.com](https://platform.openai.com)
- The project uses `gpt-4o-mini` by default (configurable in `lib/openai.ts`)

### 4. Set up Stripe
1. Create an account at [stripe.com](https://stripe.com)
2. Create two recurring products (Pro and Enterprise) and copy their price IDs
3. Set up a webhook endpoint pointing to `https://your-domain.com/api/stripe/webhook`
4. Subscribe to events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`

### 5. Set environment variables in Vercel

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `OPENAI_API_KEY` | OpenAI API key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_PRICE_PRO` | Stripe price ID for Pro plan |
| `STRIPE_PRICE_ENTERPRISE` | Stripe price ID for Enterprise plan |
| `NEXT_PUBLIC_APP_URL` | Your deployment URL (e.g. `https://yourapp.vercel.app`) |

### 6. Deploy
- Push to GitHub → Vercel auto-deploys
- Or use `vercel` CLI: `vercel --prod`

## 🛠 Local development

```bash
npm install
npm run dev    # http://localhost:5000
```

Create a `.env.local` file with the same variables as above (with localhost URLs).

## 📋 Available scripts

- `npm run dev` — start dev server on port 5000
- `npm run build` — production build
- `npm run start` — start production server
- `npm run typecheck` — TypeScript check
- `npm run db:push` — push Supabase schema
- `npm run db:types` — generate Supabase TypeScript types

## 🏗 Architecture

```
app/
├── (auth)/              # Auth pages (login, signup) with shared marketing layout
├── dashboard/           # Authenticated dashboard (audit, analyzer, keywords, etc.)
├── api/                 # REST API routes (auth, user, analyze, audit, keywords, backlinks, etc.)
└── page.tsx             # Public landing page

components/
├── ui/                  # shadcn-style primitives (button, card, dialog, etc.)
└── shared/              # Domain components (Logo, ScoreGauge, DashboardShell, useAuth)

lib/
├── supabase/            # Server, browser, admin Supabase clients
├── stripe/              # Stripe client & subscription helpers
├── auth.ts              # Auth helper (getAuthenticatedUser)
├── credits.ts           # Credit system (checkCredits, deductCredits, addCredits)
├── openai.ts            # OpenAI client singleton
├── rate-limit.ts        # In-memory rate limiter
├── seo-agent.ts         # AI article analyzer & keyword generator
├── site-audit.ts        # Safe site crawler
└── utils.ts             # Shared utilities (cn, formatDate, etc.)

supabase/
├── schema.sql           # Core tables (profiles, analyses, subscriptions, etc.)
└── schema-update.sql    # Additional tables (keywords, backlinks, etc.)
```

## 🔒 Security

- Supabase Row Level Security (RLS) is enabled on every table
- Server-only routes use `createAdminClient` with the service role key
- Site audit crawler blocks private hosts (SSRF protection) and respects robots.txt
- Stripe webhook signature verification is mandatory
- Rate limiting on all credit-consuming endpoints
- No secrets are committed — all credentials come from environment variables

## 📦 Vercel deployment notes

- All `/api/*` routes run on the Node.js runtime (`maxDuration = 30–60s`)
- The landing page (`/`) is statically optimized
- Auth and dashboard pages are client-rendered (use `"use client"`)
- The Stripe webhook must use the raw body — handled automatically by Next.js App Router

## 📝 License

MIT — feel free to fork, modify, and deploy your own SEO suite.
