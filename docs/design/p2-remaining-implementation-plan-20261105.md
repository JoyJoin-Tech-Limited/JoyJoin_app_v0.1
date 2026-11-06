# P2 余项执行计划草案

- 日期：2026-11-05
- 状态：UI/UX designer 方向 **APPROVE**；Momus 两项剩余执行前置（Events DTO/服务端分桶数据、通知已读生命周期）已写入 §3/§4；尚非最终渲染/真机批准
- 范围： gathering-room 已移除删除候选后，剩余 P2 工程项 + 三项产品/商业实验
- 原则：先清理“维护成本”，再改“信息架构”，最后做“商业实验”。不为数量目标新增页面/组件/flag。

---

## 0. 总优先级

| 波次 | 目标 | 项 | 为什么先做 |
|------|------|----|------------|
| 0 | 先决决策 | alang/config+debug QA 裁决、center-hub 路由语义、通知映射矩阵、庆祝表面清单、teaser 提醒真伪 | 这些不定，后续 Sprint 不可执行 |
| 1 | 低风险工程 | toast 生产试点、teaser copy-only 测量；alang/config+debug 仅在 QA 裁决后处理 | 先小步验证，不把迁移/删除混成低风险 |
| 2 | 信息架构收敛 | `center-hub` 复用 Events inbox 层级并默认「进行中」、通知列表按精确矩阵深链 | 不改 tabBar，不制造重定向空屏或通知死端 |
| 3 | 产品/商业实验 | 仅注册成功庆祝收敛与 teaser 测量；订阅 upsell 移出 P2 | 庆祝与订阅实验不得共用同一支付 cohort |

---

## 1. `alang/config` + `alang/debug` —— 同一 QA 裁决，不先拆

### 当前状态
- `alang/debug` 的「开始新一轮」会启动 `alang/config`，两者耦合，不能只删 config。
- config 不只是测试点编辑器，还承载 mock GPS、地图/地理编码、步行路线、任务启动、进度恢复/重置等能力。
- 因此迁入 admin 是独立的跨 workspace Tier-2 功能（RBAC、audit、API、后台页面），不是“低风险删除”。

### 提案
- 先由指定 QA owner 做能力对等清单：mock GPS、force node、reset、两点配置、恢复、任务启动。
- 二选一：
  1. **删除两者**：测试 owner 书面确认所有能力不再需要；
  2. **迁 admin**：另起完整迁移 Sprint，包含后端接口、权限与审计，不在本 P2 低风险波次内。
- 在裁决前，P2-S1 不放 config/debug 删除或迁移。

### 验收
- 有能力对等清单与 QA owner 书面决定。
- 若删除：两页、路由、分包声明及互相引用一起清理。
- 若迁移：另有 admin/API/RBAC/audit 验收，不在本文宣称完成。

---

## 3. `center-hub` —— 复用 Events inbox 层级，默认「进行中」

### 当前状态
- `center-hub` 与 `events` 都在承载“我的局”；Events 当前只有「待参加 / 已完成」，center-hub 使用未分段的 joined-events 列表。
- tab 中心按钮仍需保留，`wx.switchTab` 依赖 `tabBar.list` 中的 `centerHub`。
- **当前 DTO 不能直接推出三桶**：`JoinedEventSummary` 没有 payment/refund/出席行动/通用 `actionRequired` 字段，服务端列表还会排除 `matchStatus='unmatched'`。因此“未成行退款进已结束”等规则目前缺数据；先缩到现有 DTO 能表达的语义，或另加 server/shared-contract 子任务，不能直接只在客户端分桶。

### 路由决定（锁定）
- **首选不做 loader→redirect**：`center-hub` 仍是真实 destination，复用 Events inbox 的内容层级，但初始选中「进行中」，中心按钮保持真实 selected 状态。
- 复用的是 inbox 层级与分段数据，不是把整个 Events 页面副作用一并搬入：不自动触发 Events 的 mark-read，不重播 first-event hero。
- 若后续改成 shortcut，必须单独说明 `switchTab` 不能携带 segment query，并用一次性 out-of-band entry-state 在 `useDidShow` 消费；不得覆盖用户手动分段或返回时的滚动位置。

### 分段语义（写入 `eventPartition.ts` 前先列 fixture）
- **进行中**：待支付/待确认、排桌中、已排桌但仍需出席/场地动作、活动当天或进行中；需要用户当前关注。
- **待开始**：已确认且当前无需行动的未来活动。
- **已结束**：完成、取消、归档、未成行退款或已过期；terminal 状态只能进这一桶。
- 每条记录只能进一个桶；缺日期、跨天时区、取消/未成行、部分数据必须有 fixture。
- **合同前置条件**：若要保留上述完整三桶语义，必须先在 `packages/shared` DTO 与 server joined-events 查询中明确支付/退款/出席行动或统一 `actionRequired` 字段，并处理 unmatched 行的可见性；同时补 server 测试与 shared fixture。否则 P2-S2 只能采用现有 DTO 可表达的简化分桶，不能把未成行/退款规则写成已实现。
- Profile 的下一场行仍独立存在，不宣称“全站只此一处”；本项只消除 center-hub 与 Events 的重复列表。

### 非目标
- 不改 tabBar、匹配、支付、Profile 下一场行。
- 不新增第四个局详情页。

### 验收
- BEFORE/AFTER：冷启动、手动切 tab、进行中 0/1/多场、返回栈、手动分段后再次点中心按钮。
- 中心按钮 selected、徽标、动态文案与下一动作保持；无 event 双桶、无白屏/redirect 空屏。
- 明确 `ui-layout-audit` / `frontend-design-audit` / `user-satisfaction-audit` 的基线文件与对比结果；真机/DevTools 后再验收。

---

## 4. 通知列表 —— 精确类型矩阵 + 可点深链

### 当前状态
- `pages/notifications` 列表行基本不可点；通知生产端的 `relatedResourceId` 并不总等于 eventId，不能凭类型名猜目标。
- 现有页面在 unmount 时会把 `activities` / `discover` 类别批量标已读；按类别 read endpoint 还排除 `system`。若改成单行已读，这些行为必须先重新定义，否则“跳转失败仍 unread”会在返回/unmount 时被旧逻辑覆盖。

### 合同前必须锁定的映射矩阵
未列出的类型一律 read-only，不新增猜测性跳转。

| 类型 | ID 家族 | 目标与确定性 fallback | 已读/可点语义 |
|------|---------|-----------------------|---------------|
| `match_success` | `relatedResourceId = groupId` | `/pages/pool-group-detail/index?groupId=…`；group 不存在时回 Events，不去 matching-status | 可点 |
| `feedback_invite` | poolId | 仅当服务端 feedback state 为 open + eligible：`/pages/event-feedback/index?id=…`；否则 `/pages/event-detail/index?id=…` | 可点 |
| 场地/时间更新 | 先核对是 poolId、groupId 还是 blindBoxEventId，再 canonicalize | 未核对前不得统一写死 event-detail | 待矩阵确认 |
| `seat_vacated_group_notice` | 无 resource id | 不跳转 | read-only，无 chevron/haptic/toast |
| 订阅/支付类 | 不自动等于 rewards/invite 目标 | 先核对 ID 与服务端意图；未确认前 read-only | 待矩阵确认 |
| system / 未知 | 无可靠资源 | 不跳转 | read-only，无 chevron/haptic/toast |

### 行与已读行为
- 可点行：整行一个动作、尾部 chevron、pressed 态、`role='link'` 与可读 label；信息行不伪装成按钮。
- 点击成功被路由接受后，才把该行标为已读并同步 badge；跳转失败保持 unread，不影响其他行。
- 需要 per-item read 时，后端新增或复用等价的 `POST /api/notifications/:id/read`（实现前核对现有能力），并同步列表 cache；不能继续只调用“按类别全读”的旧接口却假装单行已读。
- **已读生命周期前置条件**：明确 unmount bulk-mark 是删除还是保留；若采用 per-item read，默认移除/停止会覆盖单行状态的批量 unmount 标记。`system` 与未知 read-only 行也必须有确定的生命周期：要么 per-id read 能力覆盖它们，要么明确不计入 unread badge，并给出对应 badge 清理规则；不能留下“永远不可读但永远计未读”的行。
- 返回保留列表、已读状态与滚动位置；未知/失效资源用确定性 fallback，不白屏、不循环。

### 验收
- 矩阵逐行有 fixture：有 ID、缺 ID、资源失效、错误 ID 家族。
- 可点行跳对目标；信息行无点击反馈；失败导航仍 unread；返回状态一致。
- 必须有“失败导航 → back/unmount”fixture，证明旧批量已读逻辑不会把该行或无关行误标已读；system/未知行的未读计数与清理路径也有 fixture。
- 真机/DevTools 录制 tap → destination → back。

---

## 5. Toast 封装与渐进迁移

### 当前状态
- 全仓搜索约 184 处只是估计，包含测试/注释；先用扫描器生成精确 baseline，不把数量当事实。
- 目标是统一语义与默认行为，不是发明一套品牌 toast overlay。

### 提案
- 新增 lib 层 **native-toast adapter**：保留 `Taro.showToast` 的 Promise/await 行为与 options，复用既有 `TOAST_*` 常量，统一 neutral/success/error 语义、默认时长、长中文与连续触发的去重/覆盖规则。
- 先选一个真实生产调用点做 pilot，证明封装被使用，而不是新增无人调用的工具。
- 触碰文件必须不再新增裸 `Taro.showToast`；若接受这条规则，touched-file ratchet 就不能只写“可选”。
- 原生 `wx.showToast` 单独列范围，不混入本次；表单阻断错误仍用内联错误，不用 toast 代替；注册成功仪式不再叠加 toast。

### 验收
- adapter 有 contract test（options、await、时长、icon、异常语义）。
- pilot 页面真机/DevTools 验证连续触发与长中文不截断、不叠层。
- 扫描 baseline 落盘；只拦新增/触碰文件，不一次性追旧账。

---

## 6. 产品/商业实验包

### 6.1 庆祝机制收敛（仅注册成功，不全站庆祝）

**当前状态**：共享 `RegistrationSuccessCeremony` 已存在并已被免费/付费报名复用，现有 variant 是 `standard | paid`，不是 `paid/free/first`。`RitualCelebrationOverlay` 因 `PAYMENT_RITUAL_V2_ENABLED=false` 不可达，不纳入用户实验。

**提案**：
- 范围限定为**注册成功这一刻**：保留一个 ceremony 骨架，`standard | paid` 继续表达交易形态；`first` 是“首次活动”里程碑维度，可叠加，不与 paid/free 互斥。
- 先盘点可达表面再决定折叠：BlindBoxLifecycleFlow、payment-verification hero、Events first-event hero、center-hub flow。支付验证保持安静，不在验证、列表、profile archive 重播首次成功。
- 矩阵必须覆盖：首次/回访 × 付费/免费/权益；每个表面最多一个 hero、一个情绪峰值、一次 haptic、一个主 CTA。
- 回滚用现有 flag/灰度配置或单 PR revert；不能只写“恢复旧文件”充当运行期回滚。

**衡量**：
- 先给 baseline 窗口、cohort、最小样本、非劣阈值、数据源与 7/30 天观察 owner/date；没有这些就只能称 visual QA，不能称 A/B。
- 指标：注册/支付完成、首单→第二单 7/30 天、退款/客服困惑；不因“收敛庆祝”而重播首次里程碑。

### 6.2 街头盲盒 teaser 策略

**当前状态**：`pages/alang/teaser` 已是静态「内测中」页面，Discover 卡与 banner 有曝光/点击埋点；问题不是“没有诚实页面”，而是页面仍可能承诺“正式上线第一时间告诉你”，却没有提醒交付能力。

**提案**：
- P2 只做 **copy-only + 测量**：若没有真实提醒 owner/授权/发送链路，就移除提醒 CTA/承诺，改成中性的 unavailable 文案；不伪装“即将开放”。
- 真正的可预约提醒（存储、授权、模板、发送、隐私、QA）另起 full-stack 计划，不在本 P2 内。
- 测量按 surface 分开：Discover 卡与 promo variant D 各自 CTR = 有效点击 / 有效曝光，分受众与城市；写清基线窗口、最小样本、数据不足处理和 decision owner。
- 若决定删除，必须覆盖 promo variant D、AlangDiscoverCard、arrival-guidance street row、teaser route/page 及 always-visible 入口逻辑，而不是只删一个页面。

**验收**：无虚假提醒承诺；teaser 不抢可报名活动主 CTA；测量报表能判定保留/删除，而不是只看两周总点击。

### 6.3 结算页订阅升级 —— 本 P2 完全不做

**当前状态**：`checkoutSubscriptionUpsellEnabled` 已接线但默认关闭。

**P2 决定**：
- 不开启 `checkoutSubscriptionUpsellEnabled`，不在首单支付前推月卡。
- 本计划也**不新增**支付成功后/第二场后的 upsell 表面；那属于独立 payment/entitlement 实验，需单独商业 owner、Harness 与合同。
- 庆祝实验与订阅实验不得在同一支付 cohort 并行。

**商业依据校正**：首单在 WELCOME20 后是 ¥68，不是 ¥88；六连局 ¥370（¥61.7/场）；月卡 ¥98/6 场（名义 ¥16.3/场）。¥50 邀请奖励只是单一渠道成本，不等于总 CAC。当前订阅 gate 不等于已强制六场消耗，¥16.3 只是名义价格，不是已实现单座收入；真实到场、退款、单座成本与付费 CAC 均待验证。

---

## 7. 拆包建议

| Sprint | 项 | 前置条件 |
|--------|----|----------|
| P2-S0 | alang/config+debug 裁决、center-hub 路由/分段、通知矩阵、庆祝表面清单、teaser 提醒真伪 | 对应 owner 书面确认，未决不得开工 |
| P2-S1 | toast 生产试点 + teaser copy-only 测量 | toast adapter contract test；teaser 无提醒交付则不承诺 |
| P2-S2 | center-hub 复用 Events inbox、默认「进行中」 | 路由与 `eventPartition` fixture 先锁定 |
| P2-S3 | 通知深链与 per-item read | 精确类型/ID/fallback/read 矩阵先锁定 |
| P2-S4 | 仅注册成功庆祝收敛 | 与订阅 upsell 分开；先 baseline/cohort/样本/回滚，再灰度 |
| 独立实验（非本 P2） | 订阅 upsell、alang/config 迁 admin、真实 teaser 提醒 | 各自新 Sprint/Tier、商业或 QA owner |

---

## 8. P2-S0 决策已接受（2026-11-05）

用户已接受全部推荐决策：

1. **alang/config+debug**：本批保留，不删除、不迁 admin；等待 QA owner 完成能力对等签字。
2. **center-hub**：本批仅用当前 DTO 做最小三桶工作，不扩 server/shared-contract；不实现当前数据无法可靠判断的 action-required 状态。
3. **Notifications（下一实现优先）**：新增 per-ID read endpoint；仅在导航被系统接受后标记该条已读，失败返回保持未读。移除通知页及相关入口的 unmount 自动已读；不可导航行继续只读、无 chevron/haptic/toast；保留显式 category mark-all 作为 badge 清零路径。
4. **Celebrations**：先做当前状态清单与 visual QA，不做无 baseline 的 A/B。
5. **alang teaser**：保留静态内测页与测量，不做提醒功能，不恢复虚假承诺。

这些决策解除的是范围歧义，不等于最终渲染或真机批准。各实现 Sprint 仍需单独合同与验证。

## 9. 明确不做

- 不改支付/退款/权益主链路；不在 P2 开启 checkout upsell，也不新增支付后/第二场 upsell 表面。
- 不改匹配引擎或人格系统。
- 未经 QA 裁决不删除/迁移 alang/config+debug。
- 不为 P2 新增用户可见 tab、页面家族或新商业化承诺；不把真实提醒、admin 迁移或订阅实验偷渡进本计划。
