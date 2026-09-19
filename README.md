# SEOMaster Pro

SEOMaster Pro is an AI-powered SEO analysis platform built with Next.js 14, TypeScript, Tailwind CSS, Supabase, OpenAI, NextAuth, and Stripe.

## Local setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000.

## Database

Run `supabase/schema.sql` in the Supabase SQL editor, then configure the Supabase URL and keys in `.env.local`.

## Environment variables

See `.env.local.example` for Supabase, OpenAI, Stripe, NextAuth, OAuth, and email provider variables. Never commit `.env.local` or service-role credentials.

## Production build

```bash
npm run build
npm start
```

Deploy through Vercel after adding the same environment variables to the project settings. Configure the Stripe webhook endpoint at `/api/stripe/webhook`.
