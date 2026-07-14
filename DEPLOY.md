# Vercel 部署清单（Geralt · Next.js 14 + Supabase）

> 按顺序执行,可直接照做。**先读第 5 节「上线前安全」**——它直接关系到「开 Vercel Authentication 就安全了」这个判断是否成立(结论:不成立)。

---

## 0) 前置确认

- [ ] 代码已推送到 GitHub(Production 分支默认 `main`,若用 `master` 记住,后面要核对)
- [ ] 敏感文件未提交:`.gitignore` 已忽略 `.env`、`.env*.local`、`.vercel`(本仓库已覆盖)
- [ ] 仅提交占位用的 `.env.local.example`,绝不提交真实密钥
- [ ] 本地构建通过:`npm install` 后 `npm run build`(Vercel 默认装 devDeps 并做 TS 类型检查 + ESLint,本地先跑一遍避免线上构建失败)
- [ ] 备好两个环境变量的真实值:`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 1) 导入仓库到 Vercel 首次部署

- [ ] vercel.com 登录 → 仪表盘 `Add New...` → `Project`(或 vercel.com/new)
- [ ] 安装/授权 Vercel 的 GitHub App,授予对本仓库的访问权
- [ ] 在 `Import Git Repository` 找到本仓库 → `Import`
- [ ] `Configure Project` 页确认框架自动识别为 **Next.js**(无需手动选)
- [ ] **Build & Output Settings 保持默认**:Build `next build`、Output `.next`、Install 依锁文件自动用 `npm install`(本仓库有 `package-lock.json`)。App Router 用默认即对,不要配 `next start`
- [ ] Root Directory 保持仓库根目录(非 monorepo)
- [ ] **先展开 `Environment Variables` 把第 2 节变量加好,再点 Deploy**(首次构建即正确注入)
- [ ] `Deploy` → 等待 克隆 → 装依赖 → `next build` → 得到生产 URL(`your-project.vercel.app`)
- [ ] 之后每次推送自动部署:`main` → 生产;其他分支/PR → 预览

---

## 2) 配置环境变量

位置:导入时内联添加,或后续在 **Project → Settings → Environment Variables**。

- [ ] `NEXT_PUBLIC_SUPABASE_URL` = 你的 Supabase 项目 URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon / publishable 公钥(过渡期回退用)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = service_role 密钥(**无 NEXT_PUBLIC_ 前缀**,勾选 Sensitive,仅服务端)——迁移 0002 锁定 anon 后必须有它
- [ ] 服务端统一走 `src/lib/supabase/admin.ts`(`import "server-only"` 守卫):优先 service_role,缺失时回退 anon 公钥,保证切换期零停机
- [ ] 勾选作用域(Environments):
  - **Production** = 生产分支(`main`)的部署
  - **Preview** = 其他分支/PR 的部署
  - **Development** = 本地经 `vercel env pull` / `vercel dev` 拉取(**不会**自动应用到普通 `next dev`,本地仍用自己的 `.env.local`)
  - 同一 Supabase 项目全环境通用就三个都勾;若想 Preview/Dev 用独立项目,按作用域填不同值(**强烈建议见第 5 节做环境隔离**)
- [ ] 记住 `NEXT_PUBLIC_*` 两条铁律:
  - **构建期注入**:值在 `next build` 时被内联进客户端 bundle,不是运行时读取 → **改了值必须重新部署**,旧部署仍用旧值
  - **公开可见**:一旦被客户端代码引用,值就会随 bundle 发到浏览器,任何人可读 → 对 Supabase URL 与 anon 公钥设计上可接受;**绝不可**给 `service_role` 等真实密钥加 `NEXT_PUBLIC_` 前缀

---

## 3) Node 版本 / 构建设置

- [ ] 本仓库**没有** `engines` 也没有 `.nvmrc`,Vercel 用项目默认 Node 版本
- [ ] 建议显式固定:**Settings → Build and Deployment → Node.js Version** 选 **22.x**(Next 14 安全默认;可选 24.x / 22.x / 20.x)
- [ ] **不要选 18 及以下**(已弃用)
- [ ] 想随仓库固定(本地/CI 一致):`package.json` 加 `"engines": { "node": "22.x" }`,会**覆盖**面板选择
- [ ] 改 Node 版本只对**新部署**生效 → 改完需重新部署
- [ ] 构建设置无需改:`next.config.mjs` 为空,无 standalone/headers/redirects,无 edge runtime,无路由段 `runtime/dynamic/revalidate` 覆盖,无 postinstall / vercel-build 脚本

---

## 4) 部署后验证

- [ ] 打开生产 URL,首页正常加载
- [ ] **确认连的是真实库(非 mock)**:`src/lib/data.ts` 在 env 缺失或 URL 仍含 `YOUR_PROJECT` 时回退到内存 MOCK 数据 → 若看到占位 A 股(中控技术/蓝色光标/索辰科技/万通发展),说明 env 没配对,回第 2 节修正并重新部署
- [ ] 进「新建评估」(`/evaluations/new`)走通**强制表单**并提交(触发 Server Action `createEvaluation`),确认列表/详情刷新(`revalidatePath` + `redirect`)
- [ ] 打开个股详情(`/stocks/[code]`)确认评分漂移时间线正常

---

## 5) 上线前安全(重点!)

> **核心结论:用 Vercel Authentication「锁住站点」并不能锁住 Supabase 数据库。带着当前 RLS 策略公开是不安全的。**

### 为什么前端锁 ≠ 数据库锁

- [ ] **两个独立主机**:Vercel Authentication 只拦 Vercel 托管的 HTML/RSC/路由;Supabase 的 REST 端点 `https://<project>.supabase.co/rest/v1` 是**独立的、面向公网的主机**,与 Vercel 设置无关。站点返回 401 时,数据库依然可被直接访问。
- [ ] **当前 RLS 形同虚设**:`supabase/migrations/0001_init.sql` 对两表设了 `for all to anon using(true) with check(true)`,即 **anon 拥有完整 增/删/改/查**。RLS 开着,但策略让它变成无操作。
- [ ] **已被实证**:仓库自带 `scripts/verify-db.mjs`(增改查)与 `scripts/cleanup-verify.mjs`(级联删除)证明,**仅凭 anon 公钥即可直接读取、篡改、清空生产库**,完全绕过 Vercel。
- [ ] **CHECK 约束不是授权**:生成列 `total_score`、C1 闸门、建仓闸门只约束**行的形状**,不约束身份/数量,**不是访问控制**。

### 一个需要澄清的现状(影响严重度,但不改变结论)

- [ ] 目前**所有 DB 访问都在服务端**:读走 Server Components(`data.ts`),写走 Server Action(`actions.ts`),都用服务端 client。浏览器端 Supabase client 已删除(没有任何客户端代码触达 DB)→ 所以 anon 公钥**目前并没有被打进浏览器 bundle**,无法从已部署 JS 里直接扒到。
- [ ] **但这不构成安全**,原因有三:
  1. 这是个 **anon / publishable 公钥**,Supabase 设计上就当它是公开的;将来任何客户端组件直接连 Supabase(后续做交互功能可能发生),`NEXT_PUBLIC_` 前缀就会立刻把它送进浏览器。
  2. 即便不在 bundle 里,REST 端点是公网的,而开放的 anon RLS 让**数据库安全完全寄托于「公钥保密」**——而公钥本就不该保密,这是错误的控制层。
  3. 这把 key 实际上已离开保密状态(在对话里贴过、被脚本用过)。
- [ ] 结论:**把数据库当作已暴露来对待,在 Supabase 层(RLS/Auth)修,而不是靠前端墙。**

### 公开/分享任何 URL 之前,必须达到的最低状态(二选一并验证)

> ⚠️ 注意依赖:当前 app **即便在服务端也是以 anon 身份**访问 DB。一旦 drop 掉 anon 策略,默认拒绝会**让现有读写全部失效**,所以下面两个方案必须**同时**改访问方式,不能只 drop 策略。

- [ ] **方案 A —— 单用户个人工具(最简单、最安全,代码已就位)**,零停机顺序:
  1. 在 Vercel 加 `SUPABASE_SERVICE_ROLE_KEY`(Sensitive)并重新部署 —— `admin.ts` 自动改走 service_role;
  2. 在 Supabase SQL Editor 跑 `supabase/migrations/0002_lock_down_anon.sql`(删两条 anon 策略,RLS 保持开启 = 默认拒绝);
  3. 跑 `node scripts/verify-lockdown.mjs` 确认 anon 零读写,同时线上站点应照常工作(service_role 不受 RLS 影响)。
- [ ] **方案 B —— 要多用户**:引入 Supabase Auth,策略改为 `to authenticated using (auth.uid() = owner_id)`(需加 owner 列),anon 读写归零。
- [ ] **验证**:锁定后,照 `verify-db.mjs` 的方式直接打 REST 端点——**若仍成功,数据就还没受保护**。

### 环境隔离(高危)

- [ ] 给 Preview/Development 用**独立的 Supabase 项目**,并按 Vercel 作用域分别配 env(生产变量只给 Production),避免每个预览部署都直接写生产库
- [ ] 给 Preview 部署也开 Deployment Protection(Standard 作用域默认不覆盖生产域,但预览 URL 易猜、长期有效)

### 二期 / 加固

- [ ] RLS 收紧后,在 Supabase **轮换 anon 公钥**并更新 Vercel env(作废开放期被抓取的旧钥)
- [ ] 引入 `service_role` 时:存为**非** `NEXT_PUBLIC_` 的 env、仅 Production/服务端、只在服务端代码引用;在读取它的模块顶部加 `import "server-only"` 守卫;把服务端 client 改名(如 `createServiceClient`)避免与浏览器 `createClient()` 误交叉导入;绝不打印该 key
- [ ] 运营:保留 Supabase PITR/备份;考虑软删除(`deleted_at`)替代级联物理删除;加 `created_by`/owner 列让写入可追溯
- [ ] 生产环境让 mock 回退**显式失败**(env 缺失即 throw,或限定到 `NODE_ENV !== "production"`),避免误把假数据当真实研究记录

### 关于 Vercel Deployment Protection(了解即可)

- [ ] `Vercel Authentication` 方法**所有套餐可用**;默认 `Standard Protection` 作用域只保护预览 + 裸 `*.vercel.app`,**Hobby 无法锁定生产自定义域**
- [ ] `All Deployments` 作用域(含生产域)仅 Pro/Enterprise;`Password Protection` 为 Enterprise 或 Pro 付费加购,Hobby 不可用
- [ ] 它只是访问墙:不替代 Supabase RLS,也不会让已注入 bundle 的 `NEXT_PUBLIC_` 值变私密

---

## 6) 自定义域名(可选)

- [ ] **Settings → Domains** 添加域名并按提示配 DNS
- [ ] 核对 Production 分支(默认 `main`,若用 `master` 在 **Settings → Git** 改)
- [ ] Hobby 套餐下 `Standard Protection` 锁不住生产自定义域 → 公开生产域前务必已完成第 5 节的数据库层加固

---

## 8) 二期启用清单(AI 初评 + AkShare)

- [ ] **建表**:Supabase SQL Editor 跑 `supabase/migrations/0003_phase2.sql`(`market_data` + `ai_reviews`,仅 service_role 可达;不跑也不影响一期功能,行情/AI 面板自动降级)
- [ ] **AI 初评**(DeepSeek + Tavily):Vercel 环境变量加两个(均无 NEXT_PUBLIC_ 前缀、Sensitive)→ Redeploy
  - `DEEPSEEK_API_KEY`(platform.deepseek.com → API Keys)
  - `TAVILY_API_KEY`(app.tavily.com,免费档每月约 1000 次搜索)
  - 缺 DEEPSEEK 时点「生成 AI 初评」明确报错;缺 TAVILY 时仍能生成但无法联网核实(会在正文注明),不影响其他功能
- [ ] **AkShare 定时抓取**:GitHub 仓库 → Settings → Secrets and variables → Actions,加两个 secret:`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` → Actions 页手动跑一次 "Fetch market data",输入 backfill_days=90 回填历史 → 之后工作日 16:15(北京时间)自动跑
- [ ] AI 初评铁律已焊死:AI 只输出证据整理(【C1..C5】/红线扫描/反向检查草稿/证伪建议/来源),提示词与展示层都禁止分数;五条打分与反向检查仍然只能人工

---

## 7) 部署后基建(项目最初经文件直传创建时)

- [ ] **关联 GitHub 自动部署**:Vercel → 项目 `geralt` → **Settings → Git → Connect Git Repository** → 选 `AfterlifeBar/Geralt`,Production Branch 设为 `main` → 之后 push main 即自动部署
- [ ] 关联后**必须在 Settings → Environment Variables 补齐第 2 节的变量**(git 构建不再携带文件直传时的 `.env.production`)
- [ ] **Supabase 保活**:`vercel.json` 已配置每日 Cron 打 `/api/keepalive`(轻量查询一次 DB),防免费版一周无活动自动暂停;git 关联后的下一次部署自动生效,可在 Vercel → Settings → Cron Jobs 里确认

---

*注:Vercel 面板的具体标签与套餐/价格细节随时间变化,以你账号内实际显示为准。*
