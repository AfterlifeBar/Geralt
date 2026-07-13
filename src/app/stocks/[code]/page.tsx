import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarketSnapshot, getStockDetail } from "@/lib/data";
import { condScores } from "@/lib/assemble";
import { CONDITIONS, quadrantLabel, scoreSignal } from "@/lib/scoring";
import { DriftTimeline } from "@/components/DriftTimeline";
import { MarketStrip } from "@/components/MarketStrip";
import { SIGNAL, StatusBadge } from "@/components/badges";

export default async function StockDetail({
  params,
}: {
  params: { code: string };
}) {
  const [detail, market] = await Promise.all([
    getStockDetail(params.code),
    getMarketSnapshot(params.code),
  ]);
  if (!detail) notFound();

  const { stock, evaluations, timeline } = detail;
  const latest = evaluations[0];

  return (
    <div className="min-h-screen bg-stone-50 px-6 py-8 text-stone-800">
      <div className="mx-auto max-w-3xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-3.5">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-stone-400 hover:text-stone-600">
              ← 观察池
            </Link>
            <span className="text-base font-medium">{stock.name}</span>
            <span className="font-mono text-sm text-stone-400">{stock.code}</span>
            {latest && <StatusBadge status={latest.status} />}
          </div>
          <Link
            href={`/evaluations/new?code=${stock.code}&name=${encodeURIComponent(stock.name)}`}
            className="rounded border border-stone-300 px-2.5 py-1 text-sm text-stone-500 hover:bg-stone-100"
          >
            + 新建评估
          </Link>
        </div>

        {/* market data strip (AkShare daily) */}
        {market && <MarketStrip market={market} />}

        {/* drift timeline — signature element */}
        <div className="mt-5 rounded-lg border border-stone-200 bg-white px-5 pb-3 pt-4">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm font-medium">评分漂移时间线</span>
            <span className="text-xs text-stone-400">RUQ 总分 · 按评估日期</span>
          </div>
          <DriftTimeline points={timeline} />
        </div>

        {latest && (
          <>
            {/* latest evaluation — the five conditions */}
            <div className="mt-5 rounded-lg border border-stone-200 bg-white px-5 py-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-sm font-medium">最近评估 · 五条打分</span>
                <span className="font-mono text-xs text-stone-400">
                  {latest.eval_date} · 象限 {quadrantLabel(condScores(latest), latest.c1_gated)}
                  {!latest.c1_gated && ` · RUQ ${latest.total_score}`}
                </span>
              </div>

              <ul className="divide-y divide-stone-100">
                {CONDITIONS.map((c) => {
                  const v = latest[c.key];
                  const locked = c.key === "cond_floor" && latest.c1_gated;
                  return (
                    <li key={c.key} className="flex items-center gap-3 py-2.5">
                      <span className="font-mono text-xs text-stone-400">C{c.n}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">
                          {c.label}
                          {locked && (
                            <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">
                              C1 闸门锁定
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-stone-400">{c.hint}</div>
                      </div>
                      <span className={`inline-block h-2 w-2 rounded-full ${SIGNAL[scoreSignal(v)]}`} />
                      <span className="w-4 text-right font-mono text-sm font-medium">{v}</span>
                    </li>
                  );
                })}
              </ul>

              {latest.c1_gated && (
                <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <span className="font-medium">治理红线 · 否决</span>
                  {latest.veto_reason && <p className="mt-1 text-red-700">{latest.veto_reason}</p>}
                </div>
              )}
            </div>

            {/* reverse check */}
            {(latest.devils_advocate || latest.falsification || latest.notes) && (
              <div className="mt-5 space-y-3 rounded-lg border border-stone-200 bg-white px-5 py-4 text-sm">
                {latest.devils_advocate && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-stone-500">反向检查</div>
                    <p className="whitespace-pre-wrap text-stone-700">{latest.devils_advocate}</p>
                  </div>
                )}
                {latest.falsification && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-stone-500">证伪退出条件</div>
                    <p className="whitespace-pre-wrap text-stone-700">{latest.falsification}</p>
                  </div>
                )}
                {latest.notes && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-stone-500">备注</div>
                    <p className="whitespace-pre-wrap text-stone-600">{latest.notes}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* evaluation history */}
        <table className="mt-5 w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th style={{ width: "20%" }} className="px-2 py-2.5 font-medium">日期</th>
              <th style={{ width: "14%" }} className="px-2 py-2.5 font-medium">状态</th>
              <th style={{ width: "12%" }} className="px-2 py-2.5 text-center font-medium">RUQ</th>
              <th style={{ width: "54%" }} className="px-2 py-2.5 font-medium">五条 (现金流底·估值·可证伪·β·机构)</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((e) => (
              <tr key={e.id} className="border-b border-stone-100">
                <td className="px-2 py-3 font-mono text-stone-500">{e.eval_date}</td>
                <td className="px-2 py-3">
                  <StatusBadge status={e.status} />
                </td>
                <td className="px-2 py-3 text-center font-mono font-medium">
                  {e.c1_gated ? <span className="text-red-600">否决</span> : e.total_score}
                </td>
                <td className="px-2 py-3 font-mono text-stone-500">
                  {e.cond_floor}·{e.cond_valuation}·{e.cond_catalyst}·{e.cond_beta}·{e.cond_headroom}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
