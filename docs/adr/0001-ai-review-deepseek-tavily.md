# ADR 0001：AI 评审从 Claude 切换到 DeepSeek + Tavily 两段式

- 日期：2026-07-18
- 状态：已接受

## 背景

Phase 2 引入「AI 研究简报」（2026-07-13，初版 Claude + 联网搜索）。次日（2026-07-14）做了两步改造：先把 LLM 从 Claude 切换为 DeepSeek（搜索由 Tavily 承担），随后发现 DeepSeek 的 function-calling 会把原始 tool token 泄漏到输出里，遂弃用 function-calling。从 Claude 切走的具体动机未留下记录（待确认）。

## 决策

AI 初评采用 **DeepSeek（LLM）+ Tavily（联网搜索）** 的两段式 search-then-synthesize：第一段用 Tavily 搜索证据，第二段把证据交给 DeepSeek 综合成简报，不使用任何 function-calling。实现位于 `src/app/api/ai-review/route.ts`，仅服务端调用，密钥为 `DEEPSEEK_API_KEY` / `TAVILY_API_KEY`（无 `NEXT_PUBLIC_` 前缀）。

AI 只输出证据整理（【C1..C5】/ 红线扫描 / 反向检查草稿 / 证伪建议 / 来源），提示词与展示层都**禁止分数**；五条打分与反向检查只能人工。

## 理由与后果

- 弃用 function-calling 的直接原因：DeepSeek 会把原始 tool token 泄漏进正文，污染交付给用户的研究简报。
- search-then-synthesize 两段式把「搜证据」和「写综合」解耦，搜索与 LLM 可独立替换。
- 降级行为：缺 `DEEPSEEK_API_KEY` 时点「生成 AI 初评」明确报错；缺 `TAVILY_API_KEY` 仍能生成但无法联网核实（正文注明），不影响其他功能。
- 后果：AI 能力依赖两家外部服务的可用性与额度（Tavily 免费档约每月 1000 次搜索）；「AI 不打分」这条铁律后续任何改动都不得突破。
