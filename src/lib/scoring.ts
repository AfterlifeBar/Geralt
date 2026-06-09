// RUQ scoring framework — the five manual-entry dimensions.
//
// IMPORTANT: scores are ALWAYS entered by a human. Nothing here auto-derives a
// judgement. `totalScore` is plain arithmetic over the five entered values, not
// an opinion — and it is suppressed entirely when a governance veto fires.
//
// These dimension keys/labels are PLACEHOLDERS. Rename `label` (and optionally
// the keys) once the real RUQ framework is confirmed — the form, the timeline,
// and the home aggregation all read from this single list.

export type DimensionKey =
  | "fundamentals"
  | "narrative"
  | "valuation"
  | "catalyst"
  | "risk";

export interface Dimension {
  key: DimensionKey;
  label: string; // shown in the form + detail page
  hint?: string; // optional helper text under the field
}

// Scores are integers on this inclusive scale.
export const SCORE_MIN = 0;
export const SCORE_MAX = 10;

export const DIMENSIONS: Dimension[] = [
  { key: "fundamentals", label: "基本面", hint: "占位维度 — 待替换" },
  { key: "narrative", label: "叙事", hint: "占位维度 — 待替换" },
  { key: "valuation", label: "估值", hint: "占位维度 — 待替换" },
  { key: "catalyst", label: "催化", hint: "占位维度 — 待替换" },
  { key: "risk", label: "风险", hint: "占位维度 — 待替换" },
];

export type DimensionScores = Record<DimensionKey, number>;

// Plain sum of the five entered dimension scores. Returns null when a governance
// veto is triggered — a vetoed evaluation does not produce a total at all.
export function computeTotalScore(
  scores: DimensionScores,
  vetoTriggered: boolean,
): number | null {
  if (vetoTriggered) return null;
  return DIMENSIONS.reduce((sum, d) => sum + (scores[d.key] ?? 0), 0);
}
