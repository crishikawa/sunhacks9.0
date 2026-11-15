---
name: paper-desk-briefing
description: >-
  Summarize TickSense from GET /api/brief: cash, profit or loss,
  latest signals, and latest fills. Use when a Grok Bot routine or a teammate
  asks for the paper-desk briefing. Never scan, reset, or spend the xAI key.
---

# Paper desk briefing

Read the desk. Report what it says. Do not trade.

## When

- A Grok Bot routine asks for the paper-desk briefing.
- A teammate asks how the shared paper book is doing.

## Inputs

- `DESK_URL`, the deployed origin, with no trailing slash. If it is missing, ask for it once. If the request fails, report the failure and stop.

## Steps

1. `GET {DESK_URL}/api/brief`.
2. Read only that JSON. Do not open broker sites, and do not call `POST /api/grok-scan` or `POST /api/portfolio/reset`.
3. Write a short note in plain sentences:
   - cash and total value
   - profit or loss versus $10,000 when `pnlUsd` is present
   - whether sentiment is running in sample mode or live Grok mode
   - up to three latest signals: ticker, action, score, and the catalyst sentence
   - up to three latest fills: ticker, buy or sell, dollars, price
4. If a field is null, say it is missing. Do not invent a price, a catalyst, or a citation.
5. End with one line: this is paper trading, not a recommendation.

## Done when

The note matches the JSON. A failed GET is the whole note. No scan was started and the book was not reset.
