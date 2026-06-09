-- ===========================================================================
-- Geralt — A 股投研工具 · 第一阶段 schema
-- stocks + evaluations
--
-- Discipline is welded into the DB so it cannot be bypassed by any client:
--   * total_score is a GENERATED column = sum of the five conditions (rule 1)
--   * C1 gate: c1_gated ⇒ cond_floor = 0           (CHECK)
--   * red line: c1_gated ⇒ veto_reason present      (CHECK)
--   * holding gate: status='holding' ⇒ 反向检查 + 证伪退出条件 present (CHECK)
--   * each condition constrained to 0/1/2
-- The app layer (Server Action + form) re-validates for good error messages,
-- but these constraints are the final guard.
-- ===========================================================================

create table if not exists stocks (
  code        text primary key,                 -- A 股代码,如 688777
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists evaluations (
  id              uuid primary key default gen_random_uuid(),
  stock_code      text not null references stocks(code) on delete cascade,
  eval_date       date not null default current_date,

  -- RUQ 五条打分,各 0/1/2 (0=不满足, 1=部分满足, 2=明确满足)
  cond_floor      smallint not null check (cond_floor      between 0 and 2), -- 1 现金流底
  cond_valuation  smallint not null check (cond_valuation  between 0 and 2), -- 2 估值便宜档
  cond_catalyst   smallint not null check (cond_catalyst   between 0 and 2), -- 3 可证伪节点
  cond_beta       smallint not null check (cond_beta       between 0 and 2), -- 4 板块 β
  cond_headroom   smallint not null check (cond_headroom   between 0 and 2), -- 5 机构空间

  -- 五条之和 0–10 (rule 1: 由 DB 强制计算,客户端无法伪造)
  total_score     smallint generated always as
                  (cond_floor + cond_valuation + cond_catalyst + cond_beta + cond_headroom) stored,

  -- C1 闸门 / 治理红线
  c1_gated        boolean not null default false,   -- C1 是否被强制归零
  veto_reason     text,                             -- 治理红线细节 (高质押/实控人被调查/司法拍卖等)

  -- 反向检查 (纪律字段) — 建仓必填
  devils_advocate text,                             -- 反向检查
  falsification   text,                             -- 证伪退出条件

  status          text not null default 'candidate'
                  check (status in ('tracking', 'holding', 'candidate')),
  notes           text,
  created_at      timestamptz not null default now(),

  -- C1 闸门一旦触发,现金流底必须为 0
  constraint c1_gate_locks_floor
    check (not c1_gated or cond_floor = 0),
  -- 触发治理红线必须写明原因
  constraint c1_gate_requires_reason
    check (not c1_gated or (veto_reason is not null and length(btrim(veto_reason)) > 0)),
  -- 建仓 (holding) 必须填反向检查 + 证伪退出条件
  constraint holding_requires_reverse_check
    check (
      status <> 'holding'
      or (
        devils_advocate is not null and length(btrim(devils_advocate)) > 0
        and falsification is not null and length(btrim(falsification)) > 0
      )
    )
);

create index if not exists evaluations_stock_date_idx
  on evaluations (stock_code, eval_date desc, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS — 第一阶段无登录,先用对 anon 开放的策略把应用跑通。
-- TODO(二期): 接入 Supabase Auth 后,把下面策略改为 auth.uid() 限定。
-- 注意: 当前 anon key 可读写全部数据,部署前请知悉此风险。
-- ---------------------------------------------------------------------------
alter table stocks      enable row level security;
alter table evaluations enable row level security;

drop policy if exists stocks_anon_all on stocks;
create policy stocks_anon_all on stocks
  for all to anon using (true) with check (true);

drop policy if exists evaluations_anon_all on evaluations;
create policy evaluations_anon_all on evaluations
  for all to anon using (true) with check (true);
