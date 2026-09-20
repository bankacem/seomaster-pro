# SEOMaster Pro Backend

## Run

- Runtime: Node.js 22
- Workflow: `npm run dev`
- Preview port: `5000`
- Checks: `npm run typecheck` and `npm run build`

## First-time service setup

1. Add the variables listed in `.env.example` through Replit Secrets.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Configure the Stripe webhook at `/api/stripe/webhook`.

The current first product slice is the authenticated Site Audit API:

- `POST /api/audit` with `{ "url": "https://example.com", "max_pages": 20 }`
- `GET /api/audit` for the authenticated user's recent audits

The crawler stays on the submitted origin, checks `robots.txt`, blocks local/private hosts, limits pages and request time, and charges one credit per completed audit.