import {
  conditionSignals,
  quadrantLabel,
  quadrantPosition,
  type CondScores,
} from "@/lib/scoring";
import type {
  EvaluationRow,
  StockRow,
  TimelinePoint,
  WatchlistEntry,
} from "@/lib/types";

function condScores(e: EvaluationRow): CondScores {
  return {
    cond_floor: e.cond_floor,
    cond_valuation: e.cond_valuation,
    cond_catalyst: e.cond_catalyst,
    cond_beta: e.cond_beta,
    cond_headroom: e.cond_headroom,
  };
}

// "2026-06-02" -> "06-02"
function mmdd(isoDate: string): string {
  return isoDate.slice(5, 10).replace("-", "-");
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

  // Drift trajectory: only for holdings that have a prior evaluation.
  const prev = latest.status === "holding" ? evals[1] : undefined;
  const drift = prev ? quadrantPosition(condScores(prev)) : undefined;
  const trend =
    prev && latest.total_score < prev.total_score ? ("down" as const) : undefined;

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
    trend,
    drift,
    veto,
  };
}

// 评分漂移时间线: RUQ total over eval_date, oldest → newest.
export function buildTimeline(evals: EvaluationRow[]): TimelinePoint[] {
  return [...evals]
    .sort((a, b) => a.eval_date.localeCompare(b.eval_date))
    .map((e) => ({ date: e.eval_date, total: e.total_score, gated: e.c1_gated }));
}
