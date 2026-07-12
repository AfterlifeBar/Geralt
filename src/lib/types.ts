// View-model types for the UI layer. These mirror the shape the reference
// `WatchlistHome.jsx` renders against, so the layout maps 1:1 to data. The
// mapping from DB rows (stocks + evaluations) onto these is finalized once the
// schema SQL lands; the components below only ever see these view models.

export type StockStatus = "tracking" | "holding" | "candidate";

// ---- DB row shapes (stocks + evaluations) -------------------------------

export interface StockRow {
  code: string;
  name: string;
  created_at?: string;
}

export interface EvaluationRow {
  id: string;
  stock_code: string;
  eval_date: string; // ISO date
  cond_floor: number;
  cond_valuation: number;
  cond_catalyst: number;
  cond_beta: number;
  cond_headroom: number;
  total_score: number; // generated = sum of five
  c1_gated: boolean;
  veto_reason: string | null;
  devils_advocate: string | null;
  falsification: string | null;
  status: StockStatus;
  notes: string | null;
  created_at?: string;
}

// One point on the 评分漂移时间线 (RUQ total over eval_date).
export interface TimelinePoint {
  date: string; // ISO date
  total: number; // total_score 0–10
  gated: boolean; // C1 / governance veto at this evaluation
}

// signal-light states
export type Signal = "ok" | "warn" | "red";

// Quadrant-map position for one stock, derived from its latest evaluation.
export interface QuadrantPosition {
  fund: number; // 0–10, x axis (基本面 强 →)
  narr: number; // 0–10, y axis (叙事弹性 强 ↑)
}

// One row on the watchlist home + its dot on the quadrant map.
export interface WatchlistEntry {
  code: string;
  name: string;
  status: StockStatus;
  ruq: number | null; // RUQ total; null when vetoed
  fund: number;
  narr: number;
  quadrant: string; // e.g. "右上" / "右下" / "—"
  signals: Signal[];
  lastEval: string; // display string, e.g. "06-02"
  lastEvalDate: string; // full ISO date — sort on this, never on lastEval
  trend?: "down" | "up";
  drift?: QuadrantPosition; // previous evaluation's position (dashed trajectory)
  quadrantFrom?: string; // previous evaluation's quadrant label (drift caption)
  veto?: boolean;
}
