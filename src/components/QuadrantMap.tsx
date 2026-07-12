import type { WatchlistEntry } from "@/lib/types";

// quadrant map geometry (SVG units)
const VB_W = 600,
  VB_H = 360;
const X0 = 70,
  X1 = 550,
  Y0 = 320,
  Y1 = 40; // plot bounds; y inverted
const px = (f: number) => X0 + (f / 10) * (X1 - X0);
const py = (n: number) => Y0 - (n / 10) * (Y0 - Y1); // n 0..10
const CX = px(5),
  CY = py(5); // quadrant split at midpoint

export function QuadrantMap({ stocks }: { stocks: WatchlistEntry[] }) {
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block w-full">
      {/* axes */}
      <line x1={CX} y1={Y1 - 4} x2={CX} y2={Y0 + 4} stroke="#d6d3d1" strokeWidth="0.5" strokeDasharray="3 4" />
      <line x1={X0 - 10} y1={CY} x2={X1 + 10} y2={CY} stroke="#d6d3d1" strokeWidth="0.5" strokeDasharray="3 4" />

      {/* axis hints */}
      <text x={CX} y={Y1 - 14} textAnchor="middle" fill="#a8a29e" fontSize="12">叙事弹性 强 ↑</text>
      <text x={X1 + 6} y={CY - 8} textAnchor="end" fill="#a8a29e" fontSize="12">基本面 强 →</text>

      {/* quadrant corner labels */}
      <text x={X0} y={Y1 + 12} fill="#a8a29e" fontSize="12">纯题材 / 高弹性</text>
      <text x={X1} y={Y1 + 12} textAnchor="end" fill="#a8a29e" fontSize="12">优质成长 / 核心</text>
      <text x={X0} y={Y0 + 4} fill="#a8a29e" fontSize="12">回避</text>
      <text x={X1} y={Y0 + 4} textAnchor="end" fill="#a8a29e" fontSize="12">价值 / 低弹性</text>

      <defs>
        <marker id="drift-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M2 1L8 5L2 9" fill="none" stroke="#d97706" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>

      {stocks.map((s) => {
        const x = px(s.fund),
          y = py(s.narr);
        // veto: red ring + center dot
        if (s.veto) {
          return (
            <g key={s.code}>
              <circle cx={x} cy={y} r="6.5" fill="none" stroke="#dc2626" strokeWidth="1.5" />
              <circle cx={x} cy={y} r="2" fill="#dc2626" />
              <text x={x + 12} y={y + 4} fill="#44403c" fontSize="12">{s.name}</text>
              <text x={x + 12} y={y + 19} fill="#b91c1c" fontSize="12">治理红线 · 否决</text>
            </g>
          );
        }
        // drifting stock: ghost previous position + dashed trajectory + amber current
        if (s.drift) {
          const fx = px(s.drift.fund),
            fy = py(s.drift.narr);
          return (
            <g key={s.code}>
              <circle cx={fx} cy={fy} r="6.5" fill="none" stroke="#d97706" strokeWidth="1" strokeDasharray="2 2" />
              <text x={fx + 11} y={fy - 3} fill="#a8a29e" fontSize="12">前值</text>
              <line x1={fx - 1} y1={fy + 8} x2={x + 1} y2={y - 8} stroke="#d97706" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" markerEnd="url(#drift-arrow)" />
              <circle cx={x} cy={y} r="6.5" fill="#d97706" />
              <text x={x + 12} y={y + 4} fill="#44403c" fontSize="12">{s.name} · {s.ruq}</text>
              {s.quadrantFrom && (
                <text x={x + 12} y={y + 19} fill="#a8a29e" fontSize="12">{s.quadrantFrom} → {s.quadrant}</text>
              )}
            </g>
          );
        }
        // normal dot
        return (
          <g key={s.code}>
            <circle cx={x} cy={y} r="6" fill="#57534e" />
            <text x={x + 12} y={y + 4} fill="#44403c" fontSize="12">{s.name} · {s.ruq}</text>
          </g>
        );
      })}
    </svg>
  );
}
