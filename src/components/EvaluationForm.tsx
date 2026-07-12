"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createEvaluation, type FormState } from "@/app/evaluations/new/actions";
import { CONDITIONS, SCORE_OPTIONS } from "@/lib/scoring";

const initial: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-stone-800 px-4 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-40"
    >
      {pending ? "保存中…" : "保存评估"}
    </button>
  );
}

export function EvaluationForm({
  defaultCode = "",
  defaultName = "",
  today,
}: {
  defaultCode?: string;
  defaultName?: string;
  today: string;
}) {
  const [state, formAction] = useFormState(createEvaluation, initial);
  const [c1Gated, setC1Gated] = useState(false);
  const [status, setStatus] = useState<"tracking" | "holding" | "candidate">("candidate");

  const isHolding = status === "holding";

  return (
    <form action={formAction} className="space-y-6">
      {/* identity */}
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-500">股票代码</span>
          <input
            name="code"
            defaultValue={defaultCode}
            required
            placeholder="688777"
            className="w-full rounded border border-stone-300 px-3 py-2 font-mono text-sm focus:border-stone-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-500">
            股票名称
            {defaultCode && (
              <span className="ml-2 font-normal text-stone-400">已有标的不会被改名</span>
            )}
          </span>
          <input
            name="name"
            defaultValue={defaultName}
            required
            placeholder="中控技术"
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
        </label>
      </div>

      <label className="block w-1/2">
        <span className="mb-1 block text-xs font-medium text-stone-500">评估日期</span>
        <input
          type="date"
          name="eval_date"
          defaultValue={today}
          max={today}
          required
          className="w-full rounded border border-stone-300 px-3 py-2 font-mono text-sm focus:border-stone-500 focus:outline-none"
        />
      </label>

      {/* five conditions */}
      <fieldset className="rounded-lg border border-stone-200 bg-white px-5 py-4">
        <legend className="px-1 text-sm font-medium">RUQ 五条打分 · 各 0/1/2</legend>
        <p className="mb-3 text-xs text-stone-400">0 不满足 · 1 部分满足 · 2 明确满足 — 五条必须全部打分。</p>
        <div className="space-y-3">
          {CONDITIONS.map((c) => {
            const locked = c.key === "cond_floor" && c1Gated;
            return (
              <div key={c.key} className="flex items-center gap-3">
                <span className="font-mono text-xs text-stone-400">C{c.n}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    {c.label}
                    {locked && (
                      <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">
                        C1 闸门已锁 0
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-stone-400">{c.hint}</div>
                </div>
                {locked ? (
                  // Gate locked: C1 is fixed to 0. A hidden input carries the
                  // value (disabled inputs are excluded from form submission).
                  <div className="flex gap-1">
                    <input type="hidden" name="cond_floor" value="0" />
                    {SCORE_OPTIONS.map((opt) => (
                      <span
                        key={opt.value}
                        title={opt.label}
                        className={`flex h-8 w-8 cursor-not-allowed items-center justify-center rounded border font-mono text-sm ${
                          opt.value === 0
                            ? "border-red-600 bg-red-600 text-white"
                            : "border-stone-200 text-stone-300"
                        }`}
                      >
                        {opt.value}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-1">
                    {SCORE_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        title={opt.label}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-stone-300 font-mono text-sm text-stone-600 hover:bg-stone-100 has-[:checked]:border-stone-800 has-[:checked]:bg-stone-800 has-[:checked]:text-white"
                      >
                        <input
                          type="radio"
                          name={c.key}
                          value={opt.value}
                          required
                          className="sr-only"
                        />
                        {opt.value}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      {/* governance red line → C1 gate */}
      <div className="rounded-lg border border-stone-200 bg-white px-5 py-4">
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            name="c1_gated"
            checked={c1Gated}
            onChange={(e) => setC1Gated(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span className="text-sm">
            治理红线触发
            <span className="ml-2 text-xs text-stone-400">
              高质押 / 实控人被调查 / 司法拍卖等 — 勾选后 C1 现金流底强制归零,该标的被否决
            </span>
          </span>
        </label>
        {c1Gated && (
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium text-red-600">治理红线细节(必填)</span>
            <textarea
              name="veto_reason"
              required={c1Gated}
              rows={2}
              placeholder="实控人涉嫌信披违规被立案调查;控股股东高比例质押…"
              className="w-full rounded border border-red-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
            />
          </label>
        )}
      </div>

      {/* status + reverse check */}
      <div className="rounded-lg border border-stone-200 bg-white px-5 py-4 space-y-4">
        <label className="block w-1/2">
          <span className="mb-1 block text-xs font-medium text-stone-500">状态</span>
          <select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          >
            <option value="candidate">候选 candidate</option>
            <option value="tracking">跟踪 tracking</option>
            <option value="holding">建仓 holding</option>
          </select>
        </label>

        <p className="text-xs text-stone-400">
          {isHolding
            ? "建仓 — 反向检查与证伪退出条件为必填,否则无法保存。"
            : "候选 / 跟踪 — 反向检查可留空,后补。"}
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-500">
            反向检查{isHolding && <span className="text-red-600"> (建仓必填)</span>}
          </span>
          <textarea
            name="devils_advocate"
            required={isHolding}
            rows={3}
            placeholder="如果这个故事是错的,最可能错在哪里?"
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-500">
            证伪退出条件{isHolding && <span className="text-red-600"> (建仓必填)</span>}
          </span>
          <textarea
            name="falsification"
            required={isHolding}
            rows={3}
            placeholder="出现什么具体信号就退出?(指标 / 阈值 / 时点)"
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-500">备注</span>
          <textarea
            name="notes"
            rows={2}
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
        </label>
      </div>

      {state.error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
