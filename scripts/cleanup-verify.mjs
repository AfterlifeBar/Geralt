import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const code = process.argv[2] ?? "VERIFY1";
const { error } = await sb.from("stocks").delete().eq("code", code);
console.log(error ? "FAIL: " + error.message : `已删除测试标的 ${code}(级联删评估)`);
process.exit(error ? 1 : 0);
