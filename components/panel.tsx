import type { ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-bg p-5 ${className}`}>{children}</section>
  );
}

export function PanelHead({ title, meta, action }: { title: string; meta?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="flex items-baseline gap-3">
        {meta ? <span className="text-xs text-muted">{meta}</span> : null}
        {action}
      </div>
    </div>
  );
}

export function CoinAvatar({ symbol, thumb, size = 36 }: { symbol: string; thumb?: string | null; size?: number }) {
  if (thumb) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny remote coin logos; next/image would need a remote host allowlist
      <img
        src={thumb}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-line bg-panel"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-line bg-panel font-semibold text-soft"
      style={{ width: size, height: size, fontSize: symbol.length > 3 ? 9 : 11 }}
      aria-hidden="true"
    >
      {symbol.slice(0, 4)}
    </span>
  );
}
