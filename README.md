# Geralt

A 股「观察池」评估工具。按 **RUQ 打分框架**人工录入标的评估（5 个条件各 0/1/2 分、C1 门槛、四象限定位），辅以 AI 研究简报与每日行情数据。线上地址：<https://geralt-six.vercel.app>

## 功能

- **观察池（watchlist）**：首页列出在池标的及其最新评分状态。
- **评估表单**：新建评估走强制表单，5 条条件逐条人工打分；C1（现金流底）为门槛条件，打 0 即一票否决到左侧象限。
- **漂移时间线**：个股详情页（`/stocks/[code]`）展示评分随时间的漂移。
- **AI 研究简报**：DeepSeek + Tavily 联网搜索的两段式（search-then-synthesize）初评，只输出证据整理，不打分；打分永远只能人工。
- **每日行情**：Python + AkShare 抓取，GitHub Actions 工作日 16:15（北京时间，收盘后）定时入库。

## 技术栈

- **Web**：Next.js 14（App Router）+ React 18 + TypeScript + Tailwind CSS，部署在 Vercel
- **数据库**：Supabase（Postgres + RLS），迁移见 `supabase/migrations/`（0001 初始化、0002 anon 锁定、0003 phase2）；服务端统一走 `src/lib/supabase/admin.ts` 的 service-role client
- **行情管道**：Python + AkShare（`scripts/fetch_market_data.py`），GitHub Actions 定时触发
- **AI**：DeepSeek（LLM）+ Tavily（联网搜索），仅服务端调用

## 本地开发

```bash
npm install
cp .env.local.example .env.local   # 填入真实值
npm run dev                        # http://localhost:3000
```

环境变量（见 `.env.local.example` 内注释）：

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`：Supabase 项目 Settings → API
- `SUPABASE_SERVICE_ROLE_KEY`：服务端全权限密钥，迁移 0002 锁定 anon 后**必需**；绝不加 `NEXT_PUBLIC_` 前缀、绝不提交
- `DEEPSEEK_API_KEY` / `TAVILY_API_KEY`：AI 初评，仅服务端

其他命令：`npm run build`（构建）、`npm run lint`（ESLint）。

注意：`src/lib/data.ts` 在 env 缺失或 URL 仍为占位值时会回退到内存 mock 数据——看到占位股票说明 env 没配对。

### 行情脚本（可选）

```bash
pip install -r requirements.txt
export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
python scripts/fetch_market_data.py                # 当日快照
python scripts/fetch_market_data.py --backfill 90  # 回填最近 N 天日线
```

### 数据库验证脚本

`scripts/` 下还有 `verify-db.mjs`（anon 增改查验证）、`verify-lockdown.mjs`（anon 锁定验证）、`cleanup-verify.mjs`，均读取 `.env.local`，用 `node scripts/<脚本名>` 运行。

## 部署

生产部署的完整清单（Vercel 导入、环境变量、安全加固、二期启用）见 **[DEPLOY.md](DEPLOY.md)**，按顺序照做即可。

## 文档索引

- [AGENTS.md](AGENTS.md)：交接说明——项目全貌、架构、开发约定、当前状态与已知缺口
- [PROGRESS.md](PROGRESS.md)：进展日志（每个工作 session 结束前追加，最新在上）
- [docs/adr/](docs/adr/)：架构决策记录
- [DEPLOY.md](DEPLOY.md)：生产部署清单
