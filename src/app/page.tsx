import Link from "next/link";
import { getWatchlist } from "@/lib/data";

// Always render from the live DB — never statically bake watchlist data.
export const dynamic = "force-dynamic";
import { QuadrantMap } from "@/components/QuadrantMap";
import { StatusBadge, SignalDots } from "@/components/badges";

export default async function WatchlistHome() {
  const stocks = await getWatchlist();

  return (
    <div className="min-h-screen bg-stone-50 px-6 py-8 text-stone-800">
      <div className="mx-auto max-w-3xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded border border-stone-300 text-xs text-stone-500">观</div>
            <span className="text-base font-medium">观察池</span>
            <span className="text-sm text-stone-400">/ watchlist</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-stone-500">
            <span className="font-mono">{stocks.length} 只标的</span>
            <Link
              href="/evaluations/new"
              className="rounded border border-stone-300 px-2.5 py-1 hover:bg-stone-100"
            >
              + 新建评估
            </Link>
          </div>
        </div>

        {/* quadrant map — signature element */}
        <div className="mt-5 rounded-lg border border-stone-200 bg-white px-5 pb-2 pt-4">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm font-medium">象限全景</span>
            <span className="text-xs text-stone-400">基本面强弱 × 叙事弹性</span>
          </div>
          <QuadrantMap stocks={stocks} />
        </div>

        {/* watchlist table */}
        <table className="mt-5 w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th style={{ width: "28%" }} className="px-2 py-2.5 font-medium">标的</th>
              <th style={{ width: "13%" }} className="px-2 py-2.5 font-medium">状态</th>
              <th style={{ width: "9%" }} className="px-2 py-2.5 text-center font-medium">RUQ</th>
              <th style={{ width: "16%" }} className="px-2 py-2.5 font-medium">象限</th>
              <th style={{ width: "18%" }} className="px-2 py-2.5 font-medium">信号灯</th>
              <th style={{ width: "16%" }} className="px-2 py-2.5 text-right font-medium">最近评估</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s) => (
              <tr
                key={s.code}
                className="border-b border-stone-100 hover:bg-white"
              >
                <td className="px-2 py-3">
                  <Link href={`/stocks/${s.code}`} className="block">
                    <div className="font-medium">{s.name}</div>
                    <div className="font-mono text-xs text-stone-400">{s.code}</div>
                  </Link>
                </td>
                <td className="px-2 py-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-2 py-3 text-center font-mono font-medium">
                  {s.veto ? <span className="text-red-600">否决</span> : s.ruq}
                </td>
                <td className="px-2 py-3 text-stone-500">
                  {s.quadrant}
                  {s.trend === "down" && <span className="ml-1 text-amber-600">↓</span>}
                  {s.trend === "up" && <span className="ml-1 text-emerald-600">↑</span>}
                </td>
                <td className="px-2 py-3">
                  <SignalDots signals={s.signals} veto={s.veto} />
                </td>
                <td className="px-2 py-3 text-right font-mono text-stone-500">{s.lastEval}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3.5 px-0.5 text-xs text-stone-400">
          点任意标的进入详情页 · 持仓标的的虚线是上一版评估滑向当前的漂移轨迹
        </p>
      </div>
    </div>
  );
}
