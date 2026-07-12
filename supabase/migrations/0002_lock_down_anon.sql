-- ===========================================================================
-- 安全加固 · 方案 A: 撤销 anon 直连读写
--
-- ⚠️ 运行前提(零停机顺序):
--   应用必须已部署为使用 SUPABASE_SERVICE_ROLE_KEY(Vercel 服务端 env,
--   无 NEXT_PUBLIC_ 前缀)。service_role 天然绕过 RLS,不受本迁移影响。
--
-- 效果: RLS 保持开启,删除策略后 anon / authenticated 默认全拒绝 ——
--   持有 publishable/anon 公钥的任何人对两表零写入、零读取(SELECT 返回空)。
-- ===========================================================================

drop policy if exists stocks_anon_all on stocks;
drop policy if exists evaluations_anon_all on evaluations;
