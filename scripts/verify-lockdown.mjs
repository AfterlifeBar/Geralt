import { createAnonClient } from "./_env.mjs";

// Run AFTER migration 0002. Asserts the anon (publishable) key can no longer
// touch the DB: INSERT must be rejected, SELECT must come back empty even
// though data exists. The service-role path is verified by the live app
// still rendering — the secret never needs to enter this container.

const { client: sb } = createAnonClient();
let pass = 0,
  fail = 0;
const ok = (m) => (console.log("  PASS", m), pass++);
const no = (m) => (console.log("  FAIL", m), fail++);

// 1) anon INSERT must be rejected by RLS (42501)
{
  const { error } = await sb.from("stocks").insert({ code: "LOCKDOWN", name: "应被拒绝" });
  error ? ok(`anon 写入被拒 (${error.code ?? error.message})`) : no("anon 仍可写入 — 0002 未生效!");
}

// 2) anon SELECT must return zero rows (default deny)
{
  const { data, error } = await sb.from("stocks").select("code").limit(5);
  if (error) ok(`anon 读取被拒 (${error.code})`);
  else if ((data ?? []).length === 0) ok("anon 读取返回空(默认拒绝生效)");
  else no(`anon 仍能读到 ${data.length} 行 — 0002 未生效!`);
}

console.log(`\n${fail === 0 ? "✅ 锁定生效" : "❌ 未锁定"} — PASS ${pass} / FAIL ${fail}`);
process.exit(fail === 0 ? 0 : 1);
