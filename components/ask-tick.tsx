"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronRight, Minus } from "lucide-react";
import { Tick } from "@/components/tick";

type Source = "grok" | "sample";
type Message = { role: "user" | "assistant"; content: string; source?: Source; at?: string; error?: boolean };

const SOURCE_LABEL: Record<Source, string> = {
  grok: "Grok · desk data, X and web",
  sample: "Demo mode · answers from desk data",
};

export function AskTick({ deskSecret, coin }: { deskSecret: string; coin: string | null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const suggestions = [
    `How is ${coin ?? "Bitcoin"} performing today?`,
    "Which coin has the strongest sentiment right now?",
    "Summarize my paper portfolio.",
    "Why did the desk make its last trade?",
  ];

  async function send(text: string) {
    const content = text.trim();
    if (!content || thinking) return;
    const history: Message[] = [...messages, { role: "user", content }];
    setMessages(history);
    setDraft("");
    setThinking(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", ...(deskSecret ? { "x-desk-secret": deskSecret } : {}) },
        body: JSON.stringify({
          messages: history.filter((m) => !m.error).map(({ role, content: c }) => ({ role, content: c })),
        }),
      });
      const body = (await response.json()) as { reply?: string; source?: Source; error?: string };
      const at = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      setMessages((current) => [
        ...current,
        response.ok && body.reply
          ? { role: "assistant", content: body.reply, source: body.source ?? "sample", at }
          : { role: "assistant", content: body.error ?? "Tick couldn't answer that. Try again in a moment.", error: true },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "Connection lost. Try again in a moment.", error: true },
      ]);
    } finally {
      setThinking(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-30 flex h-11 items-center gap-2 rounded-full border border-line bg-bg pr-4 pl-2 text-sm font-medium shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)] transition-colors hover:border-dim sm:right-6 sm:bottom-6"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <Tick mood="neutral" size={28} />
        Ask Tick
      </button>
    );
  }

  return (
    <section
      aria-label="Ask Tick"
      className="fixed inset-x-3 bottom-3 z-30 flex max-h-[min(620px,calc(100dvh-24px))] flex-col overflow-hidden rounded-xl border border-line bg-bg shadow-[0_24px_60px_-20px_rgba(0,0,0,0.4)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[420px]"
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Tick mood={thinking ? "scan" : "neutral"} size={30} />
        <div className="flex flex-1 flex-col leading-tight">
          <span className="text-sm font-semibold">Tick</span>
          <span className="text-xs text-muted">Market assistant for your paper desk</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Minimize"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-panel hover:text-fg"
        >
          <Minus size={16} />
        </button>
      </header>

      <div ref={list} className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-5" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-6 text-soft">
              Ask about any coin on your watchlist, the desk&apos;s latest sentiment reads, recent trades, or your paper
              portfolio.
            </p>
            <ul className="-mx-1 flex flex-col">
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="group flex w-full items-center justify-between gap-3 rounded-md px-2 py-2.5 text-left text-sm text-fg transition-colors hover:bg-panel"
                  >
                    {suggestion}
                    <ChevronRight size={15} className="shrink-0 text-dim transition-colors group-hover:text-fg" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {messages.map((message, index) =>
          message.role === "user" ? (
            <p key={index} className="max-w-[85%] self-end rounded-lg bg-panel px-3.5 py-2 text-sm leading-6">
              {message.content}
            </p>
          ) : (
            <div key={index} className="flex flex-col gap-1.5">
              <p className={`text-sm leading-6 whitespace-pre-wrap ${message.error ? "text-down" : "text-fg"}`}>
                {message.content}
              </p>
              {message.source ? (
                <span className="text-[11px] text-muted">
                  {SOURCE_LABEL[message.source]}
                  {message.at ? ` · ${message.at}` : ""}
                </span>
              ) : null}
            </div>
          ),
        )}

        {thinking ? <p className="text-sm text-muted">Analyzing the desk…</p> : null}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
        className="border-t border-line p-3"
      >
        <div className="flex items-end gap-2 rounded-lg border border-line bg-bg px-3 py-2">
          <label htmlFor="ask-tick-input" className="sr-only">
            Ask Tick a question
          </label>
          <textarea
            id="ask-tick-input"
            ref={input}
            rows={1}
            maxLength={1500}
            value={draft}
            placeholder="Ask about a coin, a trade, or your portfolio"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
            className="max-h-32 min-h-6 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || thinking}
            aria-label="Send"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-fg text-bg transition-opacity disabled:opacity-25"
          >
            <ArrowUp size={16} />
          </button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-muted">Paper trading only. Not financial advice.</p>
      </form>
    </section>
  );
}
