import { createAnonClient } from "./_env.mjs";

const { client: sb } = createAnonClient();
const code = process.argv[2] ?? "VERIFY1";
const { error } = await sb.from("stocks").delete().eq("code", code);
console.log(error ? "FAIL: " + error.message : `已删除测试标的 ${code}(级联删评估)`);
process.exit(error ? 1 : 0);
