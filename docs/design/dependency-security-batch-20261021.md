# 依赖漏洞治理批次（DEP‑SEC‑1）实施计划

> 日期：2026-10-21
> 状态：已排期，未开工
> 触发：GitHub Security 页 `190 个漏洞 / 8 critical` 告警长期挂账，且 CI 从不检查依赖漏洞。
> 相关前置提交：`bc40e0ab8`（2026-10-13，runtime CVE 补丁）、`f59924115`（2026-09-15，`npm audit fix`）

---

## 1. 为什么单独排一个批次

不是一个可以顺手合进去的小修补，原因有三：

1. **治理缺口**：`.github/workflows/quality-gates.yml` 的每一个 job 都用 `npm ci --no-audit`，仓库没有 `dependabot.yml`、没有 CodeQL、没有 gitleaks、没有 `dependency-review`。也就是说漏洞**只会**出现在 GitHub 安全页，永远不会阻断任何 PR，所以它必然越积越多。
2. **数字虚高**：190 是 Dependabot 按「advisory × 受影响版本实例 × manifest」计数。根 lockfile 实测 **185 个受影响节点 / 197 条唯一 advisory / 47 个 critical 节点**，但 critical 唯一 advisory 只有 **7 条**，且**没有一条能从 server 运行时依赖到达**（见 §2.4）。
3. **修复手段互相冲突**：npm 对 `@tarojs/*` 建议的 "fix" 是**降级**到 3.2.16 或 `@tarojs/cli@1.3.8`。`npm audit fix --force` 会把 Taro 从 4.2.0 打到 3.x，直接毁掉整个小程序构建。必须用「基线棘轮 + 定向升级」而非 `--force` 处理。

## 2. 现状基线（2026-10-21 实测 `npm audit`，按 workspace）

| Workspace | total | critical | high | moderate | low | 说明 |
|---|---|---|---|---|---|---|
| `@joyjoin/server` | 12 | **0** | 4 | 8 | 0 | 唯一真实运行时高危：`drizzle-orm` |
| `@joyjoin/admin-client` | 19 | **0** | 11 | 7 | 1 | 全是构建/工具链（vite、tailwind、glob 系） |
| `mini-program` | 27* | 3* | 14 | 9 | 1 | *3 个 critical 节点 = 同 1 条 swiper advisory 的父级传播 |
| `packages/shared` | 计在 server/admin 图中 | — | — | — | — | 只有 drizzle-orm 一条 |

\* npm 按节点计数，mini-program 的 120+ 个 babel-6 子包（`babel-traverse`、`babel-core`、`babel-*`）在 Dependabot 侧被展开成上百条，因此 GitHub 显示 190。

根 lockfile 全图（含 dev）：**185 节点 / 7 critical / 68 high / 62 moderate / 8 low**，唯一 advisory 去重后 197 条（critical 7）。

### 2.1 唯一的 3 个 critical 其实是同一条

`GHSA-hmx5-qpq5-p643`（swiper `<12.1.2` 原型链污染，critical）通过
`@tarojs/components → swiper@11.1.15` 传播，把 `@tarojs/components`、`@tarojs/taro`、`@tarojs/plugin-platform-h5` 三个父节点也标成 critical。**不是三个独立漏洞。**

关键事实：`swiper` 只被 `@tarojs/components` 与 `@tarojs/components-react`（H5 实现）依赖；`apps/mini-program/src` **零引用**，微信端 `<Swiper>` 走原生组件。因此它对上线包的实际暴露接近于零 —— 但仍是唯一能"清空 critical 计数"的低成本动作（`overrides`）。

### 2.2 真实运行时风险清单（按是否随包发版）

| # | 包 | 严重度 | 修复 | 在运行时的可信度 |
|---|---|---|---|---|
| 1 | `drizzle-orm` 0.39.1 → ≥0.45.2 | high（SQL 标识符转义导致注入） | MAJOR | **真实暴露**：server 与 shared 双 workspace 直连 PG。当前用法是参数化值 + 静态标识符，实际可注入面窄，但这是唯一"代码在跑 + 数据在库"的高危 |
| 2 | `sharp` 0.34.5 → 0.35.5 | high（libvips/libheif/librsvg CVE） | MAJOR | 构建期图片管线，处理仓库自有 asset；不处理用户上传 |
| 3 | `swiper` <12.1.2 | critical | MAJOR | 不上线（见 §2.1） |
| 4 | `@babel/traverse` 等 babel‑6 家族 | critical | 随 `miniprogram-ci` 走 | **只在我们编译自己源码时运行**；威胁模型要求"恶意源码"，实际为零 |
| 5 | `rollup` <4.59.0 | high（路径穿越任意写） | auto | 构建期；需恶意 import |
| 6 | `vite` ≤6.4.3 | moderate/low（dev server `server.fs`） | MAJOR | **仅 `npm run dev` 存在**，不随包发版 |
| 7 | `axios`/`fast-uri`/`js-yaml`/`minimatch`/`brace-expansion`/`svgo`/`browserslist`/`image-size`/`follow-redirects` | high/mod | auto | 全是工具链传递依赖 |

**结论：真正需要"改代码 + 验证"的只有 `drizzle-orm`（+ `sharp`）。其余要么自动可修，要么属于构建期可接受风险，要么随 Taro 升级一次性消失。**

### 2.3 幽灵 manifest（放大告警的隐形来源）

仓库里有 4 份 lockfile，Dependabot 会把它们都当独立生态扫描：

| 路径 | 状态 | 处置 |
|---|---|---|
| `package-lock.json`（根） | 2798 包，唯一权威 | 保留 |
| `tmp/mini_runtime/package-lock.json` | **已被 git 跟踪**，78 包（jimp 图片脚本） | 删除（tmp 目录不应跟踪） |
| `prototypes/webgl-reveal/package-lock.json` | **已被 git 跟踪**，2 包（three 隔离原型） | 删除 + gitignore |
| `.opencode/package-lock.json` | 已 gitignore | 无需处理 |

### 2.4 可达性实证（不是推测）

从 `apps/server` 的**运行时**依赖出发做 BFS，7 条 critical advisory 对应的包**全部不可达**；把 devDependencies 一起算进来同样不可达。admin-client 运行时图同样全净。只有 mini-program 的 prod 图能到达 `@babel/traverse` 与 `swiper`，而这两者分别来自 Taro 构建工具链与 `<Swiper>` 的 H5 实现 —— 都不进微信上传包。

| 起点 | @babel/traverse | swiper | decompress | fast-xml-parser | form-data | protobufjs |
|---|---|---|---|---|---|---|
| server 运行时 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| server 运行时+dev | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| admin-client 运行时 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| mini-program 运行时 | **✓**（Taro 构建链） | **✓**（未引用） | ✗ | ✗ | ✗ | ✗ |

> 校验：同一算法对 `express` / `qs` / `drizzle-orm` 均返回可达，避免"全是 ✗"的假阴性。

## 3. 批次切分（4 个 wave，3 个可独立合并的 PR）

### W0 — 治理防线（0.5 天，PR #1）

| 任务 | 产出 | 验收 |
|---|---|---|
| W0.1 | `.github/dependabot.yml`：npm 生态、weekly、按 workspace 分组、`ignore` 掉 taro/react/three 的 major（避免噪音 PR 洪水） | 生效后第一轮 PR 全部是 patch/minor |
| W0.2 | `scripts/check/check-dependency-vulns.mjs` + `scripts/check/dependency-vuln-baseline.json`（棘轮，仿 `class-coverage-baseline.json` 模式）：`npm audit --json` 只对 **critical+high** 计数，比基线**新增**即失败 | 接入 `npm run guardrails`；故意新装一个高危包能复现 fail |
| W0.3 | 删除两份幽灵 lockfile，`.gitignore` 增加 `tmp/*/package-lock.json`、`prototypes/*/package-lock.json` | `git ls-files | grep -c package-lock` 返回 1 |
| W0.4 | 修正 `security-scan` skill 的失效路径（`scripts/check-guardrails.mjs` → `scripts/check/check-guardrails.mjs`；`docs/launch-risks.md` 不存在） | skill 引用可解析 |

> 关键设计：基线棘轮**只对"新增"失败**，不要求本批一次清零 —— 否则这个批次永远合不进去。（仓库已有 `class-coverage-baseline.json`、`check-budget-tiers` 两处同构先例。）

### W1 — 自动修复清扫（0.5 天，PR #1 或 #2）

- 执行 `npm audit fix`（**不带 `--force`**）。workspace 共享单一 lockfile，所以一次在根目录跑完、再按包逐条 review diff；不要 `--legacy-peer-deps`。
- 前置（2026-10-21 实测发现）：`@tarojs/plugin-framework-react` 与 `@tarojs/router` 原先浮动 `^4.2.0`，与其余精确钉在 `4.2.0` 的 `@tarojs/*` 冲突，导致**任何** `npm install` / `npm audit fix` 直接 `ERESOLVE`（peer 要求 `@tarojs/helper@4.3.0`）。已把两者钉为 `4.2.0`（与 lockfile 实际安装版本一致，零版本变化）。这意味着在修复前根目录的 `npm install <pkg>` 一直是坏的。
- 预期清掉：所有 `fixAvailable` 非 MAJOR 的项 —— server（`rollup`、`source-map-js`）、admin（`brace-expansion`、`browserslist`、`fast-glob`、`rollup`、`source-map-js`）、mini-program（`brace-expansion`、`browserslist`、`fast-glob`、`find-yarn-workspace-root`、`micromatch`、`rollup`、`source-map-js`），合计约 10 个唯一包 + 其传播节点。
- **硬规则**：任何把 `@tarojs/*` 或 `@tarojs/cli` 降级的建议一律拒绝（沿袭 `bc40e0ab8` 的既有决定）。
- 验收：server 12 → ≤6；admin 19 → ≤12；mini-program 27 → ≤20；三端 typecheck + server 测试全绿。

**W1 结果（2026-10-21 落地）**：根图 185 → 137 节点，critical 节点 47 → 10，runtime 门禁项 11 → 8，构建期上下文项 104 → 59。基线自动缩表清掉 `critical:@babel/traverse`、`high:browserslist`、`high:json5` 三条（`miniprogram-ci` 2.1.31 → 2.1.48 移除内置 babel-6 子树）。剩余 8 条 = Taro 链路 7 条（留给 W3）+ `drizzle-orm`（W2.1）。验证：三端 typecheck 全绿、`taro build --type weapp` 40.85s 成功、`verify:subpackage-styles` / `verify:flash-package` / `verify:upload-assets` / `check:package-size` 全 PASS、`npm run check:deps` 0 新增。

### W2 — 定向 major 升级（2 天，PR #2）

**W2 结果（2026-10-22 落地）**：

- **W2.1 `drizzle-orm` 0.39.1 → 0.45.4 落地**（`apps/server` + `packages/shared` 同步，`drizzle-kit` 保持 0.31.11）。这是本批次**唯一真实运行时风险**，门禁中 `high:drizzle-orm` 已自动缩表清除。
- **`drizzle-zod` 必须留在 0.7.x**：试过 0.8.3（其 peer 写 `zod ^3.25 || ^4`），`tsc` 直接崩掉 —— 0.8.3 的类型按 zod v4 的 `ZodType` 形状（`{out, in}`）声明，与仓库的 zod 3.25 classic 命名空间不兼容，`_definitions_extended.ts` 里 200+ 行 `createSelectSchema` 全部报 `_zod missing`。回退 0.7.1 后 server typecheck 立刻全绿。结论：**zod 4 迁移之前不要动 drizzle-zod**。
- **W2.2 `sharp` 0.34.5 → 0.35.5 落地**（mini-program devDependency，资产构建脚本）。冒烟：`sharp({create:8x8}).webp()` → vips 8.18.7 正常出图。engines 要求 node ≥20.9，本地 24.12 / CI node 20 均满足。
- **W2.3 `swiper` overrides 已尝试并回滚**：`@tarojs/components@4.2.0` 把 `swiper` **精确钉在 `11.1.15`（无 caret）**，加根 `overrides: {"swiper": "^12.1.2"}` 后 npm 不报错但也不生效；手动清 lock 条目再装，会得到「父包仍声明 swiper、lockfile 里没有任何 swiper 节点」的半坏状态（`npm ci` 会挂）。一个看起来在缓解、实际没生效的 override 比一条诚实的基线更危险，因此删掉 override，`swiper` 继续留在基线里等 W3。
  **2026-10-22 二次复核**：嵌套形式（`{"@tarojs/components": {"swiper": "^12.1.2"}}`）在 npm 11.6.2 上同样不生效 —— `npm install --package-lock-only` 返回 `up to date in 2s`，lockfile 里 swiper 仍是 11.1.15。npm 不会为了 override 重解析一个已经被精确钉死的传递依赖。结论：**不要再试 override**，这条路在本仓库无效。
- **W2.4 `vite`**：未动。`@tarojs/vite-runner` 仍锁 vite 4.x，升级会与 Taro 内部 runner 冲突 → 明确记录为已接受风险，留给 W3。
- **新 advisory 中途到达**：W1→W2 之间上游发布了 `lodash` 三条（代码注入 / 原型污染，`<=4.17.23` 全中且**无修复版本**），npm audit 把 critical 严重度传播到 `@tarojs/taro`。因此门禁项从 8 变 9（+2 新、−1 drizzle）。两条都写实 reason 后入基线，`@tarojs/taro` 的 reason 明确写了「不是独立 advisory，是 @tarojs/components + @tarojs/helper 的传播」。
- **验证**：`check:server` / `check:clients` 全绿；`npm run check:deps` → 9 gated / 9 baselined / 55 build-tool，0 新增；根图 137 → 134 节点。
- **运行时证据（2026-10-22）**：server 全量 `vitest run` → 4197 passed / 62 skipped（4260 测试，366 文件），唯一失败是 `guidanceRoutes.test.ts` 的 `withServer` 启动探测超时（并行负载下 10s 探针超时），单跑 8/8 通过 1.1s → 判定 flaky，非回归。另跑真实 DB ORM 冒烟（`validateDbSchema()` 136 表全部对齐 + select / `count(*)` 聚合 / leftJoin+orderBy+limit / 事务回滚）全部通过，证明 0.45.4 的标识符转义与查询构建在活库上正常。
- **已知副作用（可接受）**：npm 把 `drizzle-orm@0.45.4` 同时装在 `apps/server/node_modules/` 与 `packages/shared/node_modules/`（同版本两份，`npm dedupe` / `--install-strategy=hoisted` 都拒绝上提）。服务端产物把 `drizzle-orm` 标为 external、只内联 `@joyjoin/shared`，所以两份不共存于同一 bundle；且 drizzle 内部用 `Symbol.for` 全局符号，跨副本的对象识别仍然成立。留待 W3 一并整理。


原计划任务表（执行结果见上方）：

| 任务 | 动作 | 风险与验证 |
|---|---|---|
| W2.1 `drizzle-orm` 0.39.1 → 0.45.4 | server + shared 同步升级；核对 `drizzle-kit` 0.31.10 兼容性 | 全量 server 测试（支付/认证/匹配）；`db:verify` 指向 staging 克隆；重点回归 `lib/`、`repositories/`、迁移脚本 |
| W2.2 `sharp` 0.34.5 → 0.35.5 | mini-program 构建脚本 | 跑一次 `build:weapp` + 头像/图标生成脚本，比对产物尺寸 |
| W2.3 `swiper` `overrides` → `^12.1.2` | 根 `package.json` `overrides`（不动 Taro 版本） | 只影响 H5 组件实现，微信包不复用；H5 冒烟一次即回滚条件 |
| W2.4 `vite` dev 链 | 评估升级到 ≥6.4.4 | 若与 `@tarojs/vite-runner`（锁 vite 4.5.14）冲突则**明确记录为已接受风险**，留给 W3 |

### W3 — Taro 链路大版本升级（3–5 天，独立 sprint，PR #3）

**2026-10-22 复核：W3 已不产生任何安全收益，降级为「纯维护」，不再是本批次的安全动作。**

复核证据（注册表实测）：`@tarojs/components` 最新的 4.x 是 **4.3.0**，它依旧把 `swiper` 精确钉在 **11.1.15**（与 4.2.0 完全相同）；`@tarojs/helper@4.3.0` 依旧依赖 `lodash: ^4.17.21`，而 lodash 的三条 advisory 覆盖 `<=4.17.23` 且上游 **没有发布修复版本**（`fixAvailable: false`）。也就是说 4.2.0 → 4.3.0 这一跳清不掉基线里的任何一条：`critical:swiper`、`critical:@tarojs/components`、`critical:@tarojs/taro`、`high:lodash` 全部原地不动，`@tarojs/helper` 也仍在。

原计划里 W3 声称能清空 Taro 链路 + babel-6 + glob 家族 — 那部分在 W1 里已经通过 `miniprogram-ci` 2.1.31 → 2.1.48 达成（`@babel/traverse` / `browserslist` / `json5` 自动缩表）。剩余项只能在**上游先修**之后才会消失。

因此：W3 只在有真实维护动机（如 Taro 修了具体 bug）时排期；不要为了安全数字去升它。

- 前置：W0 的棘轮已上线（否则升级期间的临时回退会被门禁挡住）。
- 验证矩阵（缺一不可）：`npm run build:weapp -w mini-program` → `verify:subpackage-styles`（不得产生非空 `sub-common.wxss`）→ `check-compiled-package-source-size`（主包 <1856 KiB）→ WeChat 真机冒烟（首页/排桌/支付/破冰）→ 开发版上传失败即回滚。
- 明确不包含：`three`（WebGL 已隔离）、`react` 18→19。


### W4 — 收口（0.5 天，PR #3 附带）

- `docs/runbooks/dependency-security.md`：如何跑审计、如何加基线、如何判断"已接受风险"、Dependabot PR 处置流程。
- 已接受风险登记表（进 baseline JSON 的 `accepted[]`，每条要写：包、severity、为什么不修、何时复查）。
- 更新 `AGENTS.md` §7 Guardrails 清单，加入 dependency-vuln 棘轮一行。

**总计：约 4–6.5 个工作日，3 个 PR。**

## 4. 门禁与验收（批次级）

- AC1：`npm audit --omit=dev` 在 **server / shared 运行时图** critical = 0、high = 0（`drizzle-orm` 落地后达成）。
- AC2：棘轮门禁能挡住"新增 high/critical"，且对已有基线不误报。
- AC3：`git ls-files | grep package-lock` 只剩根 lockfile。
- AC4：全程未使用 `npm audit fix --force`；未发生任何 `@tarojs/*` 降级。
- AC5：server 全量测试绿；admin `typecheck` + `build` 绿；mini-program `build:weapp` + `verify:subpackage-styles` 绿。
- AC6：合并后 staging 部署 → 冒烟：登录、报名、支付、排桌、破冰各一次。
- AC7：bug 修复 commit 各自独立、可单独 revert（一个 wave 一个 commit，lockfile 变更与代码变更分离）。

## 5. 不做什么

- 不做 `npm audit fix --force` 的一键清零。
- 不升级 `three`、不升 `react` 18→19、不升 `express` 5.x（与本批次目标无关）。
- 不为"让数字归零"而引入 `overrides` 强行抬版本 —— 除 W2.3 的 swiper（已论证不随包发版）。
- 不在此批次内处理 CI 的 `npm ci --no-audit` 提速设置（保留，审计由独立 job 承担）。

## 6. 2026-11-20 补充：Dependabot 遗留告警的第二次清理

本节记录 DEP-SEC-1 之后的独立跟进（不是新的 wave）。触发条件：GitHub 上仍有 **89 条 open alert**（3 critical / 26 high / 48 medium / 12 low），其中大量是 Taro / miniprogram-ci / archived 工作区的精确锁版本造成的"结构性不可修"，少数是上一轮未覆盖的直接依赖。

### 6.1 本轮实际改动

| 位置 | 变更 | 目的 | 验证 |
|---|---|---|---|
| `apps/admin-client/package.json` | `vite ^5.4.21` → `^7.3.8` | 清 admin-client manifest 的 vite low 告警（6.4.4 才修复） | `typecheck` 通过；vitest 20 files / 171 tests；`build` ✓ 5.42s |
| `apps/mini-program/package.json` | `@babel/runtime ^7.24.4` → `^7.29.14` | 小程序运行时直接依赖，清 manifest 的 1 条 medium | `build:weapp` + `verify:subpackage-styles` 通过 |
| `apps/mini-program/package.json` | `@babel/core ^7.24.4` → `^7.29.6` | 清 1 条 low；`7.29.13` 已解析 | 同上 |
| `apps/mini-program/package.json` | `react-refresh ^0.19.0` → `^0.14.2` | 修复与 `babel-preset-taro@4.2.0` 的 `peerOptional ^0.14.0` 冲突（0.19.0 由 Dependabot 分组提交引入，`npm ls` 标 invalid，导致所有正常解析 ERESOLVE） | `npm ls --depth=0` 无 invalid/UNMET |
| root `package.json` | 保留 `overrides`：`@babel/plugin-transform-modules-systemjs ^7.29.4`、`follow-redirects ^1.16.2`、`joi ^17.13.9` | 三条 override 实际生效（解析为 7.29.8 / 1.16.3 / 17.13.9），清 1 high + 1 high + 1 high | `npm ci --dry-run` 通过 |
| root `package.json` | 删除无效 override：`qs ^6.16.1`、`@tarojs/plugin-doctor.glob 10.5.0`、`miniprogram-ci.request.form-data 2.5.6` | npm 11.6.2 从未重算这三条；强行重算会产生 invalid 树（见 6.2） | 最终 lock 由 `npm ci` 重建 |

清掉的告警（确定项）：`@babel/core`（low）、`@babel/plugin-transform-modules-systemjs`（high）、`follow-redirects`（high）、`joi`（high），以及 admin-client manifest 的 vite 条目（约 10 条 low）。**预计 10–15 条**会在下一次 push 后由 GitHub 重算关闭；Dependabot 不会因本地 lock 变更而自动重算。

### 6.2 npm 11.6.2 的 override 不重算问题（重要运维知识）

- 新增或修改 `overrides` 后，`npm install`、`npm install --force`、`npm install --package-lock-only` 均可能直接报 `up to date`，**不会**重新解析已存在的边。
- 只有 `npm update <package> --legacy-peer-deps` 会重算一部分边；但 `--legacy-peer-deps` 会忽略 peer 约束，本轮曾把 `@vitejs/plugin-react@4.7.0` 提升到根目录，而 `vite` 只存在于 `apps/admin-client/node_modules`，导致 `build` 报 `ERR_MODULE_NOT_FOUND: Cannot find package 'vite' imported from node_modules/@vitejs/plugin-react/dist/index.js`。
- 修复方式：从 lock 中删除 `packages["node_modules/@vitejs/plugin-react"]` 后执行**正常** `npm install`（不带 legacy 标志），让根 `vite 5.4.21` 回来供 hoisted plugin-react 解析；admin 构建仍解析自己的嵌套 `vite 7.3.8`。当前布局是"双 vite"：plugin-react 的运行时 import 走 5.4.21，admin 的 config/build 走 7.3.8。**不要删除根 vite 5.4.21**，除非同时把 plugin-react 嵌套到 admin。
- 结论：覆盖解析后必须用 `npm ci --dry-run`（或 `npm ci`）验证最终树；`--legacy-peer-deps` 只能作为诊断手段，不能作为常规安装方式。

### 6.3 `npm audit fix` 在本仓库不可用（硬规则升级）

`npm audit fix --dry-run` 报告 76 个受影响包（4 low / 31 moderate / 32 high / 9 critical）和 27 个 non-major 修复，但真正执行时：

- 移除 `@tarojs/plugin-framework-react`、`@tarojs/vite-runner`、`@vitejs/plugin-legacy`、mini-program 的 `vite 4.5.14`、`esbuild 0.18.20`；
- 把根 `vite 5.4.21` 降级到 `4.5.14`；
- 移除根 `glob 10.5.0`；
- 受影响包只从 76 降到 75。

已用 `/tmp/package-lock.pre-auditfix.json` + `npm ci` 完整回滚。**禁止在本仓库运行 `npm audit fix`**（不只是 `--force`）；修复必须逐包、可验证地进行。

### 6.4 仍然保留的告警（按归属）

| 归属 | 包 | 为什么不动 |
|---|---|---|
| Taro / H5-only | `swiper 11.1.15`（critical）、`@tarojs/components`、`@tarojs/taro`、`lodash-es`、`adm-zip 0.5.18`、`glob`、`minimatch`、`serialize-javascript` | `@tarojs/components` 精确锁 `swiper 11.1.15`，`@tarojs/plugin-platform-h5` / `@tarojs/taro-h5` 精确锁 `lodash-es 4.17.21`，`@tarojs/cli` 锁 `adm-zip ^0.5.12`；小程序编译为原生 `<Swiper>`，这些 H5 代码不随包发版。升级/降级 Taro 都禁止。 |
| miniprogram-ci 上传工具（dev-only） | `protobufjs 6.11.6`、`lodash 4.17.21`、`tmp 0.0.28`、`uuid 3.x`、`request 2.88.2`、`tough-cookie`、`decompress`、`got`、`phin`、`git-clone`、`lodash.template`、`qs 6.5.5` | `miniprogram-ci@2.1.48` 是当前最新版，精确锁上述版本；没有可升级的 patched 版本，降级 miniprogram-ci 会破坏上传链路。`request` 链的 `form-data` 必须是 `~2.3.2`，强行抬到 4.x 会让上传静默失败。 |
| archived 工作区 | `vite`（low）、`zod`（high） | `archived/workspaces/user-client` 不是 npm workspace，没有 lockfile，从未安装；仅 manifest 被扫描。是否删除该目录是独立的产品决策。 |
| 运行时 medium（不在 critical/high 棘轮内） | 根 `@babel/runtime 7.24.6`（miniprogram-ci 精确锁）、`esbuild 0.21.5`、`postcss-selector-parser 6.x` 等 | 棘轮只 gate critical/high；根 `@babel/runtime` 不随小程序发版（小程序用嵌套 7.29.14）。 |

`lodash` 的基线理由已同步更新：`4.18.1` 虽然存在，但 `miniprogram-ci@2.1.48` 精确锁 `4.17.21`，`@tarojs/helper` 的 `^4.17.21` 已被满足，npm 不会重算；强推 4.18.1 会产生 invalid 树，故维持基线。

### 6.5 本轮验证矩阵（2026-11-20）

- `npm ci --dry-run` → exit 0（最终 lock 可复现）。
- `npm ls --depth=0` → 无 invalid / UNMET。
- `npm run build -w @joyjoin/admin-client` → ✓ built in 5.42s。
- `npm run build:weapp -w mini-program` → exit 0；`verify:upload-assets` PASS（32 critical assets / 212 classified）；`verify:subpackage-styles` PASS。
- `npx vitest run`（server 定向：joinedEvents / joinedEventsRepoContract / entitlementMode / adminUserDetailContract）→ 4 files / 17 tests PASS。
- `npm run check:deps` → 4 runtime critical/high，4 baselined，37 build-tool，0 new。
- `npm run guardrails` → exit 0，零违规。

### 6.6 后续建议

1. Taro 升级单独立项（W3）：即使升到 4.3.0，swiper 仍锁 11.1.15、lodash 仍为 ^4.17.21，**不会清零**，不要把它当安全修复。
2. 追踪 `miniprogram-ci` 上游（lodash / @babel/runtime / tmp / protobufjs）与 `@tarojs/helper` 的 lodash 范围。
3. archived `user-client` 的 vite/zod 告警只能通过删除归档目录解决，按产品决策单独处理。
