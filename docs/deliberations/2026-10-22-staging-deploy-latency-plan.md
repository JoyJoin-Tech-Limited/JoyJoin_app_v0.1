# 缩短 staging 部署时长 — 计划（2026-10-22）

> 需求来源：用户 2026-10-22「start planning about shortening the staging deployment time, it seems to be taking too long but unnecessary」。
> 状态：**Phase 1 已实施（2026-10-22，见 §9）**；Phase 2（TCR）用户决定不做。All numbers below are measured on 2026-10-22（`gh run view --json jobs` + `--log-failed`）。

---

## 0. 结论先行

**今天的极端案例（run 39748385809，我的 `d0e2ffe18`）**：

| 阶段 | 起止（UTC） | 时长 |
|---|---|---|
| push → run created | — | 08:31:34 |
| quality gates（15 job，全绿） | 08:31:37 → 08:37:50 | **6m13s** |
| Build Staging Images（全绿） | 08:37:53 → 08:39:46 | **1m53s** |
| Staging Deployment **排队等 CVM 锁** | 08:39:46 → 09:09:37 | **29m51s（纯等待）** |
| Staging Deployment 实际执行 → stale 拒绝 | 09:09:37 → 09:10:04 | **27s（零交付）** |
| **合计** | | **38m30s，交付物 = 0** |

**根因不是「部署慢」，是「排队 + 空转」**。真正干活的部分（门禁 6m + 构建 2m）合计 8m13s；**78% 的墙钟花在等锁，最后 27 秒被 stale 守卫判定过期**——而 stale 判定本可以在第 1 秒就做出。

**五个时间黑洞（按今日占用排序）**：

| # | 黑洞 | 今日实测 | 代码位置 |
|---|---|---|---|
| 1 | **CVM 单锁被生产部署独占** | 30m | `deploy-staging.yml:177` / `deploy-production.yml:126` 共用 `joyjoin-cvm-remote`；另有 15+ 处同 group |
| 2 | **跨太平洋 registry pull** | 历史 26m16s（run 39397630921）、60m14s（run 39416432968） | `deploy-staging.sh:449-462`：3 次 × 8m/镜像，并行；`deploy-production.sh:479-480`：5 次 × 12m/镜像，**串行** |
| 3 | **workflow 级串行 + `cancel-in-progress: false`** | 22–27m 排队 | `deploy-staging.yml` workflow concurrency |
| 4 | **stale 守卫在拿到锁之后才判** | 等 30m 才拒绝 | deploy job 内第 1 步（`--log-failed` 实证） |
| 5 | **生产部署无上限重试**（它一慢就锁死全链） | 生产 job 40m+ in_progress | `deploy-production.sh:479-480` 最坏 ≈ 2h；`:490` on-box `--build` 兜底 |

**目标（验收线）**：
- p50「push → staging readyz 通过」：**38–68m → ≤ 10m**
- stale 候选拒绝：**29m → ≤ 60s**
- 生产部署 job p50：**40m+ → ≤ 15m**
- 零新增人工步骤；失败方向仍然 fail-safe（宁拒绝不误发）。

---

## 1. 实测基线

| run | 模式 | created→done | gates | build | deploy job | 结局 |
|---|---|---|---|---|---|---|
| 39397630921 | bundle | 35m28s | — | 2m3s | 09:10:32→09:36:48 = **26m16s** | ✅ |
| 39416432968 | bundle | 68m23s | — | — | 11:46:59→12:47:13 = **60m14s** | ✅ |
| 39741815677 | — | — | 07:37:49 起 | 07:46:32→07:49:47 | 08:17:02 才开始（等 27m） | ❌ stale（33s） |
| 39743876954 | — | 07:54:56 created | 08:17:38 启动（**等 22m**） | — | — | ❌ Server Tests |
| 39748385809 | GHCR | 38m30s | 6m13s | 1m53s | **等 29m51s + 27s** | ❌ stale |
| 39746650993（生产） | GHCR | 40m+ | skipped | 52s ✅ | **40m+ 仍在跑**（持锁元凶） | — |

补充事实：
- `STAGING_GHCR_ENABLED=true` 自 2026-10-22T07:27Z；**无任何 `TCR_*` 变量 → TCR 通道未启用**。
- 因此「GHCR 分钟级交付」**至今一次都没被验证过**——所有走 GHCR 的 run 都在 stale 步或排队里死掉。
- 锁是**双层**的：GitHub concurrency group + 远端 `flock /var/lock/joyjoin-cvm-remote.lock`（`deploy-staging.sh:39`、`deploy-production.sh:16`、`taro-weapp-build.yml:529`）。
- 小程序上传（`taro-weapp-build.yml:296` + `:528-530`）也抢同一把锁——一次上传会挡住一次部署。
- 生产 build 只需 52s（GHA 缓存热、GHCR push 成功）→ 生产慢的**不是构建，是远端 pull/切换**。

---

## 2. 根因分析（逐条）

### R1 — 锁的粒度是「整台 CVM」，不是「被保护的资源」
`joyjoin-cvm-remote` 保护的是**远端主机**，但实际需要互斥的只有「动 docker 镜像/容器」的动作。今天生产部署持锁 40+ 分钟，staging 完全饿死；反过来 staging 26–60m 的 pull 也会饿死生产。小程序上传（不碰 docker）却也要排队。

### R2 — 新鲜度判定放在锁内，方向反了
stale 守卫要回答的问题（"candidate 还是 main 吗？"）**不需要锁**——它是一次 `git fetch` + 字符串比较。放在锁内导致：候选在排队期间过期 → 仍然要排满 30m → 再花 27s 拒绝。正确顺序是**先判后排队**。

### R3 — 跨太平洋 pull 是真正的「慢」
`docker pull ghcr.io/...` 从 CVM（腾讯云，上海/广州）拉 GitHub Container Registry，跨太平洋；脚本自己都写了「Cross-Pacific registry pulls can stall on a single large layer」。3×8m（staging）/ 5×12m（生产）的重试预算正是为这种 stall 设计的——**预算本身就是慢的证据**，而且最坏情况生产可达 2 小时。

### R4 — workflow 级串行把门禁也串起来了
`deploy-staging.yml` workflow concurrency `cancel-in-progress: false` → 每次 push 全量跑 15 个 gate job（~6m）。今天 4 次 push 造成 20m+ 积压，而其中 3 次的产物最终都没部署（过期）。

### R5 — 部署 job 超时上限过宽，失败代价高
staging deploy job `timeout-minutes: 140`、SSH `command_timeout: 60m`。**慢 = 占锁 = 饿死别人**，但没有「超时即释放」以外的保护。

### R6 — 生产兜底路径是 on-box 编译
`deploy-production.sh:490` `docker compose up -d --build --no-deps` 在 CVM 上编译——一旦 registry 路径失败就走这里，把 2g 内存限制的共享主机压满，进一步拖慢一切。

---

## 3. 杠杆清单

> 收益 = 相对今日实测的墙钟节省；成本 = 工程/运维工时；风险 = 引入事故的概率。

### L1 · 开通 TCR（同城 registry）——**最高 ROI**
**做什么**：在腾讯云开通 TCR（容器镜像服务，与 CVM 同地域），建 namespace，配 `TCR_REGISTRY` / `TCR_NAMESPACE` 变量 + `TCR_USERNAME` / `TCR_TOKEN` 密钥 + `STAGING_TCR_ENABLED=true`。代码**已经写好**：`deploy-staging.yml` 的 "Determine staging image delivery path" 已是 `tcr > ghcr > bundle` 优先级，pull 失败自动回落 GHCR。
**收益**：pull 26m → **预计 1–2m**（同城内网带宽），且生产同样受益（可加 `PROD_TCR_ENABLED`）。
**成本**：0.5–1 天运维（TCR 实例 + 凭据 + 首次推送验证）。**费用待验证**（个人版免费额度是否够 API/Admin 两镜像待查）。
**风险**：低——回落链已有；`tcr > ghcr > bundle` 的优先级若 TCR 凭据错误会在首次 pull 时明确报错。
**验证**：一次真实 staging 部署，Build 日志出现 `Registry delivery mode: tcr`，deploy job 墙钟 < 5m。

### L2 · 拆锁：staging / production / 非 docker 任务各自成组
**做什么**：
1. `deploy-staging.yml:177` → `group: joyjoin-cvm-staging`；远端 flock 文件改 `/var/lock/joyjoin-cvm-staging.lock`（`deploy-staging.sh:39` 同步改）。
2. `taro-weapp-build.yml:296/528-530` → 去掉 CVM 锁（它只跑 `miniprogram-ci upload`，不碰 docker；保留其自身的远端目录清理 trap 即可）。
3. 一次性迁移类 workflow（`staging-flash-*`、`repair-*`、`staging-cleanup-single-test`、`setup-db-backup`）保留原锁——它们本就不该与部署并行。
**收益**：消除今日 30m 等待；同时生产不再被 staging 的 26–60m pull 挡住。
**成本**：~1 小时改 3 个文件 + 一次 staging 验证。
**风险（必须处理）**：**两个部署并行时会互相 prune**——`deploy-staging.sh:441-443` 与 `deploy-production.sh:29-33` 都执行 `docker builder prune -af` / `docker image prune -af`（无年龄过滤）。A 刚 pull 完镜像、尚未 `up`，B 的 prune 可能把 A 的镜像删掉 → A 的 `--no-build` 启动失败。
**缓解（与本杠杆同批实施）**：两处 prune 改为**年龄过滤 + 排除在用镜像**：`docker image prune -a --filter "until=24h"`；或更保守——只在磁盘 <10% 余量时 prune，且用 `--filter "until=6h"`。这是拆锁的**前置条件**，不是可选项。

### L3 · 新鲜度判定前移（拆出无锁 preflight job）
**做什么**：把 deploy job 的第 1 步（`git fetch` + `verify-deployment-freshness.mjs`）抽成独立 job `deploy-preflight`（**不挂任何 concurrency group**），`deploy-staging` 加 `needs: [build-images, deploy-preflight]`。锁内的 stale 检查保留为二次防线（廉价）。
**收益**：stale 候选 29m → **≤ 60s** 拒绝；释放的锁槽位不再被浪费。
**成本**：~30 分钟改 workflow。
**风险**：低（纯前移判定，锁内仍有第二道）。

### L4 · 门禁与部署解耦：`cancel-in-progress` 只作用于门禁
**做什么**（两选一，建议 A）：
- **A（推荐，结构清晰）**：workflow 级 concurrency 移除；`quality-gates` job 挂 `group: joyjoin-staging-gates-${{ github.ref }}` + `cancel-in-progress: true`（新 push 立刻杀掉旧门禁）；`deploy-staging` 保持 `joyjoin-cvm-*` + `cancel-in-progress: false`。
- **B（最小改动）**：workflow 级 `cancel-in-progress: true`，但给 deploy job 单独挂不取消的 group。风险是可能取消正在执行的部署——**不推荐**。
**收益**：今日 20m+ 门禁积压 → 只剩最新一次（~6m）。
**成本**：~20 分钟。
**风险**：A 之下两次 run 都可能到达 deploy；旧的会在 preflight（L3）被秒拒。

### L5 · 同 SHA 门禁复用（staging 版 `check-prior-gates`）
**做什么**：staging 也加一个 `check-prior-gates` 前置 job：同 SHA 已有成功的 `quality-gates` 结果则跳过 11 个重 job。模式与 `deploy-production.yml` 现有实现一致（生产就是这么省时间的）。
**收益**：重复 push 同一 SHA（retry、rebase 后重跑）从 6m → ~0。
**成本**：~1 小时（抄生产实现）。
**风险**：低；注意 `workflow_dispatch` 手动重跑时不要复用（保持强制全跑）。

### L6 · 收紧生产部署的重试/兜底预算（它正在锁死全链）
**做什么**：
1. `deploy-production.sh:479-480`：`retry_command 5 15 timeout 12m docker pull` → `retry_command 2 15 timeout 5m`（配 L1 之后单次 pull 应 < 2m；5×12m 是为跨洋 stall 设计的）。
2. `:490` on-box `--build` 兜底：加显式告警 + 在 L1 生效后改为**默认禁用**（env 开关 `PROD_ALLOW_ONBOX_BUILD=false`），避免 2g 主机被编译压满。
3. `:494` granite-embedding `up -d --build`：确认是否每次都在编译；若是，改为「镜像存在则 `--no-build`」（staging 脚本已有这个模式，`deploy-staging.sh:886-897`）。
**收益**：生产 job 40m+ → **≤ 15m**，锁占用同步下降。
**成本**：~1 小时 + 一次生产部署验证（低峰）。
**风险**：中等——生产脚本改动需谨慎；建议先只做 (1) 与 (3)，(2) 留到 L1 验证后。

### L7 · 收紧超时上限，让「慢」早失败
**做什么**：`deploy-staging` job `timeout-minutes: 140 → 30`；SSH `command_timeout` 相应对齐（60m → 25m）。生产 job 45m → 30m。
**收益**：异常情况下锁的占用上限从 140m 降到 30m。
**成本**：5 分钟。
**风险**：若 L1 未落地而 pull 真的需要 26m，30m 上限会误杀 → **本项排在 L1 之后**。

### L8 · 可观测：把「push → readyz」写进 job summary
**做什么**：deploy job 末尾输出一张表：排队时长（created→job startedAt）、pull 时长、切换时长、健康检查时长、总墙钟；写入 `$GITHUB_STEP_SUMMARY`。
**收益**：以后任何一次变慢都能一眼定位是哪一段，不用像今天这样翻日志拼时间戳。
**成本**：~1 小时。
**风险**：无。

---

## 4. 实施顺序

### Phase 1 — 低风险、零基础设施（可当天完成，预计 staging p50 → 8–10m）
1. **L3** 新鲜度前移（preflight job）
2. **L4** 门禁 cancel-in-progress（方案 A）
3. **L2** 拆锁（**含 prune 年龄过滤这一前置条件**）
4. **L7** 收紧超时（与 L1 同批上线，见风险）
5. **L8** 观测表

预期：今日案例 38m30s → **约 7–9m**（6m 门禁 + 2m 构建 + 秒级判定），且不再有 30m 排队。

### Phase 2 — 需要运维/凭据（本周，预计 staging p50 → ≤ 5m）
6. **L1** 开通 TCR（**最高 ROI**；staging 先开，生产随后）
7. **L5** 同 SHA 门禁复用
8. **L6** 生产 pull 预算收紧 + granite 免编译

### Phase 3 — 可选
9. 生产也走 TCR（`PROD_TCR_ENABLED`）
10. 门禁 job 合并（15 → 8 个）：`lint-*` 四合一、`typecheck-*` 四合一，靠 turbo 缓存；预计 6m → 3m
11. 评估 `build-mini-program` 与 `taro-weapp-build` 的重复构建

---

## 5. 验收与测量

**指标（每个都可在 `gh run view --json jobs` 里算）**：
| 指标 | 现在 | 目标 |
|---|---|---|
| push → staging readyz 通过（p50） | 38–68m | ≤ 10m（Phase 1）→ ≤ 5m（Phase 2） |
| stale 候选拒绝耗时 | 29m | ≤ 60s |
| deploy job 排队时长（created→startedAt） | 30m | ≤ 1m |
| 生产 deploy job 墙钟 | 40m+ | ≤ 15m |
| 锁占用上限（异常时） | 140m | 30m |

**验证脚本（复用即可）**：
```bash
gh run view <id> --json createdAt,updatedAt,jobs \
  --jq '{total: ((.updatedAt|fromdate) - (.createdAt|fromdate)),
         jobs: [.jobs[] | {name, d: (((.completedAt//.startedAt)|fromdate) - (.startedAt|fromdate))}]}'
```
Phase 1 上线后需连续观察 **3 次**真实 push 的 staging run，全部满足目标才算达标。

---

## 6. 风险与回滚

| 风险 | 触发条件 | 缓解 | 回滚 |
|---|---|---|---|
| 拆锁后两个部署并行 prune 互删镜像 | L2 上线但 prune 未加年龄过滤 | **同批实施年龄过滤**（硬前置） | 恢复共享 group（1 行） |
| 门禁 cancel 掉有用的 run | 连续 push | 只取消 gates，不取消 deploy | 恢复 `cancel-in-progress: false` |
| 超时收紧误杀慢 pull | L1 未生效 | L7 排在 L1 之后 | 改回 140m |
| TCR 凭据错误导致部署失败 | L1 首次上线 | `tcr > ghcr > bundle` 自动回落（代码已实现） | `STAGING_TCR_ENABLED=false` |
| 生产脚本改动引入事故 | L6 | 分步：先 (1)(3)，(2) 延后；低峰窗口执行 | git revert 脚本 |

**共同原则**：所有改动都是 workflow/脚本层，**不触碰应用代码**；失败方向保持 fail-safe（宁可拒绝部署，不误发旧版本）。

---

## 7. Out of scope

- 不改应用代码、不改 `docker-compose*.yml` 的服务定义
- 不动 CVM 规格/扩容（若 TCR 后仍需扩容，另立项）
- 不改门禁的**内容**（只改并发/复用策略）
- 不做蓝绿/金丝雀部署架构（当前 staging 单实例切换已够用）
- 不重构 `deploy-*.sh` 的整体结构（只做预算与 prune 的定点修改）

---

## 8. 待决策（2026-10-22 已决，保留原文备查）

| # | 决策 | 结论 | 备注 |
|---|---|---|---|
| 1 | TCR 是否开通 | **不开**（用户 2026-10-22） | 只做 Phase 1；staging 继续走 GHCR（`STAGING_GHCR_ENABLED=true`，无 `TCR_*`）。若日后拉取仍慢再评估。 |
| 2 | Phase 1 是否现在实施 | **实施**（用户 2026-10-22「就做 phase 1 吧，够了」） | 已落地，见 §9。 |
| 3 | 生产部署预算收紧（L6）的窗口 | **未排期** | 仍需一次低峰期真实生产发布验证；Phase 1 已先把生产侧的 prune 改成带年龄过滤（并行运行安全前置），预算本身未动。 |


---

## 9. Phase 1 实施记录（2026-10-22）

用户决定：**只做 Phase 1（L2/L3/L4/L7/L8），TCR（Phase 2）不做**。改动全部在 workflow / 部署脚本层，零应用代码。

### 9.1 改动清单

| 杠杆 | 文件 | 改动 |
|---|---|---|
| L3 新鲜度前移 | `.github/workflows/deploy-staging.yml` | 新增 job `deploy-preflight`（无 needs，timeout 5m，checkout + `scripts/verify-deployment-freshness.mjs`）：陈旧 commit 约 10s 被拒，不再烧完 6m 门禁 + 2m 构建才拒绝。原「build 前闸」与「锁内二次闸」保留（defence in depth）。 |
| L4 门禁可取消 | `.github/workflows/deploy-staging.yml` | 删除 workflow 级 `concurrency: joyjoin-staging-${{ github.ref }}`（原 cancel-in-progress: false → 每次 push 要排上一整个 run 的 gates+build+queue）。`quality-gates` job 挂 `joyjoin-staging-gates-${{ github.ref }}` / `cancel-in-progress: true`；`deploy-staging` 保持不取消。 |
| L2 拆锁 | `.github/workflows/deploy-staging.yml` | `deploy-staging` 的 concurrency group 由 `joyjoin-cvm-remote` → **`joyjoin-cvm-staging`**（queue: max / cancel-in-progress: false）。 |
| L2 拆锁（脚本） | `deployment/scripts/deploy-staging.sh` | 远端 flock 由 `/var/lock/joyjoin-cvm-remote.lock` → `/var/lock/joyjoin-cvm-staging.lock`（`STAGING_LOCK_FILE`，可用 `JOYJOIN_STAGING_LOCK_FILE` 覆盖）。 |
| L2 拆锁（脚本） | `deployment/scripts/deploy-production.sh` | 保留 remote 锁；`reclaim_unused_docker_data()` 两处 `docker image prune -af` → `--filter "until=24h"`。 |
| L2 prune 安全（硬前置） | `deployment/scripts/deploy-staging.sh` | registry 路径内的 `docker image prune -af` → `--filter "until=24h"`。原因：拆锁后 staging 与 production 并行运行，无条件 `-af` 会删掉刚拉取、尚无容器的生产镜像。 |
| L2 拆锁（上传） | `.github/workflows/taro-weapp-build.yml` | 上传 job 退出 `joyjoin-cvm-remote` → `joyjoin-weapp-upload`；远端 flock 三行从 `miniprogram_ci_upload` 的 SSH 链中删除（上传不碰 Docker 与部署目录）。 |
| L2 拆锁（staging 运维） | `staging-cleanup-single-test.yml`、`staging-flash-bootstrap.yml`、`repair-staging-users-phone-unique.yml`、`staging-flash-{parallel-universe,story-v2,manual-hold}-migration.yml`（共 6 个） | group → `joyjoin-cvm-staging`；远端 flock → `/var/lock/joyjoin-cvm-staging.lock`（这些 workflow 只操作 `postgres-staging` / `joyjoin-api-staging`）。 |
| L7 超时收紧 | `.github/workflows/deploy-staging.yml` | `deploy-staging` job `timeout-minutes: 140 → 75`（GHCR 分钟级 + bundle 长尾 ~26–60m + 远端脚本自限 35m；未开 TCR 故不收到 30m）。 |
| L8 分段耗时 | `.github/workflows/deploy-staging.yml` | `Mark deploy job start` / `Mark deploy switch complete` 两个 epoch 标记 + `Deployment timing summary`（`if: always()`）向 `$GITHUB_STEP_SUMMARY` 输出 Transfer+switch / Post-switch verify+notify / Deploy job total 三段秒数。 |

**仍持 `joyjoin-cvm-remote` 的（有意保留，均为 host 级/生产）**：`deploy-production.yml`、`init-cvm-postgres.yml`、`setup-db-backup.yml`、`setup-cdn-server.yml`、`upload-cdn-assets.yml`。

### 9.2 验收方法

1. push 后观察新 staging run：`deploy-preflight` 应最先完成（~10s）；若 commit 陈旧应在此被拒。
2. **首个真正验证 GHCR 交付的 run**（此前所有 run 都在 freshness 步被拒，`delivery-mode` 从未被评估）：看 `Determine staging image delivery path` 输出 `registry_active=ghcr`，并记录 `Staging Deployment` 实际执行时长（预期分钟级，替代 bundle 的 26–60m）。
3. 读 `Deployment timing summary`（job summary）记录分段基线，写入本节。
4. 反向验证：连续 push 两次，确认旧 run 的 gates 被 cancel、deploy job 不被 cancel。
5. 回滚：`git revert` 单个 commit 即可（所有改动都是 workflow/脚本层）。
