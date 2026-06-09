import type { WatchlistEntry } from "@/lib/types";

// ---------------------------------------------------------------------------
// DATA LAYER (stage 1)
//
// These functions are the single seam between the UI and the database. Right
// now they return the reference sample from WatchlistHome.jsx so the app runs
// and the layout can be verified. Once the schema SQL is in, swap each body for
// a Supabase query (stocks + evaluations) and map rows onto the view models —
// nothing in the components needs to change.
// ---------------------------------------------------------------------------

const SAMPLE: WatchlistEntry[] = [
  { code: "688777", name: "中控技术", status: "tracking", ruq: 8, fund: 8.2, narr: 7.4, quadrant: "右上", signals: ["ok", "ok", "warn"], lastEval: "06-02" },
  { code: "300058", name: "蓝色光标", status: "holding", ruq: 7, fund: 7.5, narr: 4.6, quadrant: "右下", trend: "down", drift: { fund: 7.6, narr: 8.0 }, signals: ["warn", "ok", "orange"], lastEval: "05-18" },
  { code: "688507", name: "索辰科技", status: "candidate", ruq: 6, fund: 6.5, narr: 7.0, quadrant: "右上", signals: ["ok", "warn", "warn"], lastEval: "05-30" },
  { code: "600246", name: "万通发展", status: "candidate", ruq: null, fund: 4.0, narr: 5.5, quadrant: "—", veto: true, signals: ["red"], lastEval: "05-12" },
];

export async function getWatchlist(): Promise<WatchlistEntry[]> {
  return SAMPLE;
}
