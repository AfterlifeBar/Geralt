import { createAnonClient } from "./_env.mjs";

const { env, client: sb } = createAnonClient();
console.log("URL:", env.NEXT_PUBLIC_SUPABASE_URL);
console.log(
  "KEY prefix:",
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(0, 16) + "…",
  "(publishable/anon path)\n",
);

let pass = 0,
  fail = 0;
const ok = (m) => (console.log("  PASS", m), pass++);
const no = (m) => (console.log("  FAIL", m), fail++);

// 1) anon can write a stock (RLS policy)
{
  const { error } = await sb.from("stocks").upsert({ code: "VERIFY1", name: "连库验证" }, { onConflict: "code" });
  error ? no("anon 写 stocks: " + error.message) : ok("anon 写入 stocks");
}

// 2) anon can write a valid evaluation; total_score generated = 7
{
  const { data, error } = await sb
    .from("evaluations")
    .insert({ stock_code: "VERIFY1", eval_date: "2026-06-24", cond_floor: 2, cond_valuation: 2, cond_catalyst: 1, cond_beta: 1, cond_headroom: 1, status: "candidate" })
    .select("total_score")
    .single();
  if (error) no("anon 写 evaluations: " + error.message);
  else if (data.total_score === 7) ok("anon 写入评估 + total_score 生成列 = 7");
  else no("total_score = " + data.total_score + " (期望 7)");
}

// 3) CHECK: c1_gated=true 但 cond_floor<>0 应被拒
{
  const { error } = await sb
    .from("evaluations")
    .insert({ stock_code: "VERIFY1", cond_floor: 2, cond_valuation: 1, cond_catalyst: 1, cond_beta: 1, cond_headroom: 1, c1_gated: true, veto_reason: "测试" });
  error ? ok("C1 闸门拦住 cond_floor<>0 (" + error.code + ")") : no("C1 闸门未拦住违规写入");
}

// 4) CHECK: holding 缺反向检查应被拒
{
  const { error } = await sb
    .from("evaluations")
    .insert({ stock_code: "VERIFY1", cond_floor: 2, cond_valuation: 1, cond_catalyst: 1, cond_beta: 1, cond_headroom: 1, status: "holding" });
  error ? ok("建仓闸门拦住缺反向检查 (" + error.code + ")") : no("建仓闸门未拦住违规写入");
}

// 5) read back via anon
{
  const { data, error } = await sb.from("evaluations").select("stock_code,total_score,status").eq("stock_code", "VERIFY1");
  if (error) no("anon 读回: " + error.message);
  else ok(`anon 读回 ${data.length} 条评估`);
}

console.log(`\n${fail === 0 ? "✅ 全部通过" : "❌ 有失败"} — PASS ${pass} / FAIL ${fail}`);
process.exit(fail === 0 ? 0 : 1);
