"use client";

import { useState } from "react";

// AI 初评面板 — 生成"证据整理"参考材料。
// 铁律: AI 不打分、不给建议;五条打分永远人工。

export function AiReviewPanel({ code, name }: { code: string; name: string }) {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const ready = /^\d{6}$/.test(code.trim()) && name.trim().length > 0;

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setContent(data.content);
      setCollapsed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white px-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">AI 初评</span>
          <span className="ml-2 text-xs text-stone-400">
            联网整理证据供参考 — 不打分,判断永远由你做
          </span>
        </div>
        <div className="flex items-center gap-2">
          {content && (
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
            >
              {collapsed ? "展开" : "收起"}
            </button>
          )}
          <button
            type="button"
            onClick={generate}
            disabled={!ready || loading}
            className="rounded border border-stone-300 px-2.5 py-1 text-sm text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "生成中…" : content ? "重新生成" : "生成 AI 初评"}
          </button>
        </div>
      </div>

      {!ready && !content && (
        <p className="mt-2 text-xs text-stone-400">先填写 6 位股票代码和名称。</p>
      )}
      {loading && (
        <p className="mt-2 text-xs text-stone-400">
          正在联网搜索公告/新闻并整理,通常需要 1–3 分钟,请勿关闭页面…
        </p>
      )}
      {error && (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {content && !collapsed && (
        <div className="mt-3 max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded border border-stone-100 bg-stone-50 px-4 py-3 text-sm leading-relaxed text-stone-700">
          {content}
        </div>
      )}
    </div>
  );
}
