export type Mood = "bull" | "neutral" | "bear" | "scan";

// Face strokes live in a 200x220 design space centred on (100, 94); the <g> scales them onto the screen.
const FACES: Record<Mood, { eyes: string; mouth: string; brows?: string; scan?: string }> = {
  bull: { eyes: "M70 92 Q80 80 90 92 M110 92 Q120 80 130 92", mouth: "M84 108 Q100 122 116 108" },
  neutral: { eyes: "M80 88 L80 88.1 M120 88 L120 88.1", mouth: "M88 112 L112 112" },
  bear: {
    eyes: "M80 94 L80 94.1 M120 94 L120 94.1",
    brows: "M70 82 L88 76 M112 76 L130 82",
    mouth: "M86 118 Q100 106 114 118",
  },
  scan: { eyes: "M90 88 L90 88.1 M130 88 L130 88.1", mouth: "M98 112 L104 112", scan: "M54 100 L146 100" },
};

// The chest chart is the only colour on Tick.
const CHART: Record<Mood, { d: string; color: string }> = {
  bull: { d: "M84 154 L92 150 L100 152 L108 146 L116 143", color: "#34d399" },
  neutral: { d: "M84 150 L92 148 L100 151 L108 149 L116 150", color: "#8a8a8a" },
  bear: { d: "M84 143 L92 147 L100 145 L108 151 L116 154", color: "#f87171" },
  scan: { d: "M84 150 L92 150 M98 150 L104 150 M110 150 L116 150", color: "#7aa2ff" },
};

const LABEL: Record<Mood, string> = { bull: "bullish", neutral: "calm", bear: "worried", scan: "scanning" };

export function moodFromScore(score: number | undefined): Mood {
  if (score == null) return "neutral";
  return score > 0.15 ? "bull" : score < -0.15 ? "bear" : "neutral";
}

export function Tick({ mood = "neutral", size = 40, className = "" }: { mood?: Mood; size?: number; className?: string }) {
  const face = FACES[mood];
  const chart = CHART[mood];
  // Below 40px the chest chart is unreadable, so the screen edge carries the mood colour instead.
  const small = size < 40;
  return (
    <svg
      width={size}
      height={Math.round((size * 146) / 156)}
      viewBox="22 32 156 146"
      role="img"
      aria-label={`Tick is ${LABEL[mood]}`}
      className={`shrink-0 ${className}`}
    >
      <rect x="30" y="40" width="140" height="130" rx="34" fill="var(--tick-body)" stroke="var(--tick-edge)" strokeWidth="3" />
      <rect
        x="40"
        y="50"
        width="120"
        height="92"
        rx="24"
        fill="var(--tick-screen)"
        stroke={small ? chart.color : "none"}
        strokeWidth={small ? 8 : 0}
      />
      <g transform="translate(100 96) scale(1.18) translate(-100 -94)" fill="none" stroke="var(--tick-face)" strokeLinecap="round">
        {face.scan ? <path className="tick-scan" d={face.scan} strokeWidth="2" strokeOpacity="0.4" /> : null}
        {face.brows ? <path d={face.brows} strokeWidth="5" /> : null}
        <path d={face.eyes} strokeWidth="7" />
        <path d={face.mouth} strokeWidth="7" />
      </g>
      {small ? null : <rect x="76" y="146" width="48" height="18" rx="6" fill="var(--tick-screen)" />}
      {small ? null : (
      <path
        d={chart.d}
        transform="translate(0 6)"
        fill="none"
        stroke={chart.color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      )}
    </svg>
  );
}
