// Coins are told apart by shade and dash so green/red stay reserved for gains and losses.
const STYLES: Array<{ stroke: string; dash?: string }> = [
  { stroke: "var(--fg)" },
  { stroke: "var(--muted)", dash: "6 4" },
  { stroke: "var(--dim)", dash: "2 3" },
  { stroke: "var(--soft)", dash: "10 3 2 3" },
  { stroke: "var(--fg)", dash: "1 5" },
  { stroke: "var(--muted)", dash: "14 4" },
];

export function lineStyle(index: number) {
  return STYLES[index % STYLES.length];
}

export const UP = "var(--up)";
export const DOWN = "var(--down)";

export const AXIS_TICK = { fill: "var(--muted)", fontSize: 11 };

export const TOOLTIP_STYLE = {
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
};
