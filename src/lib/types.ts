// View-model types for the UI layer. These mirror the shape the reference
// `WatchlistHome.jsx` renders against, so the layout maps 1:1 to data. The
// mapping from DB rows (stocks + evaluations) onto these is finalized once the
// schema SQL lands; the components below only ever see these view models.

export type StockStatus = "tracking" | "holding" | "candidate";

// signal-light states
export type Signal = "ok" | "warn" | "orange" | "red";

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
  trend?: "down" | "up";
  drift?: QuadrantPosition; // previous evaluation's position (dashed trajectory)
  veto?: boolean;
}
