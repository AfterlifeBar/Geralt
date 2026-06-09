import type { TimelinePoint } from "@/lib/types";

// 评分漂移时间线 — same stock's evaluations plotted as an RUQ-total line over
// eval_date. Gated (治理红线) points are drawn in red. Quiet stone ink; the
// trajectory is the one loud thing.

const VB_W = 600,
  VB_H = 260;
const X0 = 44,
  X1 = 576,
  Y0 = 210,
  Y1 = 24; // plot bounds; y inverted
const SCORE_MAX = 10;

const sy = (total: number) => Y0 - (total / SCORE_MAX) * (Y0 - Y1);

function mmdd(iso: string) {
  return iso.slice(5, 10);
}

export function DriftTimeline({ points }: { points: TimelinePoint[] }) {
  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-stone-400">暂无评估记录</p>;
  }

  const n = points.length;
  const sx = (i: number) =>
    n === 1 ? (X0 + X1) / 2 : X0 + (i / (n - 1)) * (X1 - X0);

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${sx(i)} ${sy(p.total)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block w-full">
      {/* horizontal gridlines at 0 / 5 / 10 */}
      {[0, 5, 10].map((g) => (
        <g key={g}>
          <line x1={X0} y1={sy(g)} x2={X1} y2={sy(g)} stroke="#e7e5e4" strokeWidth="0.5" />
          <text x={X0 - 8} y={sy(g) + 4} textAnchor="end" fill="#a8a29e" fontSize="11" className="font-mono">
            {g}
          </text>
        </g>
      ))}

      {/* trajectory */}
      {n > 1 && (
        <path d={linePath} fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinejoin="round" />
      )}

      {/* points + date labels */}
      {points.map((p, i) => {
        const x = sx(i),
          y = sy(p.total);
        return (
          <g key={p.date + i}>
            {p.gated ? (
              <>
                <circle cx={x} cy={y} r="5.5" fill="none" stroke="#dc2626" strokeWidth="1.5" />
                <circle cx={x} cy={y} r="2" fill="#dc2626" />
              </>
            ) : (
              <circle cx={x} cy={y} r="3.5" fill="#d97706" />
            )}
            <text x={x} y={y - 12} textAnchor="middle" fill={p.gated ? "#b91c1c" : "#57534e"} fontSize="12" className="font-mono">
              {p.gated ? "否决" : p.total}
            </text>
            <text x={x} y={Y0 + 18} textAnchor="middle" fill="#a8a29e" fontSize="11" className="font-mono">
              {mmdd(p.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
