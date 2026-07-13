"""AkShare → Supabase market_data 每日抓取.

用法:
  python scripts/fetch_market_data.py              # 抓当日快照 (收盘后跑)
  python scripts/fetch_market_data.py --backfill 90  # 回填最近 N 天日线 (新股票入池后跑一次)

环境变量 (GitHub Actions secrets / 本地 export):
  SUPABASE_URL                https://xxxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY   service_role 密钥 (绕过 RLS, 仅服务端)
"""

import argparse
import os
import sys
from datetime import date, timedelta

import akshare as ak
import requests

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}


def get_watchlist_codes() -> list[str]:
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/stocks?select=code", headers=HEADERS, timeout=30
    )
    r.raise_for_status()
    return [row["code"] for row in r.json()]


def upsert_rows(rows: list[dict]) -> None:
    if not rows:
        return
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/market_data?on_conflict=stock_code,trade_date",
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates"},
        json=rows,
        timeout=60,
    )
    r.raise_for_status()


def num(v):
    """AkShare 缺失值 ('-', NaN) → None."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if f != f else f  # NaN check


def fetch_snapshot(codes: list[str]) -> list[dict]:
    """全市场实时快照, 过滤观察池 (一次请求, 收盘后即当日收盘数据)."""
    df = ak.stock_zh_a_spot_em()
    df = df[df["代码"].isin(codes)]
    today = date.today().isoformat()
    rows = []
    for _, r in df.iterrows():
        rows.append(
            {
                "stock_code": str(r["代码"]),
                "trade_date": today,
                "close": num(r.get("最新价")),
                "pct_chg": num(r.get("涨跌幅")),
                "pe": num(r.get("市盈率-动态")),
                "pb": num(r.get("市净率")),
                "market_cap": num(r.get("总市值")),
            }
        )
    return rows


def fetch_history(code: str, days: int) -> list[dict]:
    """单只股票最近 N 天日线 (前复权). 估值指标历史不回填, 只补价格."""
    start = (date.today() - timedelta(days=days)).strftime("%Y%m%d")
    df = ak.stock_zh_a_hist(
        symbol=code, period="daily", start_date=start, adjust="qfq"
    )
    rows = []
    for _, r in df.iterrows():
        rows.append(
            {
                "stock_code": code,
                "trade_date": str(r["日期"]),
                "close": num(r.get("收盘")),
                "pct_chg": num(r.get("涨跌幅")),
            }
        )
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backfill", type=int, metavar="DAYS", default=0)
    args = parser.parse_args()

    codes = get_watchlist_codes()
    if not codes:
        print("观察池为空, 无需抓取")
        return 0
    print(f"观察池 {len(codes)} 只: {', '.join(codes)}")

    if args.backfill:
        total = 0
        for code in codes:
            try:
                rows = fetch_history(code, args.backfill)
                upsert_rows(rows)
                total += len(rows)
                print(f"  {code}: 回填 {len(rows)} 天")
            except Exception as e:  # 单只失败不中断整体
                print(f"  {code}: 回填失败 — {e}", file=sys.stderr)
        print(f"回填完成, 共 {total} 行")
    else:
        rows = fetch_snapshot(codes)
        missing = set(codes) - {r["stock_code"] for r in rows}
        if missing:
            print(f"快照缺失 (停牌/代码有误?): {', '.join(sorted(missing))}", file=sys.stderr)
        upsert_rows(rows)
        print(f"快照写入 {len(rows)} 行 ({date.today()})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
