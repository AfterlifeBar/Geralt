"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/admin";
import { CONDITIONS } from "@/lib/scoring";
import { shanghaiToday } from "@/lib/dates";
import type { StockStatus } from "@/lib/types";

export interface FormState {
  error?: string;
}

const STATUSES: StockStatus[] = ["tracking", "holding", "candidate"];
const EVAL_DATE_MIN = "1990-01-01";

function parseScore(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 2 ? n : null;
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function createEvaluation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const code = str(formData.get("code"));
  const name = str(formData.get("name"));
  const status = str(formData.get("status")) as StockStatus;
  const c1Gated = formData.get("c1_gated") === "on";
  const evalDate = str(formData.get("eval_date"));
  const vetoReason = str(formData.get("veto_reason"));
  const devilsAdvocate = str(formData.get("devils_advocate"));
  const falsification = str(formData.get("falsification"));
  const notes = str(formData.get("notes"));

  if (!code) return { error: "请填写股票代码。" };
  if (!name) return { error: "请填写股票名称。" };
  if (!STATUSES.includes(status)) return { error: "请选择状态。" };

  // eval_date: required, real date, not in the future (market timezone), sane floor
  if (!/^\d{4}-\d{2}-\d{2}$/.test(evalDate) || Number.isNaN(Date.parse(evalDate))) {
    return { error: "评估日期格式不正确。" };
  }
  const today = shanghaiToday();
  if (evalDate > today) return { error: `评估日期不能晚于今天 (${today})。` };
  if (evalDate < EVAL_DATE_MIN) return { error: "评估日期过早,请检查年份。" };

  // five scores — all required. The C1 gate forces cond_floor to 0 BEFORE
  // validation, so a gated submission never depends on the form sending it.
  const scores: Record<string, number> = {};
  for (const c of CONDITIONS) {
    if (c.key === "cond_floor" && c1Gated) {
      scores.cond_floor = 0;
      continue;
    }
    const n = parseScore(formData.get(c.key));
    if (n === null) return { error: `「${c.label}」未打分,五条必须全部填写 (0/1/2)。` };
    scores[c.key] = n;
  }

  // governance red line requires the reason
  if (c1Gated && !vetoReason) {
    return { error: "勾选治理红线后必须填写「治理红线细节」。" };
  }

  // holding gate — 反向检查 + 证伪退出条件 required to save as 建仓
  if (status === "holding") {
    if (!devilsAdvocate)
      return { error: "保存为「建仓」前必须填写「反向检查」。" };
    if (!falsification)
      return { error: "保存为「建仓」前必须填写「证伪退出条件」。" };
  }

  const supabase = createServerSupabase();

  // Create the stock if new; never overwrite an existing stock's name from
  // this form (a typo here must not rename the stock across all views).
  const { data: existing, error: lookupErr } = await supabase
    .from("stocks")
    .select("code")
    .eq("code", code)
    .maybeSingle();
  if (lookupErr) return { error: `查询标的失败: ${lookupErr.message}` };
  if (!existing) {
    const { error: insertErr } = await supabase.from("stocks").insert({ code, name });
    if (insertErr) return { error: `保存标的失败: ${insertErr.message}` };
  }

  const { error: evalErr } = await supabase.from("evaluations").insert({
    stock_code: code,
    eval_date: evalDate,
    cond_floor: scores.cond_floor,
    cond_valuation: scores.cond_valuation,
    cond_catalyst: scores.cond_catalyst,
    cond_beta: scores.cond_beta,
    cond_headroom: scores.cond_headroom,
    c1_gated: c1Gated,
    veto_reason: c1Gated ? vetoReason : null,
    devils_advocate: devilsAdvocate || null,
    falsification: falsification || null,
    status,
    notes: notes || null,
  });
  if (evalErr) return { error: `保存评估失败: ${evalErr.message}` };

  revalidatePath("/");
  revalidatePath(`/stocks/${code}`);
  redirect(`/stocks/${code}`);
}
