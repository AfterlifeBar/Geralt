import {
  conditionSignals,
  quadrantLabel,
  quadrantPosition,
  type CondScores,
} from "@/lib/scoring";
import { mmdd } from "@/lib/dates";
import type {
  EvaluationRow,
  StockRow,
  TimelinePoint,
  WatchlistEntry,
} from "@/lib/types";

export function condScores(e: EvaluationRow): CondScores {
  return {
    cond_floor: e.cond_floor,
    cond_valuation: e.cond_valuation,
    cond_catalyst: e.cond_catalyst,
    cond_beta: e.cond_beta,
    cond_headroom: e.cond_headroom,
  };
}

// Build a watchlist row from a stock + its evaluations (newest first).
export function toWatchlistEntry(
  stock: StockRow,
  evals: EvaluationRow[],
): WatchlistEntry | null {
  const latest = evals[0];
  if (!latest) return null; // no evaluation yet — not shown on the map/table

  const scores = condScores(latest);
  const pos = quadrantPosition(scores);
  const veto = latest.c1_gated;

  // Drift trajectory + trend: any stock with a prior evaluation.
  const prev = evals[1];
  const prevScores = prev ? condScores(prev) : undefined;
  const drift = prevScores ? quadrantPosition(prevScores) : undefined;
  const quadrantFrom = prev && prevScores
    ? quadrantLabel(prevScores, prev.c1_gated)
    : undefined;
  const trend = prev
    ? latest.total_score < prev.total_score
      ? ("down" as const)
      : latest.total_score > prev.total_score
        ? ("up" as const)
        : undefined
    : undefined;

  return {
    code: stock.code,
    name: stock.name,
    status: latest.status,
    ruq: veto ? null : latest.total_score,
    fund: pos.fund,
    narr: pos.narr,
    quadrant: quadrantLabel(scores, veto),
    signals: conditionSignals(scores),
    lastEval: mmdd(latest.eval_date),
    lastEvalDate: latest.eval_date,
    trend,
    drift,
    quadrantFrom,
    veto,
  };
}

// 评分漂移时间线: RUQ total over eval_date, oldest → newest.
// Same-date evaluations are ordered by created_at so the last plotted point
// is always the most recently recorded one.
export function buildTimeline(evals: EvaluationRow[]): TimelinePoint[] {
  return [...evals]
    .sort(
      (a, b) =>
        a.eval_date.localeCompare(b.eval_date) ||
        (a.created_at ?? "").localeCompare(b.created_at ?? ""),
    )
    .map((e) => ({ date: e.eval_date, total: e.total_score, gated: e.c1_gated }));
}
