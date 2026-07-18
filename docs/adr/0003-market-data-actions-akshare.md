# ADR 0003：行情采集用 GitHub Actions 定时任务 + AkShare

- 日期：2026-07-18
- 状态：已接受

## 背景

Phase 2 需要每日行情数据（`market_data` 表）。需求特点：每日一次、收盘后跑、写入 Supabase 即可，无实时性要求。

## 决策

用 **GitHub Actions 定时任务** 驱动 **Python + AkShare** 采集（`scripts/fetch_market_data.py`，workflow：`.github/workflows/market-data.yml`）：

- cron `15 8 * * 1-5`：工作日 16:15 北京时间（A 股收盘后）自动运行。
- 支持 `workflow_dispatch` 手动触发，`backfill_days` 参数回填最近 N 天日线（新标的入池后跑一次）。
- Python 3.12，依赖 `requirements.txt`（akshare、requests），pip 缓存以该文件为 key。
- 脚本以 service-role 密钥经 REST upsert 进 `market_data`（secrets：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`）。

## 理由与后果

- 每日批处理任务与 Web 应用生命周期无关，放 GitHub Actions 比占用 Vercel 资源（或自建常驻进程）更简单、零额外成本；AkShare 免 token、覆盖 A 股，足够本场景使用。
- 后果一：采集依赖 GitHub Actions 免费额度与 AkShare 上游接口的稳定性；AkShare 接口变动会导致当日抓取失败，需关注 workflow 失败通知。
- 后果二：GitHub 定时任务在仓库长期无活动时可能被自动暂停，且 schedule 不保证准点；对「收盘后某日有数据」的精度要求下可接受。
- 后果三：脚本持有 service-role 密钥（仓库 secrets），与 ADR 0002 的密钥纪律同等对待。
