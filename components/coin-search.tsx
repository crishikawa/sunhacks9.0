"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { CoinAvatar } from "@/components/panel";
import type { Asset } from "@/types/database";

type Result = Asset & { rank: number | null };

export function CoinSearch({
  watchlist,
  canAdd,
  onAdd,
  onOpen,
}: {
  watchlist: Asset[];
  canAdd: boolean;
  onAdd: (asset: Asset) => Promise<void>;
  onOpen: (symbol: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ query: string; results: Result[]; error: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const q = query.trim();
  const results = q && found?.query === q ? found.results : [];
  const loading = q !== "" && found?.query !== q;
  const onList = (id: string) => watchlist.find((asset) => asset.coingecko_id === id);

  // Debounced search; stale responses are ignored because results are keyed by their query.
  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/coins/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then(async (response) => {
          const body = (await response.json()) as { results?: Result[]; error?: string };
          setFound({
            query: q,
            results: body.results ?? [],
            error: response.ok
              ? null
              : body.error?.includes("429")
                ? "Search is busy. Try again in a minute."
                : (body.error ?? "Search failed"),
          });
          setActive(0);
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  // Press "/" anywhere to jump into search, like most trading apps.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || target?.closest("input, textarea, select, [contenteditable]")) return;
      event.preventDefault();
      input.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function choose(result: Result) {
    const existing = onList(result.coingecko_id);
    if (existing) {
      onOpen(existing.symbol);
    } else if (!canAdd) {
      return;
    } else {
      setAdding(result.coingecko_id);
      try {
        await onAdd(result);
      } finally {
        setAdding(null);
      }
    }
    setQuery("");
    setOpen(false);
    input.current?.blur();
  }

  const showList = open && q !== "";

  return (
    <div className="relative w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Search coins"
        placeholder="Search any coin, e.g. Dogecoin or PEPE"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && results[active]) {
            event.preventDefault();
            void choose(results[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
            input.current?.blur();
          }
        }}
        className="h-10 w-full rounded-lg border border-line bg-panel pr-10 pl-10 text-sm text-fg outline-none placeholder:text-muted focus:bg-bg focus-visible:outline-none"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-line px-1.5 text-[11px] text-muted sm:block">
        /
      </kbd>

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          onMouseDown={(event) => event.preventDefault()}
          className="absolute top-full left-0 z-30 mt-2 max-h-[26rem] w-full overflow-auto rounded-xl border border-line bg-bg py-1.5 shadow-lg"
        >
          {loading ? <li className="px-4 py-3 text-sm text-muted">Searching…</li> : null}
          {!loading && found?.error ? <li className="px-4 py-3 text-sm text-down">{found.error}</li> : null}
          {!loading && !found?.error && results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No coins match “{q}”.</li>
          ) : null}
          {results.map((result, index) => {
            const existing = onList(result.coingecko_id);
            return (
              <li
                key={result.coingecko_id}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => void choose(result)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${index === active ? "bg-panel" : ""}`}
              >
                <CoinAvatar symbol={result.symbol} thumb={result.thumb} size={28} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{result.name}</span>
                  <span className="text-xs text-muted">
                    {result.symbol}
                    {result.rank ? ` · #${result.rank} by market cap` : ""}
                  </span>
                </div>
                {existing ? (
                  <span className="text-xs font-medium text-muted">On your list</span>
                ) : !canAdd ? (
                  <span className="text-xs text-muted" title="Run the watchlist migration on Supabase to add coins">
                    Adding soon
                  </span>
                ) : (
                  <span className="rounded-md bg-up/10 px-2.5 py-1 text-xs font-semibold text-up">
                    {adding === result.coingecko_id ? "Adding…" : "+ Add"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
