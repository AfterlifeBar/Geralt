import type { Signal, StockStatus } from "@/lib/types";

export const STATUS: Record<StockStatus, { label: string; cls: string }> = {
  tracking: { label: "跟踪", cls: "bg-sky-50 text-sky-700" },
  holding: { label: "持仓", cls: "bg-emerald-50 text-emerald-700" },
  candidate: { label: "候选", cls: "bg-stone-100 text-stone-500" },
};

// signal-light states -> dot color
export const SIGNAL: Record<Signal, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  red: "bg-red-500",
};

export function StatusBadge({ status }: { status: StockStatus }) {
  const s = STATUS[status];
  return <span className={`rounded px-2 py-0.5 text-xs ${s.cls}`}>{s.label}</span>;
}

export function SignalDots({ signals, veto }: { signals: Signal[]; veto?: boolean }) {
  if (veto) {
    return (
      <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">红线</span>
    );
  }
  return (
    <span className="flex items-center gap-1">
      {signals.map((s, i) => (
        <span key={i} className={`inline-block h-2 w-2 rounded-full ${SIGNAL[s]}`} />
      ))}
    </span>
  );
}
