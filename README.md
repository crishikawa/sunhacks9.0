# TickSense

Paper-trading desk for Bitcoin, Ethereum, and Solana. You set four gates. A scan asks Grok for the mood around each coin. The server, not the model, decides whether that mood becomes a paper order. Fills update one shared demo portfolio that starts at $10,000. No broker, no custody, no real orders.

Hackathon prototype. The book is shared until accounts land. Without an xAI key, scans walk a labeled sample sequence.

> **The live link runs in demo mode.** Sentiment comes from a labeled sample sequence and Tick answers from desk data, so the public site makes no paid API calls. To see live Grok sentiment, run it locally with your own xAI key (below).

**Live:** _deploy URL goes here after Vercel ships_ · Desk: `/market` · Brief: `GET /api/brief`

## How we use Cursor and Grok Bot

**Cursor** is the coding agent for this repo. It writes the desk, keeps fill rules in `lib/trading.ts`, adds tests around those rules, and lands work on `main`. Cursor does not decide that a paper order should print — that decision stays in code the tests cover.

**Grok (in product)** is the sentiment call. `POST /api/grok-scan` sends every coin on the watchlist (BTC, ETH, and SOL by default; add more from the search bar) to the xAI API. Grok returns a score, confidence, catalyst sentence, and BUY / SELL / HOLD. The Responses API path can search the web and X; the chat fallback has no search and must not be labeled as a live reading.

**Grok Bot** is a teammate in Cursor, separate from the xAI spend. It runs the paper-desk briefing skill in `.cursor/skills/paper-desk-briefing/SKILL.md`: `GET /api/brief`, then posts cash, P&L versus $10,000, latest signals, and latest fills. It never calls scan or reset, and never spends the xAI key.

Routine prompt for a Grok Bot:

> Your job is the TickSense briefing. Read the skill "Paper desk briefing" in this repo and remember it. Every hour, GET {DEPLOY_URL}/api/brief and post a plain-language note in this chat: cash, profit or loss versus $10,000, whether sentiment is sample or live, what just filled, and what was skipped if the brief says so. If the URL fails, report the failure. Do not place trades, do not reset the portfolio, do not call POST /api/grok-scan, and do not spend the xAI key.

Replace `{DEPLOY_URL}` with the deployed origin.

## How a fill happens

Defaults live in `types/database.ts`.

- Confidence ≥ 0.75
- Buy: model says BUY and score ≥ 0.70
- Sell: model says SELL and score ≤ −0.70
- HOLD never trades
- Buy needs cash; sell needs coin; default size $500

The model's suggestion is an input. Your thresholds can still reject it. The page shows the skip reason.

## Demo script

1. Open `/` and start paper trading.
2. Leave the default gates, or move them to force a skip.
3. Run one scan. Read the signal, the fill or skip reason, cash, and P&L versus $10,000.

Prices move from CoinGecko. Sentiment moves when someone runs a scan (or when cron is enabled). With Supabase realtime, new rows show on open desks without a refresh.

## Run locally

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Desk: [http://localhost:3000/market](http://localhost:3000/market).

Without `XAI_API_KEY`, scans use sample mode. Without Supabase, the book lives in that Node process's memory — fine for local, not for production.

## Environment

Copy `.env.example` to `.env.local`.

| Variable | Required for | Read in |
| --- | --- | --- |
| `XAI_API_KEY` | Live Grok scans | `lib/grok.ts` |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | Stored book | `lib/supabase.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server writes | `lib/supabase.ts` (server only; never `NEXT_PUBLIC_`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` | Browser realtime | `GET /api/config` |
| `DESK_ADMIN_SECRET` | Protecting scan and reset | `lib/desk-secret.ts` — required when `VERCEL_ENV=production`, unless demo mode is on |
| `DEMO_MODE` | Public demo link | `lib/demo.ts` — `true` turns off xAI and Supabase and makes the desk secret optional |

Apply `supabase/schema.sql` in the Supabase SQL editor before the first stored scan. A project created before the watchlist existed also needs `supabase/migrations/002_watchlist_holdings.sql` once (additive; it copies existing BTC/ETH/SOL balances into `holdings`). Realtime is enabled for `sentiment_signals` and `trades`.

## Deploy

Production target: Vercel + Supabase.

1. Create a Supabase project and run `supabase/schema.sql`. Confirm `public.portfolio` has one row, id 1, cash 10000.
2. Import this GitHub repo in Vercel. Framework Next.js. Production branch `main`.
3. Set every variable from `.env.example` on Production and Preview.
4. Deploy only after `DESK_ADMIN_SECRET` is set. Bare `POST /api/grok-scan` must return 401.
5. Open the `*.vercel.app` URL, run one scan, refresh — the row must still be there.
6. Put that URL in this README and in the GitHub homepage field.
7. Add a custom domain in Vercel after the `*.vercel.app` URL already works.

`VERCEL_ENV=production` refuses a scan when Supabase is missing. The desk secret stops a bare POST; it is not an account system.

## Demo mode

Set `DEMO_MODE=true` for a public link that can't run up a bill or break when a free database pauses.

- No xAI requests, even if `XAI_API_KEY` is still set. Scans use the sample sequence; Tick answers from desk data.
- No Supabase. The book lives in server memory and starts over at $10,000 when the server restarts.
- `DESK_ADMIN_SECRET` is optional, since scan, chat and reset no longer spend anything.

Prices still come from CoinGecko's free public API.

## Limits

- One shared book until per-user accounts ship. Reset clears trades, restores $10,000, leaves signals.
- Sample vs live is not yet stored per signal row (tracked in Todo.md).
- Cash columns are floating point; a crash between portfolio update and trade insert can desync.
- Times on the chart use America/Phoenix until locale polish lands.
- CoinGecko public API throttles; quotes cache 15s, history 60s.

## Scripts

- `npm run dev` — app
- `npm test` — trading, briefing, desk-lock tests
- `npm run lint` — ESLint
- `npm run build` — production build

Build plan and PR #3 pivot: [Todo.md](Todo.md).
