"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CONDITIONS } from "@/lib/scoring";
import type { StockStatus } from "@/lib/types";

export interface FormState {
  error?: string;
}

const STATUSES: StockStatus[] = ["tracking", "holding", "candidate"];

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
  const evalDate = str(formData.get("eval_date")) || undefined;
  const vetoReason = str(formData.get("veto_reason"));
  const devilsAdvocate = str(formData.get("devils_advocate"));
  const falsification = str(formData.get("falsification"));
  const notes = str(formData.get("notes"));

  if (!code) return { error: "请填写股票代码。" };
  if (!name) return { error: "请填写股票名称。" };
  if (!STATUSES.includes(status)) return { error: "请选择状态。" };

  // five scores — all required
  const scores: Record<string, number> = {};
  for (const c of CONDITIONS) {
    const n = parseScore(formData.get(c.key));
    if (n === null) return { error: `「${c.label}」未打分,五条必须全部填写 (0/1/2)。` };
    scores[c.key] = n;
  }

  // C1 gate / governance red line
  if (c1Gated) {
    scores.cond_floor = 0; // gate locks 现金流底 to 0
    if (!vetoReason) return { error: "勾选治理红线后必须填写「治理红线细节」。" };
  }

  // holding gate — 反向检查 + 证伪退出条件 required to save as 建仓
  if (status === "holding") {
    if (!devilsAdvocate)
      return { error: "保存为「建仓」前必须填写「反向检查」。" };
    if (!falsification)
      return { error: "保存为「建仓」前必须填写「证伪退出条件」。" };
  }

  const supabase = createClient();

  const { error: stockErr } = await supabase
    .from("stocks")
    .upsert({ code, name }, { onConflict: "code" });
  if (stockErr) return { error: `保存标的失败: ${stockErr.message}` };

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
