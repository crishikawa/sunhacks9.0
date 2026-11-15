-- TickSense: any coin, not just BTC/ETH/SOL.
-- Run once in the Supabase SQL editor on a project that already ran the original schema.sql.
-- Additive and safe to re-run: the old btc/eth/sol columns are kept, their balances are copied into holdings.

create table if not exists public.watchlist (
  symbol text primary key check (symbol ~ '^[A-Z0-9]{1,15}$'),
  coingecko_id text not null unique,
  name text not null,
  thumb text,
  added_at timestamptz not null default now()
);

insert into public.watchlist (symbol, coingecko_id, name, added_at) values
  ('BTC', 'bitcoin', 'Bitcoin', now() - interval '3 seconds'),
  ('ETH', 'ethereum', 'Ethereum', now() - interval '2 seconds'),
  ('SOL', 'solana', 'Solana', now() - interval '1 second')
on conflict (symbol) do nothing;

create table if not exists public.holdings (
  symbol text primary key check (symbol ~ '^[A-Z0-9]{1,15}$'),
  quantity float8 not null default 0 check (quantity >= 0)
);

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'portfolio' and column_name = 'btc_holdings') then
    insert into public.holdings (symbol, quantity)
      select 'BTC', btc_holdings from public.portfolio where id = 1 and btc_holdings > 0
    on conflict (symbol) do nothing;
    insert into public.holdings (symbol, quantity)
      select 'ETH', eth_holdings from public.portfolio where id = 1 and eth_holdings > 0
    on conflict (symbol) do nothing;
    insert into public.holdings (symbol, quantity)
      select 'SOL', sol_holdings from public.portfolio where id = 1 and sol_holdings > 0
    on conflict (symbol) do nothing;
  end if;
end $$;

-- Signals and trades may now reference any watchlist symbol.
alter table public.sentiment_signals drop constraint if exists sentiment_signals_ticker_check;
alter table public.sentiment_signals add constraint sentiment_signals_ticker_check check (ticker ~ '^[A-Z0-9]{1,15}$');
alter table public.trades drop constraint if exists trades_ticker_check;
alter table public.trades add constraint trades_ticker_check check (ticker ~ '^[A-Z0-9]{1,15}$');

alter table public.watchlist enable row level security;
alter table public.holdings enable row level security;

drop policy if exists "public read watchlist" on public.watchlist;
create policy "public read watchlist" on public.watchlist for select to anon, authenticated using (true);
drop policy if exists "public read holdings" on public.holdings;
create policy "public read holdings" on public.holdings for select to anon, authenticated using (true);

notify pgrst, 'reload schema';
