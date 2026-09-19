# SEOMaster Pro Backend

Backend-only Next.js App Router API for Supabase authentication, AI article analysis, credits, usage tracking, and Stripe billing. There are no landing pages or dashboard components.

## Setup

1. Install dependencies with `npm install`.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Add the variables in `.env.example` to Replit Secrets. Do not commit service-role, OpenAI, or Stripe secrets.
4. Configure a Stripe webhook for `/api/stripe/webhook` and subscribe it to checkout, subscription, and invoice payment events.
5. Start the API with `npm run dev`.

## Routes

- `POST /api/auth/signup`, `POST /api/auth/signin`, `POST /api/auth/signout`
- `GET /api/auth/callback`
- `GET /api/user/me`, `GET /api/user/usage`
- `POST /api/analyze`
- `POST /api/stripe/checkout`, `POST /api/stripe/portal`
- `POST /api/stripe/webhook`

All JSON responses use `{ data: ... }` on success and `{ error, code? }` on failure. Protected routes require the Supabase session cookie.

## Checks

```bash
npm run typecheck
npm run build
```
