import { createClient } from "@/lib/supabase/server";
import { buildTimeline, toWatchlistEntry } from "@/lib/assemble";
import type {
  EvaluationRow,
  StockRow,
  TimelinePoint,
  WatchlistEntry,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// DATA LAYER — the single seam between the UI and the database.
// Falls back to in-memory mock rows when Supabase env is absent, so the app
// renders end-to-end in local dev before credentials are wired.
// ---------------------------------------------------------------------------

function hasSupabaseEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes("YOUR_PROJECT"));
}

export interface StockDetail {
  stock: StockRow;
  evaluations: EvaluationRow[]; // newest first
  timeline: TimelinePoint[]; // oldest → newest
}

export async function getWatchlist(): Promise<WatchlistEntry[]> {
  if (!hasSupabaseEnv()) {
    return MOCK_STOCKS.map((s) =>
      toWatchlistEntry(s, evalsFor(s.code)),
    ).filter((e): e is WatchlistEntry => e !== null);
  }

  const supabase = createClient();
  const [{ data: stocks }, { data: evals }] = await Promise.all([
    supabase.from("stocks").select("*"),
    supabase
      .from("evaluations")
      .select("*")
      .order("eval_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const byStock = groupByStock((evals ?? []) as EvaluationRow[]);
  return ((stocks ?? []) as StockRow[])
    .map((s) => toWatchlistEntry(s, byStock.get(s.code) ?? []))
    .filter((e): e is WatchlistEntry => e !== null)
    .sort((a, b) => b.lastEval.localeCompare(a.lastEval));
}

export async function getStockDetail(code: string): Promise<StockDetail | null> {
  if (!hasSupabaseEnv()) {
    const stock = MOCK_STOCKS.find((s) => s.code === code);
    if (!stock) return null;
    const evaluations = evalsFor(code);
    return { stock, evaluations, timeline: buildTimeline(evaluations) };
  }

  const supabase = createClient();
  const { data: stock } = await supabase
    .from("stocks")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (!stock) return null;

  const { data: evals } = await supabase
    .from("evaluations")
    .select("*")
    .eq("stock_code", code)
    .order("eval_date", { ascending: false })
    .order("created_at", { ascending: false });

  const evaluations = (evals ?? []) as EvaluationRow[];
  return {
    stock: stock as StockRow,
    evaluations,
    timeline: buildTimeline(evaluations),
  };
}

function groupByStock(rows: EvaluationRow[]): Map<string, EvaluationRow[]> {
  const m = new Map<string, EvaluationRow[]>();
  for (const r of rows) {
    const arr = m.get(r.stock_code) ?? [];
    arr.push(r);
    m.set(r.stock_code, arr);
  }
  return m; // already newest-first from the query ordering
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
  return {
    ...merged,
    total_score:
      merged.cond_floor +
      merged.cond_valuation +
      merged.cond_catalyst +
      merged.cond_beta +
      merged.cond_headroom,
  } as EvaluationRow;
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
