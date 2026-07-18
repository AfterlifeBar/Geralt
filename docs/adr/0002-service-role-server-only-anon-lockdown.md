# ADR 0002：service-role 仅限服务端 + anon 锁定迁移

- 日期：2026-07-18
- 状态：已接受

## 背景

迁移 0001 对数据表设了 `for all to anon using(true) with check(true)`——RLS 虽开着，anon 公钥却拥有完整增删改查。仓库自带脚本（`scripts/verify-db.mjs`、`scripts/cleanup-verify.mjs`）实证：仅凭 anon 公钥即可直接读写甚至清空生产库，完全绕过 Vercel 站点。Vercel Authentication 之类的「前端锁」挡不住 Supabase 的公网 REST 端点，安全必须在数据库层修。

## 决策

1. 服务端统一经 `src/lib/supabase/admin.ts`（顶部 `import "server-only"` 守卫）访问数据库：优先使用 `SUPABASE_SERVICE_ROLE_KEY`（bypasses RLS），缺失时回退 anon 公钥，保证切换期零停机。
2. 执行迁移 `supabase/migrations/0002_lock_down_anon.sql`：删除 anon 策略，RLS 保持开启 = 默认拒绝，anon 读写归零。
3. `SUPABASE_SERVICE_ROLE_KEY` 绝不加 `NEXT_PUBLIC_` 前缀、绝不提交、仅在服务端代码引用、绝不打印。
4. 锁定后用 `node scripts/verify-lockdown.mjs` 验证 anon 零读写、站点照常工作。

## 理由与后果

- 单用户个人工具无需引入完整的 Supabase Auth（多用户方案见 DEPLOY.md 第 5 节方案 B），service-role + anon 锁定是满足需求的最简单、最安全形态。
- 后果一：service-role 密钥成为单点高权限凭据，一旦泄漏即全库失守——密钥纪律必须严格执行，泄漏后需在 Supabase 轮换。
- 后果二：浏览器端不得出现任何直连 DB 的代码；未来如需客户端直连 Supabase，必须先引入 Auth 与按用户授权的 RLS 策略（方案 B），不能回退 anon 策略。
- 后果三：`NEXT_PUBLIC_SUPABASE_ANON_KEY` 锁定后仅作过渡期回退，可考虑轮换作废开放期可能被抓取的旧钥（见 DEPLOY.md 二期加固）。
