// Shared date helpers.

// "2026-06-02" -> "06-02" (display only — never sort on this)
export function mmdd(isoDate: string): string {
  return isoDate.slice(5, 10);
}

// Today's date in the market's timezone (A 股 = Asia/Shanghai), as YYYY-MM-DD.
// Server code runs in UTC (Vercel), so new Date().toISOString() would be
// yesterday for the first 8 hours of every Shanghai day.
export function shanghaiToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
