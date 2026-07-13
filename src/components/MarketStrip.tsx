import type { MarketSnapshot } from "@/lib/data";

// 行情条 — AkShare 每日数据: 最新指标 + 近 60 日收盘迷你走势。
// 纯客观数据展示,与评分体系无任何自动联动。

const W = 160,
  H = 40,
  PAD = 2;

function Sparkline({ closes }: { closes: { date: string; close: number }[] }) {
  if (closes.length < 2) return null;
  const vals = closes.map((c) => c.close);
  const min = Math.min(...vals),
    max = Math.max(...vals);
  const span = max - min || 1;
  const pts = vals
    .map((v, i) => {
      const x = PAD + (i / (vals.length - 1)) * (W - 2 * PAD);
      const y = H - PAD - ((v - min) / span) * (H - 2 * PAD);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = vals[vals.length - 1] >= vals[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-10 w-40" aria-label="近 60 日收盘走势">
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "#059669" : "#dc2626"}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function fmt(v: number | null, digits = 2): string {
  return v == null ? "—" : v.toFixed(digits);
}

export function MarketStrip({ market }: { market: MarketSnapshot }) {
  const pct = market.pct_chg;
  const pctCls = pct == null ? "text-stone-500" : pct >= 0 ? "text-emerald-600" : "text-red-600";
  const cap = market.market_cap != null ? `${(market.market_cap / 1e8).toFixed(0)} 亿` : "—";

  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-stone-200 bg-white px-5 py-3 font-mono text-sm">
      <span className="text-lg font-medium">{fmt(market.close)}</span>
      <span className={pctCls}>
        {pct != null && pct >= 0 ? "+" : ""}
        {fmt(pct)}%
      </span>
      <span className="text-stone-500">PE(动) {fmt(market.pe, 1)}</span>
      <span className="text-stone-500">PB {fmt(market.pb, 2)}</span>
      <span className="text-stone-500">市值 {cap}</span>
      <Sparkline closes={market.closes} />
      <span className="ml-auto text-xs text-stone-400">{market.trade_date} · AkShare</span>
    </div>
  );
}
