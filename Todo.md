# TickSense — build plan

Repo: [Sanjay18bala/SunHacks9.0](https://github.com/Sanjay18bala/SunHacks9.0)
Open [PR #3](https://github.com/Sanjay18bala/SunHacks9.0/pull/3) (`dev`) — **do not merge as-is**. Landing route split is already on the TickSense branch with a real CTA; the fake login form stays out.

## Status (2026-11-15)

| Item | State |
| --- | --- |
| P0.1 Landing without fake auth | Done — `/` → landing, `/market` → desk, one CTA |
| P0.2 README + TickSense name | Done |
| P0.3 `.env.example` + `npm test` | Done |
| P0.4 Desk secret on scan/reset | Done |
| P0.5 Deploy + domain | **Next** — needs Vercel login + Supabase env |
| P0.6 Skip reasons + chart title | Done |
| P0.7 No fake $10k flash | Done |
| Brief API + Grok Bot skill | Done |
| P&L vs $10k on desk | Done (simple) |
| CI | Done (`.github/workflows/ci.yml`) |
| P1.1 Source badges + persisted strategy | Next after deploy |
| P1.5 Cron scan | After deploy + `SCANS_ENABLED` |
| P2 Auth / per-user books | Only after shared demo is live |

This file is the work list. Do items in the order below. Later sections assume earlier ones are done.

## What this project is

A paper desk for BTC, ETH, and SOL. A person sets four numbers (buy threshold, sell threshold, minimum confidence, trade size). "Run Grok Scan Now" asks xAI Grok for one sentiment object per ticker, the server decides whether that object clears the gates, and a qualifying order updates one shared cash-and-holdings row. Prices come from CoinGecko. With Supabase configured, signals and trades are stored and the page also listens for inserts. Without an xAI key, scans walk a fixed sample sequence. Without Supabase, the book lives in the memory of whichever Node process handled the request.

The decision code in `lib/trading.ts` is the real core, and `lib/trading.test.ts` covers the gates. The rest is a single-page demo wrapped around one global portfolio (`public.portfolio.id = 1`).

## What has to be true before this is demo-ready

1. A stranger can open a URL, read what the desk does, and run one scan without being told to leave a form blank.
2. That URL is a real deployment, with Supabase attached, so a refresh shows the same book.
3. The xAI key cannot be spent by an anonymous POST, and the reset button cannot wipe the book from outside the page you control.
4. The README, the GitHub repo description, and the page say the same thing: paper trading, shared demo book, sample mode versus live Grok.
5. A skipped trade shows the reason the server already computed.

Accounts, per-user books, and a custom domain come after that. They are in this file. They are not the next commit.

---

## PR #3 — landing page and auth

Link: https://github.com/Sanjay18bala/SunHacks9.0/pull/3
Author: TereshDK
Branch: `dev` → `main`
Title: "Landing Page"
Stated scope: sign up, log in, and a "Start paper trading" button that bypasses authentication. The PR body says hooking those forms to Supabase is still to do.

Diff is three files, 125 lines, and it applies cleanly onto current `main`:

| File | Change |
| --- | --- |
| `app/page.tsx` | `/` renders `Landing` instead of `Dashboard` |
| `app/market/page.tsx` | new route, renders the existing `Dashboard` |
| `components/landing.tsx` | marketing column plus a sign-up / log-in card |

### Verdict

Keep the front door. Do not merge the form.

The layout is the right shape. `/` explains the desk, `/market` is the tool, the palette matches `components/dashboard.tsx`, and the route split does not disturb the scan, ledger, or charts. That part should land.

The form is a trap. `onSubmit` in `components/landing.tsx` navigates to `/market` only when email and password are both empty. Any typed character sets the notice "Leave email and password empty to open the desk." The Sign up and Log in tabs only change `autoComplete` and the underline. Nothing is validated, nothing is sent, and the email input is `type="text"`. A judge who does the normal thing — types an email — is stuck, and the button label says the opposite of the code. The PR description says the button bypasses auth. The code bypasses auth only for a blank form.

Wiring that form to Supabase Auth next, without any other change, is the wrong pivot. The book is one row:

```sql
constraint portfolio_singleton check (id = 1)
```

`getPortfolio()` always reads `id = 1`. `resetDemo()` deletes every trade in the table. A session cookie would not give anyone their own cash, their own thresholds, or their own history. Two logged-in people would share one ledger, and either of them could reset it. Auth on top of that singleton is a costume.

### Pivot

1. Do **P0.1** (rewrite the landing) on `dev` or a fresh branch off `main`. Land the route split and the visual shell.
2. Primary action is one button, "Start paper trading", that always goes to `/market`. No email field, no password field, no tabs.
3. One line under the button: "Shared demo book. Starts at $10,000 cash. Accounts are not on yet."
4. Leave Supabase Auth untouched until **P2**. P2 starts with `user_id` on the portfolio, then turns the form back on. The order is the whole point.

---

## P0 — Make the current app honest and shippable

Do these before new features. They are the difference between a demo and a folder of source.

### P0.1 Rewrite the landing from PR #3

**Why.** The desk currently has no front door. The proposed front door punishes input.

**Change.**

- Bring over `app/market/page.tsx` and point `app/page.tsx` at the landing component.
- Keep the left column: eyebrow, headline, one-sentence description, BTC / ETH / SOL chips.
- Replace the card's form with:
  - heading "Open the desk"
  - short copy: Grok scan, four gates, paper fills, $10,000 start
  - a link-styled button to `/market` (`<Link href="/market">`), so it works with JS off and with a middle click
- Delete `useState`, the mode union, and the empty-field branch.
- Add a text link "Already on the desk" only if you later have a session. Until P2, omit it.

**Files.** `app/page.tsx`, `app/market/page.tsx`, `components/landing.tsx`.

**Done when.** `/` shows the pitch and one control. That control opens `/market` with the fields empty, with an email typed, and with the keyboard (Enter on the focused link). `/market` is the current dashboard, including ticker charts. Sign up and log in are gone.

### P0.2 Rewrite `README.md` so it describes the project

**Why.** The current README is a local runbook. It never says who the desk is for, how a trade is allowed, that the book is shared, or that sample signals are scripted. `package.json` is still named `temp-app`. The GitHub repo has an empty description and an empty homepage. Someone opening the repo cannot tell a paper desk from the Next.js boilerplate it was cloned from.

**Change the README to these sections, in this order.** Write it in plain sentences. No badge row.

1. **TickSense.** One paragraph. Paper trading for BTC, ETH, and SOL. Grok returns a score, a confidence, a catalyst sentence, and BUY / SELL / HOLD. The server, not the model, decides whether an order prints. Fills hit one shared demo portfolio. No broker, no real orders, no custody.
2. **How a fill happens.** The four gates, matching `lib/trading.ts`:
   - confidence ≥ min confidence (default 0.75)
   - BUY only if the model said BUY and score ≥ buy threshold (default 0.70)
   - SELL only if the model said SELL and score ≤ sell threshold (default −0.70)
   - BUY needs enough cash; SELL needs enough coin; size defaults to $500
   - HOLD never trades
   Say that the model's `recommended_action` is an input, and the thresholds can still reject it.
3. **What you are looking at.** Manual scan, not a stream. Prices refresh about every 20 seconds from CoinGecko. Signals update when someone runs a scan. "Sample" means a rotating canned sequence in `lib/grok.ts` (`SAMPLE_PATTERNS`), shared by every visitor on that server process. "Live" means `XAI_API_KEY` is set and the Responses API is called with web and X search. The chat-completions fallback has no search tools; if that path is used, say so in the status line (see P1.4).
4. **Demo script.** Three steps a teammate can read out loud: open the site, point at the thresholds, run one scan, read the signal, the skip reason or the fill, and the cash line.
5. **Run locally.** `npm install`, `npm run dev`, `npm test`, `npm run lint`. Link `http://localhost:3000`.
6. **Environment.** A table of every variable, where it is read, and what breaks without it:

   | Variable | Required for | Read in |
   | --- | --- | --- |
   | `XAI_API_KEY` | live Grok scans | `lib/grok.ts`, `lib/supabase.ts` (`sentimentMode`) |
   | `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` | stored book | `lib/supabase.ts` |
   | `SUPABASE_SERVICE_ROLE_KEY` | server writes | `lib/supabase.ts` — server only, bypasses RLS |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY` | browser realtime | `app/api/config/route.ts` returns it to the client |

   State the rule: service role never gets a `NEXT_PUBLIC_` prefix. Anon key is public by design and must not be able to insert, update, or delete.
7. **Database.** Run `supabase/schema.sql` in the Supabase SQL editor before the first scan. Mention the singleton portfolio, realtime publication, and that memory mode is local-only because it dies with the process and splits across instances.
8. **Deploy.** Pointer to the live URL once P0.5 exists, plus "see Deploy below" with the Vercel steps from P0.5. Until the URL exists, this section says the production target and that memory mode must not be used there.
9. **Limits, written down.** One shared book. Reset clears trades and restores $10,000, and leaves signals in place. Sample rows are not tagged in the database (fixed in P1.3). Cash is a float today (fixed in P2.2). Scans are unauthenticated today (fixed in P0.4).

Also set `"name": "TickSense"` in `package.json`. The product name on the page and in the README is TickSense.

On GitHub, set the repo description to the first sentence of the README, and set the homepage to the deployed URL when it exists. Topics: `nextjs`, `supabase`, `paper-trading`.

**Files.** `README.md`, `package.json`. GitHub repo settings are outside the tree.

**Done when.** A teammate who has not seen the app can follow the README and get either sample mode or a real Supabase book, and can explain a skipped trade without reading `lib/trading.ts`.

### P0.3 Add `.env.example` and a test script

**Why.** The variable names exist only in the README and in `lib/supabase.ts`. `lib/trading.test.ts` is a real node:test file and `package.json` has no `test` script, so it does not run unless someone already knows it is there.

**Change.**

- Add `.env.example` with the four keys, empty values, and a one-line comment on each. Do not commit a filled `.env`. `.gitignore` already ignores `.env*`; add an exception `!.env.example`.
- Add `"test": "node --experimental-strip-types --test lib/trading.test.ts"` (or the equivalent flag on the Node version the team actually runs). Run it once and record the command that passed in the README.
- If `node --test` cannot import the TypeScript as-is, use the smallest runner already implied by Node. Do not add Jest.

**Files.** `.env.example`, `.gitignore`, `package.json`, `README.md`.

**Done when.** `npm test` exits 0 from a clean checkout, and copying `.env.example` to `.env.local` is the setup step the README names.

### P0.4 Lock the write endpoints before any public URL exists

**Why.** `POST /api/grok-scan` spends the xAI key (up to three calls, 60 second timeout each) and writes the shared book. `POST /api/portfolio/reset` deletes every trade and sets cash back to $10,000. Both are reachable by anyone who can see the site. `GET /api/portfolio`, `GET /api/signals`, and `GET /api/trades` are also open, which is acceptable only while the book is a deliberate public demo. The scan and the reset are not.

This is the gate for P0.5. Shipping the key to Vercel without it means every visitor can run the model.

**Change.** Smallest mechanism that holds for a public demo:

- Add `DESK_ADMIN_SECRET` (server-only, long random string).
- `POST /api/grok-scan` and `POST /api/portfolio/reset` require header `x-desk-secret: <secret>`.
- The dashboard reads the secret from a server-rendered prop or a same-origin route that sets a short-lived httpOnly cookie after a single "enable this browser" step. Pick one and document it. Do not put the secret in `NEXT_PUBLIC_*`.
- For the hackathon demo, an acceptable narrower version is: Vercel Deployment Protection in front of the whole site, plus the header check still present so a leaked preview URL is not an open meter. Write down which one is actually on.
- Return 401 with `{ error: "Unauthorized" }` and do not call Grok or Supabase on failure.
- Add one test or a tiny route-level assert that a missing secret does not call `runScan`. A function `assertDeskSecret(request: Request)` in `lib/http.ts` is enough to test without standing up Next.

Do not invent user accounts here. This is a desk lock, not auth.

**Files.** `lib/http.ts`, `app/api/grok-scan/route.ts`, `app/api/portfolio/reset/route.ts`, `components/dashboard.tsx`, `.env.example`, `README.md`.

**Done when.** `curl -X POST https://<host>/api/grok-scan` returns 401 and does not add a signal. The button on `/market` still scans. Reset from the page still works. Reset without the secret does not.

### P0.5 Deploy, then attach a domain

**Why.** The app has no deployment, no `homepage` on the GitHub repo, and memory mode will lie in production: `globalThis.__desk`, the price cache, and the sample-scan counter are per instance. Two serverless instances are two books.

**Order.**

1. Create the Supabase project if it does not exist. Run `supabase/schema.sql`. Confirm `public.portfolio` has one row, id 1, cash 10000. Confirm realtime includes `sentiment_signals` and `trades`.
2. Create a Vercel project from this GitHub repo, framework Next.js, root directory `.`. Production branch `main`.
3. Set the env vars from `.env.example`, including `XAI_API_KEY` and `DESK_ADMIN_SECRET`. All of them are Production and Preview. Preview can use the same Supabase project for the hackathon; say that in the README so nobody thinks preview has a private book.
4. Deploy `main` only after P0.4 is merged. Open the deployment URL. Run one scan. Refresh. The new signal and any fill are still there. Open a second browser. Same book.
5. Put the deployment URL in the README and in the GitHub homepage field.
6. Custom domain, after the `*.vercel.app` URL is already the one you demo: buy or pick the domain, add it in Vercel, set the DNS records Vercel shows, wait until the certificate is ready, then replace the URL in the README. Do not block the demo on DNS.

**Production rule.** If `SUPABASE_SERVICE_ROLE_KEY` is missing, the server should refuse to boot the scan route in production (`process.env.VERCEL_ENV === "production"`) with a clear error. Local `npm run dev` may keep memory mode.

**Done when.** The README URL loads the landing page, `/market` loads the desk, a scan survives refresh, and an unauthenticated POST does not call Grok. The custom domain, once attached, serves the same build over HTTPS.

### P0.6 Show the skip reason, and fix the chart title

**Why.** `ScanTickerResult.skippedReason` is already returned by `POST /api/grok-scan`. `summarize()` in `components/dashboard.tsx` throws it away and prints "BTC saved, no trade". The interesting half of the demo is why an order did not print. Separately, `components/sentiment-chart.tsx` titles the sentiment-only chart "Price & sentiment". Price is the other component, `TickerChart`, and only after a marker click.

**Change.**

- Status line per ticker: `BTC saved, no trade — Confidence 0.55 is below the minimum 0.75` using `skippedReason`. Keep the error string when `error` is set.
- Rename the sentiment chart heading to "Sentiment". Keep the marker hint.
- On the ticker chart, leave "Price" and "Sentiment" as the two frame titles.

**Files.** `components/dashboard.tsx`, `components/sentiment-chart.tsx`.

**Done when.** A sample-mode scan that hits the HOLD pattern shows the HOLD reason on the page without opening devtools. The overview chart does not say "Price".

### P0.7 Stop flashing a fake $10,000 book

**Why.** `useState<Portfolio>(DEFAULT_PORTFOLIO)` renders a full $10,000 flat book before `/api/portfolio` returns. On a deployed desk that already has fills, the first paint is a lie, and a failed load looks like a reset.

**Change.** Start portfolio as `null`. Render the metric row as a loading state until the first successful portfolio response. Keep the last good portfolio on later poll errors, and show the error string that already exists.

**Files.** `components/dashboard.tsx`.

**Done when.** A hard reload with a non-default book never shows $10,000 cash and zero coins on the way to the real numbers.

---

## P1 — Make the demo stronger

These are the product gaps a judge hits after the first scan. Do them after P0 is on a URL.

### P1.1 Persist the strategy, and label each signal's source

**Why.** Thresholds live in React state. A refresh restores the defaults while the book keeps fills that were made under other numbers, so the chart's reference lines no longer match the trades. `SentimentSource` (`"grok" | "sample"`) exists on the scan response and is not a column. After refresh, a sample sentence is indistinguishable from a live one. The header only knows the current server mode.

**Change.**

- Add `source text not null check (source in ('grok', 'sample'))` to `sentiment_signals`.
- Include `source` on `SignalDraft` / `SentimentSignal` and pass it through `recordSignal`.
- Show a small "Sample" or "Grok" badge on each card in `components/live-feeds.tsx`.
- Store the active strategy in one place the desk actually reads. For the shared book, a `strategy` jsonb column on `public.portfolio` (or four numeric columns) is enough. Load it with the portfolio. Save it when the scan button is pressed, so the numbers next to a fill are the numbers that were used. Debounced writes on every keystroke are unnecessary.
- Old rows: a one-time `update ... set source = 'sample'` is wrong if any live scans already ran. Leave existing rows as `source = 'unknown'` by making the check include `'unknown'` and defaulting the backfill to that. New scans write the real source.

**Files.** `supabase/schema.sql` (plus a short `supabase/migrate-source.sql` so a database that already ran the original file can catch up), `types/database.ts`, `lib/repository.ts`, `lib/scan.ts`, `components/live-feeds.tsx`, `components/dashboard.tsx`, `README.md`.

**Done when.** Refresh keeps the thresholds you last scanned with. A sample card and a Grok card are visually distinct after reload.

### P1.2 Show performance, not just cash

**Why.** The page shows cash, coin balances, and a marked-to-market total (`portfolioValue` in `lib/format.ts`). It never shows whether the desk made or lost money, or whether holding BTC from the first fill would have done better. That is the question the UI is for.

**Change.** From the trades already returned by `GET /api/trades` plus current prices:

- P&L in dollars and percent versus the $10,000 start. Total value already exists; subtract 10000.
- A simple equity series: walk trades in time order, mark holdings at the trade price (an approximation), and plot it. Label it "Marked at fill prices, plus cash". Do not pretend it is a tick-level equity curve.
- Per ticker: coins, market value, average cost from buy trades, unrealized P&L. Average cost can be a straightforward weighted average of buys minus sells at cost. Document the formula in a comment next to the function and extend `lib/trading.test.ts` with one buy-then-sell case.
- One line for "cash left, coins left" so a blown book is obvious.

Keep the math in `lib/format.ts` or a sibling `lib/performance.ts`. The component only prints numbers.

**Files.** `lib/performance.ts`, `lib/trading.test.ts` or `lib/performance.test.ts`, `components/dashboard.tsx`.

**Done when.** After the sample sequence prints a buy, the page shows a non-zero P&L figure that matches a hand calculation from the trade row and the CoinGecko price, and `npm test` covers that calculation.

### P1.3 Poll less, and make "live" mean one thing

**Why.** `components/dashboard.tsx` polls `/api/portfolio`, `/api/signals`, and `/api/trades` every 4 seconds, polls `/api/prices` every 20 seconds, and also subscribes to Supabase realtime. With realtime connected, the 4 second poll is a second source of truth racing the first (`generation` ref papers over some of it). The header says "Live inserts also arrive over Supabase Realtime" while sentiment itself only moves when a human clicks scan.

**Change.**

- When `config.supabase` is set and the channel status is `SUBSCRIBED`, stop the 4 second portfolio/signal/trade poll. Keep a slow reconcile every 30 seconds in case an event is missed.
- When realtime is not configured, keep the poll.
- Prices stay on their own timer. 20 seconds is fine; the server cache in `lib/prices.ts` is 15 seconds.
- Copy: "Signals update when you run a scan. Prices update on their own. New rows show up immediately when Supabase realtime is on."

**Files.** `components/dashboard.tsx`.

**Done when.** In Supabase mode, the network panel shows the three desk GETs on load and on the slow reconcile, not every 4 seconds, and a second browser still sees a new trade appear without a manual refresh.

### P1.4 Record whether the Grok call actually searched

**Why.** `analyzeTicker` tries the Responses API with `web_search` and `x_search`, then falls back to chat completions with no tools. Both successes are stored as source `grok`. The UI then says "Grok scans live X and news sentiment" for a completion that never looked anything up. The catalyst text is also uncited, so a demo cannot show the posts or headlines behind a score.

**Change.**

- Split the source, or add a `retrieval` field: `responses` versus `chat_fallback`. Surface the fallback in the scan status line: "Grok answered without live search."
- If the Responses payload includes citations or URLs, keep up to three of them. A `citations jsonb` column is enough. Render them as links on the signal card. If the API shape you get in practice has no citations, write that down in the README and ship the retrieval flag anyway. Do not invent links.
- Cap the prompt's catalyst at the 500 characters `parseDraft` already slices, and keep rendering it as text (React already escapes it).

**Files.** `lib/grok.ts`, `types/database.ts`, `supabase/schema.sql`, `components/live-feeds.tsx`, `README.md`.

**Done when.** A forced failure of the Responses call (bad tool name in a local experiment, then reverted) produces a visible fallback label, and a normal Responses success does not.

### P1.5 Scheduled scan for the demo hour

**Why.** The book is frozen unless someone is clicking. A judged demo that sits open looks dead.

**Change.** One Vercel Cron, every 10 minutes, `POST`ing the scan route with the desk secret, only in production, only while a `SCANS_ENABLED=true` env var is set. Default it to false in `.env.example` so a forgotten cron cannot spend the key all weekend. Log the skip reasons; do not page anyone.

Guard the spend: cron scans the three tickers once per run. At the current prompt that is three model calls. Write the expected call count in the README.

**Files.** `vercel.json` (cron), `app/api/grok-scan/route.ts` (already secret-gated), `.env.example`, `README.md`.

**Done when.** With the flag on, a new signal row appears without a browser click, and with the flag off the cron route returns without calling xAI.

### P1.6 README screenshots and a one-page demo path

**Why.** The landing pitch and the GitHub page still ask the reader to imagine the desk.

**Change.** After P0.5, capture two images from the deployed site: the landing, and `/market` after a scan with a fill and a skip both visible. Put them in `docs/` or the README with a sentence each. Keep them small.

**Files.** `README.md`, image files.

**Done when.** The README shows the actual UI, and the images match the deployed page.

### P1.7 CI

**Why.** Nothing runs lint or the trading tests on a pull request. PR #3 landed a form bug a 30-second click-through would have caught, and there is still no click-through in CI. Lint and unit tests are the part that can run unattended.

**Change.** GitHub Actions workflow: `npm ci`, `npm run lint`, `npm test`, `npm run build`. Build needs dummy env so Next does not require real secrets; the code already treats missing keys as memory and sample mode. Confirm that is true for `next build` and fix the build if it is not.

**Files.** `.github/workflows/ci.yml`, `package.json` if scripts need a tweak.

**Done when.** A pull request against `main` gets a green check from those three commands, and a failing `lib/trading.test.ts` assertion goes red.

---

## P2 — Accounts, only after the book is per person

Start this when the demo is live and the team still wants sign-up. Doing it earlier recreates PR #3's problem with more code.

### P2.1 Replace the singleton with a user-owned book

**Why.** `portfolio_singleton` and `resetDemo()`'s delete-all-trades are the data model. Supabase Auth does not change either.

**Change.**

- Enable email auth in the Supabase project. Use the Supabase client on the server with the anon key and the user's session for reads and writes that RLS allows. Keep the service role for migrations and for the cron, not for user requests.
- New tables, or altered ones:
  - `portfolio`: drop the `id = 1` check, add `user_id uuid primary key references auth.users(id)`, cash and holdings as they are, strategy columns from P1.1.
  - `sentiment_signals` and `trades`: add `user_id uuid not null references auth.users(id)`.
  - RLS: `select`, `insert`, `update`, `delete` only where `user_id = auth.uid()`. Remove the current "public read signals" and "public read trades" policies. Those policies plus the anon key in `/api/config` publish every visitor's scans to every other visitor.
- On first sign-in, insert that user's portfolio at $10,000 if missing.
- Reset deletes that user's trades and resets that user's row. It does not touch anyone else's.
- Realtime filters on `user_id`. The current channel listens to every insert in the table.
- `/api/config` stops being the way the browser learns the anon key if the key is already public in the client bundle. Prefer a server-created browser client that only exists when a session exists. Do not send the service role anywhere near the client. This is already true; keep it true.
- Map a missing session on `/market` to a redirect to `/`.

Provide `supabase/migrate-users.sql` that can run on the hackathon database. If the only existing row is the demo book, attribute it to a single demo user or delete it on purpose. Write the choice in the migration comment. Do not silently attach the shared history to the first person who signs up.

**Files.** `supabase/schema.sql`, `supabase/migrate-users.sql`, `lib/supabase.ts`, `lib/repository.ts`, `app/api/config/route.ts`, `components/dashboard.tsx`, every route under `app/api/`.

**Done when.** Two accounts each run a scan and a reset, and each refresh shows only that account's cash, signals, and trades. A third signed-out request to `/api/portfolio` returns 401.

### P2.2 Put the landing form back, for real

**Why.** P0.1 removed the form because it could not do its job. After P2.1 it can.

**Change.**

- Sign up and log in call `supabase.auth.signUp` and `supabase.auth.signInWithPassword`.
- Email input is `type="email"`. Password has a minimum the Supabase project actually enforces; show that number on the field.
- Errors from Supabase print in the notice area. A successful session routes to `/market`.
- "Start paper trading" is not a bypass. If you still want a no-account path for judges, make it a separate text button, "View the shared demo", that signs into one published demo user server-side. Do not overload the login button with an empty-field hack.
- Sign out lives on `/market` and returns to `/`.

**Files.** `components/landing.tsx`, a small `lib/auth.ts` or server actions colocated with the page, `components/dashboard.tsx`.

**Done when.** A new email can sign up, land on an empty $10,000 book, refresh, and still be that user. Wrong password stays on `/` with the error. The demo user, if you keep one, cannot reset a normal user's book.

### P2.3 Money as decimals, and one transaction per fill

**Why.** Cash and notionals are `float8`. `roundCash` and `roundCoin` in `lib/trading.ts` reduce the damage and do not make the column a decimal. `persistSupabase` updates the portfolio and then inserts the trade. If the process dies between them, cash has moved and no trade exists. The compensating update only runs when the trade insert returns an error.

**Change.**

- Columns: `numeric(14,2)` for USD amounts, `numeric(24,8)` for coin amounts. Do the migration with an explicit cast.
- One Postgres function `apply_fill(...)` that inserts the signal, updates the portfolio, and inserts the trade in a single transaction, or inserts the signal and returns the skip reason without touching cash. Call it from `lib/repository.ts`. The TypeScript `planTrade` result stays the source of the numbers; the function persists them atomically.
- Keep the in-memory path for local demo, still behind the queue in `lib/repository.ts`.

**Files.** `supabase/schema.sql`, a new migration, `lib/repository.ts`, `lib/trading.test.ts` if rounding expectations change.

**Done when.** A forced failure inside the function rolls back cash and the trade together, and a successful fill still matches the existing trading tests' cash and coin amounts.

### P2.4 Rate-limit scans per user

**Why.** P0.4 stops anonymous spend. A signed-in user can still hold the button down. Each scan is up to three model calls.

**Change.** Reject a scan when that user has another in flight, and when they have scanned more than N times in the last hour. N starts at 12. Return 429 and the existing error line on the dashboard. The cron uses the service role and its own counter so it does not eat the user's budget; document that.

**Files.** `lib/scan.ts` or `lib/repository.ts`, `app/api/grok-scan/route.ts`.

**Done when.** The 13th manual scan in an hour returns 429, and the in-flight double-click returns one scan, not two.

---

## P3 — Fit and finish

Do these when P0–P1 are in and they are cheap. None of them should jump the queue ahead of the deploy lock.

### P3.1 Times and locale

`formatWhen` and the ticker chart axis hardcode `America/Phoenix`. That matches a Tempe demo and mislabels everyone else. Format in the browser's local zone (`undefined` time zone in `Intl`). Keep a test or a comment that the server does not re-format these strings.

**Files.** `lib/format.ts`, `components/ticker-chart.tsx`.

### P3.2 CoinGecko

Public CoinGecko will throttle a busy demo. Add optional `COINGECKO_API_KEY`, send it only from `lib/prices.ts`, and keep the existing caches (15s quotes, 60s history). On a 429, serve the cache if you have it and surface "prices delayed" instead of wiping the last good quote. History is one day; leave it at one day until someone asks for a range switch.

**Files.** `lib/prices.ts`, `.env.example`, `components/dashboard.tsx`.

### P3.3 Page metadata, icon, leftover boilerplate

- `app/layout.tsx` title and description are fine; add an Open Graph title and description that match the README's first paragraph.
- Add a real icon. Delete unused `public/vercel.svg`, `public/file.svg`, and `public/window.svg` if nothing references them.
- Remove the empty comment and confirm `cacheComponents` and `partialPrefetching` in `next.config.ts` are options this Next build actually honors. This repo's Next is not the one in general training data; check `node_modules/next/dist/docs/` before changing that file. If the keys are ignored, delete them.
- `AGENTS.md` is generated by `next dev`. Leave it in place.

**Files.** `app/layout.tsx`, `public/`, `next.config.ts`.

### P3.4 Chart markers and the keyboard

Sentiment markers are SVG circles with `onClick` and no keyboard path. The legend click already selects a ticker. Add `tabIndex={0}` and an Enter / Space handler on a real `<button>` per ticker in the legend area, or make the existing ticker price chips the primary keyboard path and say so. The chips already toggle `selectedTicker`. Minimum: the price chips remain the accessible way to open `TickerChart`, and the marker hint text says "or press a ticker chip".

**Files.** `components/sentiment-chart.tsx`, `components/dashboard.tsx`.

### P3.5 Disclaimer on the desk

One persistent line in the footer of `/` and `/market`: paper trading, not investment advice, fills are simulated at the last CoinGecko price, sentiment is a model output. Same sentence in the README.

**Files.** `components/landing.tsx`, `components/dashboard.tsx`, `README.md`.

### P3.6 Split `Dashboard` only when a second concern lands

`components/dashboard.tsx` fetches, subscribes, scans, resets, and renders. That held while it was the whole app. When P2 adds a session, move data loading into one hook (`useDesk`) and leave the component as markup. Do not split it before then, and do not introduce a service interface layer around Supabase beyond the repository that already exists.

**Files.** `components/dashboard.tsx`, `components/use-desk.ts` (only as part of the P2 work).

---

## Suggested order from here

| Order | Item | Outcome |
| --- | --- | --- |
| 1 | **P0.5 Deploy** | Vercel + Supabase + `DESK_ADMIN_SECRET`; put URL in README + GitHub homepage |
| 2 | Custom domain | Same build, name on the slide |
| 3 | Close PR #3 | Comment: landing kept, auth deferred to P2; close without merging |
| 4 | P1.1 | Persist strategy; Sample/Grok badge on signal cards |
| 5 | P1.4, P1.5 | Honest retrieval label; optional cron with `SCANS_ENABLED` |
| 6 | P1.6 | Two screenshots in README |
| 7 | P2 only if needed | Per-user books first, then real auth form |
| 8 | P3 | Locale, CoinGecko key, a11y markers |

## Explicitly out of scope until someone asks

- More tickers than BTC, ETH, and SOL. The checks are duplicated in SQL, `isTicker`, and the UI on purpose. Adding one ticker means all three, plus CoinGecko ids. Do not "make it generic" first.
- Real brokerage, API keys for exchanges, or live orders. The product is paper.
- A second charting library. Recharts stays.
- Rewriting the repository behind an interface hierarchy. `getServiceClient()` returning null for memory mode is the seam. Keep it.
- Merging PR #3 unchanged.
