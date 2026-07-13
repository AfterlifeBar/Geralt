-- ===========================================================================
-- 二期 schema: market_data (AkShare 每日行情/估值) + ai_reviews (AI 初评存档)
--
-- 两表均只由服务端 service_role 读写(app 服务端 + GitHub Actions 脚本)。
-- RLS 开启且不建任何策略 = anon/authenticated 默认全拒绝。
-- ===========================================================================

create table if not exists market_data (
  stock_code  text not null references stocks(code) on delete cascade,
  trade_date  date not null,
  close       numeric,          -- 收盘价 (元)
  pct_chg     numeric,          -- 当日涨跌幅 (%)
  pe          numeric,          -- 市盈率 (动态)
  pb          numeric,          -- 市净率
  market_cap  numeric,          -- 总市值 (元)
  created_at  timestamptz not null default now(),
  primary key (stock_code, trade_date)
);

create index if not exists market_data_code_date_idx
  on market_data (stock_code, trade_date desc);

-- AI 初评存档: 纯参考文本,永远不含打分 (打分只能人工)
create table if not exists ai_reviews (
  id          uuid primary key default gen_random_uuid(),
  stock_code  text not null references stocks(code) on delete cascade,
  content     text not null,    -- 初评正文 (纯文本,【】分节)
  model       text not null,    -- 生成所用模型 ID
  created_at  timestamptz not null default now()
);

create index if not exists ai_reviews_code_created_idx
  on ai_reviews (stock_code, created_at desc);

alter table market_data enable row level security;
alter table ai_reviews  enable row level security;
-- 不建任何策略: 默认拒绝 anon/authenticated; service_role 天然绕过 RLS。
