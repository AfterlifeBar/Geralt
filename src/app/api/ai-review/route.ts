import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/admin";
import { CONDITIONS } from "@/lib/scoring";
import type { EvaluationRow } from "@/lib/types";

export const dynamic = "force-dynamic";
// AI 初评带多轮联网搜索,可能跑 1–3 分钟 (需要 Vercel Fluid Compute; 计划不支持时降到 60)
export const maxDuration = 300;

const MODEL = "claude-opus-4-8";

// 铁律: AI 只整理证据,绝不打分、绝不给买卖建议。分数只能人工录入。
const SYSTEM_PROMPT = `你是一位 A 股投研助理,为一个人工评分的投研框架整理参考材料。

该框架有五条打分维度(由人工打 0/1/2 分,你绝不参与打分):
${CONDITIONS.map((c) => `C${c.n} ${c.label} — ${c.hint}`).join("\n")}

你的任务: 针对指定股票,用联网搜索核实最新公开信息(公司公告、财报、新闻、交易所互动平台、行业数据),按下面的固定结构输出一份**证据整理**。

铁律(违反即失职):
1. 绝不输出任何形式的分数、评级或"建议打 X 分"。
2. 绝不给出买入/卖出/持有建议或目标价。
3. 事实与推测分开写;每条关键事实标注来源与日期;搜不到就写"未能核实",不要编造。
4. 语言简体中文,克制、判断留白,把结论空间留给人。

输出结构(纯文本,用【】做节标题,不用 markdown 符号):
【C1 现金流底】主业现金流与资产负债事实;若新故事破灭,主业能否撑住的证据与疑点
【C2 估值便宜档】当前估值指标与历史/同业对比;市场当前按什么逻辑定价
【C3 可证伪节点】新业务/新故事可以用哪些具体指标跟踪;最近的披露时点
【C4 板块 β】所属板块/概念;近期板块表现与市场风格的匹配度
【C5 机构空间】股东结构、机构持仓变化的公开线索
【治理红线扫描】质押比例、实控人风险、立案调查、司法拍卖等公开信息;无则明确写"未发现公开红线信号"
【反向检查草稿】如果看多故事是错的,最可能错在哪里(2–3 条,供人工反向检查参考)
【证伪条件建议】具体指标/阈值/时点形式的退出信号建议(2–3 条)
【信息来源】本次引用的主要来源列表(标题 + 日期)`;

function contextBlock(
  name: string,
  code: string,
  market: { trade_date: string; close: number | null; pct_chg: number | null; pe: number | null; pb: number | null; market_cap: number | null }[],
  evals: EvaluationRow[],
): string {
  const lines: string[] = [`标的: ${name} (${code})`, ""];

  const latest = market[0];
  if (latest) {
    const cap = latest.market_cap ? `${(latest.market_cap / 1e8).toFixed(0)} 亿` : "—";
    lines.push(
      `最新行情 (${latest.trade_date}): 收盘 ${latest.close ?? "—"} 元, 涨跌 ${latest.pct_chg ?? "—"}%, PE(动) ${latest.pe ?? "—"}, PB ${latest.pb ?? "—"}, 总市值 ${cap}`,
    );
    const closes = market
      .slice(0, 30)
      .map((m) => m.close)
      .filter((c): c is number => c != null);
    if (closes.length > 5) {
      const chg = (((closes[0] - closes[closes.length - 1]) / closes[closes.length - 1]) * 100).toFixed(1);
      lines.push(`近 ${closes.length} 个交易日涨跌: ${chg}%`);
    }
  } else {
    lines.push("库内暂无行情数据。");
  }

  if (evals.length > 0) {
    lines.push("", "过往人工评估 (仅供了解研究者关注点,不代表当前事实):");
    for (const e of evals.slice(0, 5)) {
      const scores = `${e.cond_floor}·${e.cond_valuation}·${e.cond_catalyst}·${e.cond_beta}·${e.cond_headroom}`;
      lines.push(
        `- ${e.eval_date} 五条 ${scores}${e.c1_gated ? " [治理红线否决]" : ` 总分 ${e.total_score}`}${e.devils_advocate ? ` | 反向检查: ${e.devils_advocate}` : ""}`,
      );
    }
  }

  return lines.join("\n");
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "服务端未配置 ANTHROPIC_API_KEY" },
      { status: 500 },
    );
  }

  let body: { code?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const code = (body.code ?? "").trim();
  const name = (body.name ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "股票代码需为 6 位数字" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "缺少股票名称" }, { status: 400 });
  }

  // 库内上下文: 行情 + 历史评估 (可能都为空 — 新股票也能生成)
  const supabase = createServerSupabase();
  const [marketRes, evalsRes] = await Promise.all([
    supabase
      .from("market_data")
      .select("trade_date, close, pct_chg, pe, pb, market_cap")
      .eq("stock_code", code)
      .order("trade_date", { ascending: false })
      .limit(60),
    supabase
      .from("evaluations")
      .select("*")
      .eq("stock_code", code)
      .order("eval_date", { ascending: false })
      .limit(5),
  ]);

  const anthropic = new Anthropic();
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    tools: [
      {
        type: "web_search_20260209",
        name: "web_search",
        max_uses: 8,
      },
    ],
    messages: [
      {
        role: "user",
        content: `${contextBlock(name, code, marketRes.data ?? [], (evalsRes.data ?? []) as EvaluationRow[])}\n\n请生成这只股票的初评证据整理。`,
      },
    ],
  });

  let message: Anthropic.Message;
  try {
    message = await stream.finalMessage();
  } catch (e) {
    const msg = e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e);
    return NextResponse.json({ error: `AI 调用失败: ${msg}` }, { status: 502 });
  }

  if (message.stop_reason === "refusal") {
    return NextResponse.json({ error: "AI 拒绝了本次请求,请稍后重试" }, { status: 502 });
  }

  const content = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!content) {
    return NextResponse.json({ error: "AI 未返回内容" }, { status: 502 });
  }

  // 存档 (失败不阻塞返回 — 初评本体已生成)
  const { error: saveErr } = await supabase
    .from("ai_reviews")
    .insert({ stock_code: code, content, model: MODEL });

  return NextResponse.json({
    content,
    model: MODEL,
    saved: !saveErr,
    created_at: new Date().toISOString(),
  });
}
