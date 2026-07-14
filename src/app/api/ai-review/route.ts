import "server-only";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/admin";
import { CONDITIONS } from "@/lib/scoring";
import type { EvaluationRow } from "@/lib/types";

export const dynamic = "force-dynamic";
// 联网搜索 + 一次整理,通常 30–90 秒 (需 Vercel Fluid Compute; 计划不支持时降到 60)
export const maxDuration = 300;

const MODEL = "deepseek-chat";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

// 铁律: AI 只整理证据,绝不打分、绝不给买卖建议。分数只能人工录入。
const SYSTEM_PROMPT = `你是一位 A 股投研助理,为一个人工评分的投研框架整理参考材料。

该框架有五条打分维度(由人工打 0/1/2 分,你绝不参与打分):
${CONDITIONS.map((c) => `C${c.n} ${c.label} — ${c.hint}`).join("\n")}

用户消息里会给你库内数据(行情/历史评估)和一批联网搜索到的资料。请**只依据这些材料**整理一份证据整理,按下面的固定结构输出。

铁律(违反即失职):
1. 绝不输出任何形式的分数、评级或"建议打 X 分"。
2. 绝不给出买入/卖出/持有建议或目标价。
3. 事实与推测分开写;每条关键事实尽量标注来源与日期;材料里没有的就写"未能核实",不要编造。
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

// 固定搜索面,覆盖五条 + 治理红线,保证每次都实际检索到位。
function buildQueries(name: string): { tag: string; q: string }[] {
  return [
    { tag: "C1 现金流/财务", q: `${name} 最新财报 营收 净利润 经营现金流 资产负债` },
    { tag: "C2 估值", q: `${name} 市盈率 市净率 估值 行业对比` },
    { tag: "C3 新业务催化", q: `${name} 新业务 在手订单 项目进展 最新公告 互动易` },
    { tag: "C4 板块 β", q: `${name} 所属板块 概念 近期走势` },
    { tag: "红线扫描", q: `${name} 股权质押比例 实控人 立案调查 司法拍卖 违规 风险` },
    { tag: "C5 机构空间", q: `${name} 机构持仓 北向资金 龙虎榜 股东户数` },
  ];
}

interface Market {
  trade_date: string;
  close: number | null;
  pct_chg: number | null;
  pe: number | null;
  pb: number | null;
  market_cap: number | null;
}

function contextBlock(name: string, code: string, market: Market[], evals: EvaluationRow[]): string {
  const lines: string[] = [`标的: ${name} (${code})`, ""];

  const latest = market[0];
  if (latest) {
    const cap = latest.market_cap ? `${(latest.market_cap / 1e8).toFixed(0)} 亿` : "—";
    lines.push(
      `库内最新行情 (${latest.trade_date}): 收盘 ${latest.close ?? "—"} 元, 涨跌 ${latest.pct_chg ?? "—"}%, PE(动) ${latest.pe ?? "—"}, PB ${latest.pb ?? "—"}, 总市值 ${cap}`,
    );
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

// Tavily 联网搜索 — 返回标题+链接+摘要的纯文本块
async function tavilySearch(query: string): Promise<string | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "advanced",
        max_results: 4,
        include_answer: false,
      }),
    });
    if (!res.ok) return `(搜索失败 HTTP ${res.status})`;
    const data = (await res.json()) as { results?: { title: string; url: string; content: string }[] };
    const results = (data.results ?? [])
      .map((r) => `【${r.title}】${r.url}\n${r.content}`)
      .join("\n\n");
    return results || "(无结果)";
  } catch (e) {
    return `(搜索异常: ${e instanceof Error ? e.message : String(e)})`;
  }
}

export async function POST(req: Request) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "服务端未配置 DEEPSEEK_API_KEY" }, { status: 500 });
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

  const supabase = createServerSupabase();

  // 库内上下文 + 联网搜索并行拉取
  const queries = buildQueries(name);
  const [marketRes, evalsRes, ...searchResults] = await Promise.all([
    supabase
      .from("market_data")
      .select("trade_date, close, pct_chg, pe, pb, market_cap")
      .eq("stock_code", code)
      .order("trade_date", { ascending: false })
      .limit(1),
    supabase
      .from("evaluations")
      .select("*")
      .eq("stock_code", code)
      .order("eval_date", { ascending: false })
      .limit(5),
    ...queries.map((item) => tavilySearch(item.q)),
  ]);

  const tavilyConfigured = searchResults.some((r) => r !== null);
  const searchBlock = tavilyConfigured
    ? queries
        .map((item, i) => `# 搜索 (${item.tag}): ${item.q}\n${searchResults[i] ?? "(无)"}`)
        .join("\n\n")
    : "(未配置 TAVILY_API_KEY,本次无联网资料,请基于库内数据整理,并在正文明确说明未能联网核实。)";

  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: DEEPSEEK_BASE_URL,
  });

  let content = "";
  try {
    const resp = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 8000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `${contextBlock(name, code, (marketRes.data ?? []) as Market[], (evalsRes.data ?? []) as EvaluationRow[])}\n\n===== 联网搜索资料 =====\n${searchBlock}\n\n请据此生成这只股票的初评证据整理。`,
        },
      ],
    });
    content = (resp.choices[0]?.message?.content ?? "").trim();
  } catch (e) {
    const msg = e instanceof OpenAI.APIError ? `${e.status} ${e.message}` : String(e);
    return NextResponse.json({ error: `AI 调用失败: ${msg}` }, { status: 502 });
  }

  if (!content) {
    return NextResponse.json({ error: "AI 未返回内容,请重试" }, { status: 502 });
  }

  const { error: saveErr } = await supabase
    .from("ai_reviews")
    .insert({ stock_code: code, content, model: MODEL });

  return NextResponse.json({
    content,
    model: MODEL,
    searched: tavilyConfigured ? queries.length : 0,
    saved: !saveErr,
    created_at: new Date().toISOString(),
  });
}
