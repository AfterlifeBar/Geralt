# PROGRESS.md — 进展日志

**纪律**：每个工作 session 结束前追加一条，**最新在最上**。格式：

```
## YYYY-MM-DD · 一句话标题
- 做了什么（对应分支 / PR / commit）
- 状态与待办（如有）
```

---

## 2026-07-18 · 补充项目交接文档
- 清理已合并的废弃分支 `claude/ecstatic-gates-1grx1o`。
- 重写 README（原仅一行），新增 AGENTS.md、PROGRESS.md、docs/adr/ 下 3 个 ADR（分支 `docs/handover-docs`，走 PR）。
- 起因：经办 AI 账号被封，意识到项目状态必须完整保存在仓库内，不依赖任何特定经办者的会话。

## 2026-07-14 · 打磨期：AI 供应商切换、workflow 修复
- AI 评审从 Claude 切换到 DeepSeek + Tavily 联网搜索（`e4c2b24`）；同日发现 DeepSeek function-calling 会泄漏原始 tool token，弃用 function-calling，改为两段式 search-then-synthesize（`68ffb62`）。见 ADR 0001。
- 修 market-data workflow：补 `requirements.txt` 让 pip 缓存生效（`e3d6e31`）。

## 2026-07-13 · Phase 2：AI 研究简报 + AkShare 行情
- AI 研究简报（初版 Claude + 联网搜索）与 AkShare 每日行情入库（`10610b3`）。
- 行情抓取由 GitHub Actions 工作日 16:15（北京时间）定时运行。见 ADR 0003。
- 迁移 0003：`market_data` + `ai_reviews` 表，仅 service_role 可达。
- 清理：忽略 Python bytecode 缓存（`4c447a5`）。

## 2026-07-12 · 安全加固与 stage-1 合并
- 安全加固：服务端 service-role client、keepalive cron、anon 锁定迁移 0002（`407cc85`）。见 ADR 0002。
- 合并 stage-1：watchlist + 漂移时间线 + 带门槛评估表单（`39f509f`），随后触发首次 git 生产部署（`c287914`）。

## 2026-06-25 ~ 07-05 · 部署清单与评审修复
- 新增 DEPLOY.md 生产部署清单（`12baad3`）。
- 修复评审发现的 12 个问题：C1 门槛提交、数据完整性、象限一致性（`309c40d`）。

## 2026-06-09 ~ 06-24 · Stage 1：RUQ 评分主流程
- 脚手架：Next.js + Supabase 应用骨架与 watchlist 首页（`b423cc9`）。
- RUQ 评分：数据库 schema、个股详情漂移时间线、评估表单（`5083beb`）。
- anon 路径 DB 验证脚本（`cdbe455`）；验证线上 Supabase 连接（`ed703c0`）。

## 2026-06-01 · 项目创建
- Initial commit（`8ae2a39`）。
