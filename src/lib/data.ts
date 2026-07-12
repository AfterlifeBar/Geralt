import { createServerSupabase } from "@/lib/supabase/admin";
import { buildTimeline, toWatchlistEntry } from "@/lib/assemble";
import { totalScore } from "@/lib/scoring";
import type {
  EvaluationRow,
  StockRow,
  TimelinePoint,
  WatchlistEntry,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// DATA LAYER — the single seam between the UI and the database.
// In development, falls back to in-memory mock rows when Supabase env is
// absent so the app renders before credentials are wired. In production a
// missing env is a deploy error and fails loudly instead of serving mock data.
// ---------------------------------------------------------------------------

function hasSupabaseEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes("YOUR_PROJECT"));
}

function assertEnvOrDev(): boolean {
  if (hasSupabaseEnv()) return true;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Supabase env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) is missing in production — refusing to serve mock data.",
    );
  }
  return false;
}

// Columns the watchlist actually needs — excludes the unbounded text columns
// (veto_reason, devils_advocate, falsification, notes).
const WATCHLIST_EVAL_COLUMNS =
  "eval_date, cond_floor, cond_valuation, cond_catalyst, cond_beta, cond_headroom, total_score, c1_gated, status, created_at";

export interface StockDetail {
  stock: StockRow;
  evaluations: EvaluationRow[]; // newest first
  timeline: TimelinePoint[]; // oldest → newest
}

export async function getWatchlist(): Promise<WatchlistEntry[]> {
  if (!assertEnvOrDev()) {
    return MOCK_STOCKS.map((s) =>
      toWatchlistEntry(s, evalsFor(s.code)),
    ).filter((e): e is WatchlistEntry => e !== null);
  }

  const supabase = createServerSupabase();
  // Latest 2 evaluations per stock via an embedded, per-parent-row limit —
  // the watchlist only ever reads evals[0] (latest) and evals[1] (drift).
  const { data, error } = await supabase
    .from("stocks")
    .select(`code, name, evaluations(${WATCHLIST_EVAL_COLUMNS})`)
    .order("eval_date", { referencedTable: "evaluations", ascending: false })
    .order("created_at", { referencedTable: "evaluations", ascending: false })
    .limit(2, { referencedTable: "evaluations" });
  if (error) throw new Error(`加载观察池失败: ${error.message}`);

  type Row = StockRow & { evaluations: EvaluationRow[] };
  return ((data ?? []) as Row[])
    .map((row) =>
      toWatchlistEntry({ code: row.code, name: row.name }, row.evaluations ?? []),
    )
    .filter((e): e is WatchlistEntry => e !== null)
    .sort((a, b) => b.lastEvalDate.localeCompare(a.lastEvalDate));
}

export async function getStockDetail(code: string): Promise<StockDetail | null> {
  if (!assertEnvOrDev()) {
    const stock = MOCK_STOCKS.find((s) => s.code === code);
    if (!stock) return null;
    const evaluations = evalsFor(code);
    return { stock, evaluations, timeline: buildTimeline(evaluations) };
  }

  const supabase = createServerSupabase();
  const [stockRes, evalsRes] = await Promise.all([
    supabase.from("stocks").select("*").eq("code", code).maybeSingle(),
    supabase
      .from("evaluations")
      .select("*")
      .eq("stock_code", code)
      .order("eval_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  if (stockRes.error) throw new Error(`加载标的失败: ${stockRes.error.message}`);
  if (evalsRes.error) throw new Error(`加载评估失败: ${evalsRes.error.message}`);
  if (!stockRes.data) return null;

  const evaluations = (evalsRes.data ?? []) as EvaluationRow[];
  return {
    stock: stockRes.data as StockRow,
    evaluations,
    timeline: buildTimeline(evaluations),
  };
}

// --- dev mock (no DB) -------------------------------------------------------

const MOCK_STOCKS: StockRow[] = [
  { code: "688777", name: "中控技术" },
  { code: "300058", name: "蓝色光标" },
  { code: "688507", name: "索辰科技" },
  { code: "600246", name: "万通发展" },
];

function ev(row: Partial<EvaluationRow> & { id: string; stock_code: string; eval_date: string }): EvaluationRow {
  const base = {
    cond_floor: 2,
    cond_valuation: 1,
    cond_catalyst: 1,
    cond_beta: 1,
    cond_headroom: 1,
    c1_gated: false,
    veto_reason: null,
    devils_advocate: null,
    falsification: null,
    status: "candidate" as const,
    notes: null,
  };
  const merged = { ...base, ...row };
  return { ...merged, total_score: totalScore(merged) } as EvaluationRow;
}

const MOCK_EVALS: EvaluationRow[] = [
  ev({ id: "a3", stock_code: "688777", eval_date: "2026-06-02", cond_floor: 2, cond_valuation: 2, cond_catalyst: 2, cond_beta: 1, cond_headroom: 1, status: "tracking" }),
  ev({ id: "a2", stock_code: "688777", eval_date: "2026-05-10", cond_floor: 2, cond_valuation: 1, cond_catalyst: 2, cond_beta: 1, cond_headroom: 1, status: "tracking" }),
  ev({ id: "a1", stock_code: "688777", eval_date: "2026-04-12", cond_floor: 1, cond_valuation: 1, cond_catalyst: 1, cond_beta: 1, cond_headroom: 1, status: "candidate" }),

  ev({ id: "b3", stock_code: "300058", eval_date: "2026-05-18", cond_floor: 2, cond_valuation: 2, cond_catalyst: 1, cond_beta: 1, cond_headroom: 0, status: "holding", devils_advocate: "若 AI 营销叙事兑现不及预期,主业广告代理现金流是否仍能覆盖费用?", falsification: "连续两个季度新业务收入占比不增,或经营性现金流转负,则退出。" }),
  ev({ id: "b2", stock_code: "300058", eval_date: "2026-03-20", cond_floor: 2, cond_valuation: 2, cond_catalyst: 2, cond_beta: 2, cond_headroom: 1, status: "holding", devils_advocate: "叙事过热,警惕板块 β 透支。", falsification: "板块单月回撤超 20% 且无业绩支撑则减仓。" }),
  ev({ id: "b1", stock_code: "300058", eval_date: "2026-02-08", cond_floor: 2, cond_valuation: 1, cond_catalyst: 2, cond_beta: 1, cond_headroom: 1, status: "candidate" }),

  ev({ id: "c1", stock_code: "688507", eval_date: "2026-05-30", cond_floor: 2, cond_valuation: 1, cond_catalyst: 2, cond_beta: 1, cond_headroom: 1, status: "candidate" }),

  ev({ id: "d2", stock_code: "600246", eval_date: "2026-05-12", cond_floor: 0, cond_valuation: 1, cond_catalyst: 1, cond_beta: 1, cond_headroom: 0, c1_gated: true, veto_reason: "实控人涉嫌信披违规被立案调查;控股股东高比例质押。", status: "candidate" }),
  ev({ id: "d1", stock_code: "600246", eval_date: "2026-04-01", cond_floor: 1, cond_valuation: 1, cond_catalyst: 1, cond_beta: 1, cond_headroom: 0, status: "candidate" }),
];

function evalsFor(code: string): EvaluationRow[] {
  return MOCK_EVALS.filter((e) => e.stock_code === code).sort((a, b) =>
    b.eval_date.localeCompare(a.eval_date),
  );
}
