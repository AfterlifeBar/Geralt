# AGENTS.md — 项目交接说明

写给任何接手者（人或 AI agent，不假定特定工具）。目标：只看本仓库即可接手，不依赖任何外部会话记录。

## 项目是什么

Geralt 是一个 A 股「观察池」评估工具：对观察池内的标的按 **RUQ 打分框架**做人工评估——5 个条件（现金流底 / 估值便宜档 / 可证伪节点 / 板块 β / 机构空间）各打 0/1/2 分，C1（现金流底）为门槛条件，打 0 即一票否决；按得分把标的定位到四象限。评分只做确定性簿记（求和、C1 门槛、象限归属），一切判断由人录入，AI 只输出证据整理、**禁止打分**。线上：<https://geralt-six.vercel.app>

评分框架的唯一权威实现：`src/lib/scoring.ts`。改规则先改这里，表单与象限图都从这里派生。

## 架构

- **Next.js 14（App Router）+ React 18 + TypeScript + Tailwind**，部署在 Vercel。读走 Server Components（`src/lib/data.ts`），写走 Server Action（`src/app/evaluations/new/actions.ts`），浏览器端无任何直连 DB 的代码。
- **Supabase**（Postgres + RLS）。迁移按序执行：`supabase/migrations/0001_init.sql` → `0002_lock_down_anon.sql` → `0003_phase2.sql`。服务端统一经 `src/lib/supabase/admin.ts`（含 `import "server-only"` 守卫）：优先 service_role，缺失时回退 anon（切换期零停机用；锁定 anon 后 service_role 为必需）。
- **Python 行情管道**：`scripts/fetch_market_data.py` 用 AkShare 抓行情、经 REST upsert 进 `market_data` 表；由 `.github/workflows/market-data.yml` 在工作日 16:15（北京时间）定时触发，支持手动 `workflow_dispatch` 回填。
- **AI 初评**：`src/app/api/ai-review/route.ts`，DeepSeek + Tavily 两段式 search-then-synthesize（先联网搜证据、再综合成简报）。
- **保活**：`vercel.json` 配置每日 Cron 打 `/api/keepalive`，防 Supabase 免费版暂停。

## 如何本地跑与验证

1. `npm install`，`cp .env.local.example .env.local` 并填值（变量说明见 README 与该文件内注释）。
2. `npm run dev` 起开发服务；`npm run build` 与 `npm run lint` 是仅有的两道本地检查，提交前都应跑过。
3. env 缺失时首页回退到 mock 数据（占位股票），看到它说明 env 没配对。
4. 行情/AI 依赖迁移 0003；未跑 0003 时对应面板自动降级，不影响一期功能。
5. DB 验证脚本：`node scripts/verify-lockdown.mjs`（anon 应为零读写）等，见 README。

## 开发约定

- `main` 为主线，推送即触发生产部署（Vercel 自动构建）。
- 工作在独立分支进行，**当天工作当天推送**（项目状态不能只留在本地或某个助手的会话里）。
- 走 PR 合并进 main，PR 描述写清动机与验证方式。
- 每个工作 session 结束前，在 `PROGRESS.md` 顶部追加一条日志（格式见该文件）。
- 重要架构决策在 `docs/adr/` 立 ADR（格式：标题 / 日期 / 状态 / 背景 / 决策 / 理由与后果）。
- 数据库结构变更必须落成 `supabase/migrations/` 下的新迁移文件，不直接手改生产库。
- 密钥纪律：service_role 等真实密钥绝不加 `NEXT_PUBLIC_` 前缀、绝不提交；只提交占位的 `.env.local.example`。

## 当前状态与已知缺口（2026-07-18）

- stage-1（watchlist + 漂移时间线 + 带门槛评估表单）、phase 2（AI 研究简报 + AkShare 行情）均已上线；其后进入打磨期（修 workflow pip 缓存依赖、AI 供应商切换、安全加固）。
- **无自动化测试**：目前靠手工验证 + `scripts/` 下的 DB 验证脚本。
- **无 CI 检查**：仓库唯一的 workflow 是行情抓取，PR 没有构建/lint 卡点，合并前需本地自行跑 `npm run build && npm run lint`。
- README 与交接文档（本文件、PROGRESS.md、ADR）为 2026-07-18 补写，此前文档只有 DEPLOY.md。
