// RUQ scoring framework — the five manual-entry conditions.
//
// Every score is entered by a human (0/1/2). Nothing here auto-derives a
// judgement. This module only does the deterministic bookkeeping the rules
// demand: summing the total, applying the C1 gate, and placing the quadrant.

import type { Signal } from "@/lib/types";

export type CondKey =
  | "cond_floor"
  | "cond_valuation"
  | "cond_catalyst"
  | "cond_beta"
  | "cond_headroom";

export type Axis = "x" | "y";

export interface Condition {
  key: CondKey;
  n: number; // 1–5, display order
  label: string;
  hint: string;
  axis: Axis; // which quadrant axis it feeds
}

// 0 = 不满足, 1 = 部分满足, 2 = 明确满足
export const SCORE_OPTIONS = [
  { value: 0, label: "0 · 不满足" },
  { value: 1, label: "1 · 部分满足" },
  { value: 2, label: "2 · 明确满足" },
] as const;

export const CONDITIONS: Condition[] = [
  { key: "cond_floor", n: 1, label: "现金流底", hint: "新故事破灭后主业能否撑住不归零", axis: "x" },
  { key: "cond_valuation", n: 2, label: "估值便宜档", hint: "市场是否仍按老业务给它定价", axis: "x" },
  { key: "cond_catalyst", n: 3, label: "可证伪节点", hint: "新业务进展能否用具体财务/运营指标跟踪", axis: "y" },
  { key: "cond_beta", n: 4, label: "板块 β", hint: "所在板块/题材贝塔与当前市场风格是否共振", axis: "y" },
  { key: "cond_headroom", n: 5, label: "机构空间", hint: "增量资金(尤其公募/北向)是否还有进场空间", axis: "y" },
];

export type CondScores = Record<CondKey, number>;

// x: 现金流底 + 估值便宜档 (0–4) ; y: 可证伪 + β + 机构空间 (0–6)
const X_MAX = 4;
const Y_MAX = 6;

export function totalScore(s: CondScores): number {
  return CONDITIONS.reduce((sum, c) => sum + (s[c.key] ?? 0), 0);
}

export function axisRaw(s: CondScores) {
  return {
    x: s.cond_floor + s.cond_valuation, // 0–4
    y: s.cond_catalyst + s.cond_beta + s.cond_headroom, // 0–6
  };
}

// Dot position on the 0–10 quadrant map. The C1 gate (cond_floor === 0) pins
// the dot to the left half regardless of the other scores.
export function quadrantPosition(s: CondScores): { fund: number; narr: number } {
  const { x, y } = axisRaw(s);
  let fund = (x / X_MAX) * 10;
  const narr = (y / Y_MAX) * 10;
  if (s.cond_floor === 0 && fund >= 5) fund = 4.6; // C1 gate → 左侧
  return { fund, narr };
}

// Quadrant label. c1_gated (governance veto) reports "—"; otherwise left/right
// is decided by the x conditions — but cond_floor === 0 forces left (C1 gate).
export function quadrantLabel(s: CondScores, c1Gated: boolean): string {
  if (c1Gated) return "—";
  const left = s.cond_floor === 0 ? true : s.cond_floor + s.cond_valuation <= 2;
  const top = s.cond_catalyst + s.cond_beta + s.cond_headroom > 3;
  if (left) return top ? "左上" : "左下";
  return top ? "右上" : "右下";
}

// Signal lights = per-condition health (2 ok / 1 warn / 0 red), in display order.
export function conditionSignals(s: CondScores): Signal[] {
  return CONDITIONS.map((c) => {
    const v = s[c.key];
    return v >= 2 ? "ok" : v === 1 ? "warn" : "red";
  });
}
