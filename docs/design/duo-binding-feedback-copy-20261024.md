# 双人成行 · Batch B（信任闭环）逐字文案与呈现面规范

状态：待评审（供 Sprint Contract 直接引用，本文不含实现）
日期：2026-10-24
适用面：`apps/mini-program` + `GET /api/duo-invites/:code` 响应字段（仅新增只读布尔）
上游：`docs/design/duo-registration-spec-20260807.md`、S1/S2/S3 三份已上线合同

---

## 0. 一句话

已上线的三个 PR 让「约定」在后台变真了，但**页面还在说旧话**：被拒的人不知道发生了什么（N2），没报名的人还在被承诺一件已经不可能的事（N1）。本文只做两件事——**把许诺改成事实**，以及**把拒绝解释清楚**——不新增能力、不新增开关。

## 1. 证据（可复核）

| 编号 | 事实 | 证据 |
|---|---|---|
| N1-a | 公开码查询只回 `inviterRegistered`，没有「发起人是否已配对」 | `apps/mini-program/src/lib/api/duo.ts:51-63`、`apps/server/src/routes/domains/duo.ts:287-338` |
| N1-b | guest 文案只由 `inviterRegistered` 决定，L2 是恒量 | `lib/duo/duoCopy.ts:138-142`、`:145-154` |
| N1-c | 同一码可被多人打开并报名，S1 只放行第一位 | 已上线 S1（`duo_partner_taken`） |
| N2-a | `duoBinding` 在小程序侧零消费 | 全仓 grep 仅服务端与合同文档命中 |
| N2-b | 报名成功面只有 `bound` 变体，无「未成队」变体 | `PoolRegistrationSuccessCeremony.tsx:134-141` |
| N2-c | 落地 410 已 toast 且清空 `invitationCode` | `pages/pool-registration/index.tsx:326-329` |

## 2. 三条决策（先定，再看逐字）

1. **单门控，不做五处补丁。** 新增一个派生量「这张邀请还能不能兑现」：
   `duoInviteUsable = status === 'active' && inviterBound !== true`。
   guest 变体、跨步横幅、分段锁定、单人确认弹窗、建码许可**五个消费点全部读它**。理由见 §7-①。
2. **横幅整组不显示（`inviterBound=true` 时）。** 横幅的语义是「你因为某个人才在这局」；这件事已经不再成立。诚实只在 step 0 说一次，步 1–2 不再重复，避免把一次落差变成三次提醒。
3. **N2 只在报名成功面内联一行。** 不用 toast（会被误读成"失败"，且 4 秒读不完），不改 AlreadyJoined（那是回访态，重复解释是噪音），不加 CTA（这一刻不需要任务）。

---

## 3. N1 前置变体（`inviterBound === true`）

### 3.1 字段语义（服务端）

| 字段 | 含义 | 必须为真 | 必须为假 |
|---|---|---|---|
| `inviterRegistered` | 发起人在本局**有报名** | 已报名 | 未报名 |
| `inviterBound` | 发起人在本局**已有完成绑定**（双方有效报名 + use 行） | 已配对 | 仅报名未配对；配对对象已取消（S1 AC-8 解绑）；码已过期（走 410，无 body） |

约束：`inviterBound` 为纯布尔，不含对方姓名、id、时间。`inviterBound=true` **蕴含** `inviterRegistered=true`。

### 3.2 guest 表面：新增 `taken` 变体

保持现有结构与钩子（`__guest` / `__guest-line1` / `__guest-line2`、零按钮、两行），只换文案并放开分段：

- L1：`{name} 这局已经有同行了`
- L2：`你照常报名，悦仔会给你排一桌`

逐字常量（建议名，供合同引用）：

```
DUO_GUEST_COPY_TAKEN_L1 = '{name} 这局已经有同行了'
DUO_GUEST_COPY_TAKEN_L2 = '你照常报名，悦仔会给你排一桌'
```

呈现规则：

- 分段回到 **1人**（不锁定），因为「2人已成立」这件事不再为真。
- L1/L2 结构、字号、层级与 `reserved` 变体完全一致；不得用警示色、不得加图标、不得加标题。
- 用户点 2人 → 走自己的发起流程（建码、分享）；此时 `taken` 两行让位给 `expanded`/`waiting`，**不得与新卡片同屏**。
- 用户点 1人 → 直接进入常规单人流程，**不弹**「这场是和 X 约好的」确认框（已无约定可违背）。
- 初始 `duoMode` 仍会因邀请到达预选 2人（`resolveInitialDuoMode` 先于 lookup 执行）；`inviterBound` 落定为 true 后必须**回落为 `solo` 并置位 user-interacted**，否则 `shouldAutoExpandDuoRow` 会把它再翻回 duo，出现「1人→2人」的视觉抖动与错误预选。

### 3.3 跨步横幅（step 1–2）

`inviterBound=true` 时**整组不渲染**（`showDuoBanner` 门控即关）。不提供替代文案——横幅是一次性承诺的常驻回响，承诺不成立时，静默比第二句解释更诚实，也更少打扰。

### 3.4 角色降级（最容易漏的一步）

`inviterBound=true` 时，`resolveDuoViewerRole` 必须返回 `'none'`（不是 `'invitee'`），从而：

- `isGuestSurface === false` → 不触发单人确认弹窗；
- `shouldCreateDuoCode({role:'none', mode:'duo'}) === true` → 用户真的能建自己的码。

若不降级，被邀请人会被 S2 的规则**永久锁死**在「2人显示着、却永远建不了码」的状态。

### 3.5 边界表

| 情形 | 期望 |
|---|---|
| 打开者就是发起人（自己分享的链接） | 正常 inviter 卡片，`taken` 永不出现 |
| 打开者已报名本局 | 走 AlreadyJoined 终态，本节全部不适用 |
| 码已过期（410） | 走现有 toast，`inviterBound` 不下发 |
| 发起人仅报名、未配对 | `inviterBound=false` → 现有 `onlyYou`/`reserved` 不变 |
| 发起人配对对象中途取消 | 绑定失效 → `inviterBound=false`，回到 `reserved` |
| 落地时 `inviterBound=false`，提交时已变 true | 走 N2 `partner_taken`，文案与 3.2 同一句根 |

---

## 4. N2 后置解释（`duoBinding.state === 'unavailable'`）

### 4.1 呈现面

**报名成功面（`PoolRegistrationSuccessCeremony`）children 第一行**，位于标题/meta 之下、常规正文之上；与 `duo.bound` 互斥。

- 一行，无标题、无图标、无 CTA、无新样式（沿用 `registration-ceremony__text`）。
- 不使用警示色；不写"失败/抱歉/无法"这类归责词。
- 不做 toast；不改 AlreadyJoined；不改任何既有按钮文案。

### 4.2 逐字表

| reason | 逐字文案 | 备注 |
|---|---|---|
| `partner_taken` | `{name} 这局已经有同行了，这次就各排各的` | `{name}` 缺省 → `朋友`；与 N1 3.2 同根 |
| `expired` | `这张邀请已经过期了，这次就按你一个人的报名排` | 仅「落地时有效、提交时过期」窗口可达（§4.4） |
| `pool_mismatch` | `这张邀请是另一场局的，这次就按你这场来` | 客户端应先自检 poolId，此句为兜底 |
| `already_bound` | `你已经有一位同行的朋友，这次就按原来的来` | 不插姓名，避免依赖第二次查询 |
| 未知/缺失 | `这次的同行邀请没有生效，这次就按你一个人的报名排` | 仅防御，不应出现在正常运行中 |

逐字常量：

```
DUO_BINDING_NOTICE_PARTNER_TAKEN       = '{name} 这局已经有同行了，这次就各排各的'
DUO_BINDING_NOTICE_EXPIRED             = '这张邀请已经过期了，这次就按你一个人的报名排'
DUO_BINDING_NOTICE_POOL_MISMATCH       = '这张邀请是另一场局的，这次就按你这场来'
DUO_BINDING_NOTICE_ALREADY_BOUND       = '你已经有一位同行的朋友，这次就按原来的来'
DUO_BINDING_NOTICE_UNKNOWN             = '这次的同行邀请没有生效，这次就按你一个人的报名排'
```

**刻意不用「同一桌」三个字。** 未成队后，排桌仍可能因人数把小局凑到一起；说「不会同桌」会变成一句我们控制不了的承诺。文案只承诺我们真正控制的事：不按同行安排。

### 4.3 生命周期

- notice 只由**本次提交的响应**派生，不落任何 storage、不进 query cache。
- 提交成功且 `state !== 'unavailable'`（含换新码成功）→ 必须为 `null`。
- 页面栈复活（swipe back）→ 必须已清空（沿用 `useResetOnShow` 的瞬态纪律）。
- 同一次提交只渲染一次，不做「正在处理 / 已处理」两态。

### 4.4 可达性（诚实标注）

| reason | 真实可达路径 | 判断 |
|---|---|---|
| `partner_taken` | 群聊里多人打开同一码，后到者提交 | **主路径**，也是这次值得做的原因 |
| `expired` | 落地时查询为 active，用户停留跨过 `preference_lock_at` 后提交 | 真实但低频 |
| `pool_mismatch` | session 中残留的 pending code 被重放到另一局 | 真实；客户端自检后应消失 |
| `already_bound` | 同局已有绑定 × 再次报名 | 受「同局唯一报名」约束，**疑似不可达**；作为防御保留 |

> 开放问题（非阻塞，owner：backend）：请确认 `already_bound` 的实际可达性；若确为不可达，文案保留但测试只做纯函数断言，不建端到端用例。

### 4.5 不要在 `expired` 上重复设计

落地 410 已由 `index.tsx:326-329` 的 toast 覆盖，且该路径会清空 `invitationCode`——所以提交时不会再撞 `expired`。**只有**「落地有效 → 提交过期」这一窗口才渲染 §4.2 的 expired 行。这条是硬规则，见 §7-③。

---

## 5. 明确不改

- `D1` / `D2` / `D3` 三条 waiting 文案与「再喊一次」门控。
- guest `reserved` / `onlyYou` 变体（`inviterBound=false` 时的全部行为）。
- `DuoSoloConfirmDialog` 四句。
- S2 的交互：guest 零按钮、分段锁定、`shouldCreateDuoCode` 的 invitee 拦截。以上在 `inviterBound=false` 时逐字不变；`inviterBound=true` 时因 role 降级为 `none` 而**自然不生效**（不是改规则，是规则不再命中）。
- 不新增 feature flag（`inviterBound` 与 `duoBinding` 都是 additive 字段）。
- **不新增埋点。** 运营侧已有 S1 的结构化 discard 日志可聚合；若后续确需曝光口径，只在既有 `duo_banner_impression` 上加 metadata，不新增事件名（且需同步白名单与契约测试）。

## 6. 文案红线自检

| 规则 | 本文全部文案 |
|---|---|
| 禁用词（匹配/社交/灵魂/撮合/AI） | 无 |
| emoji / 感叹号 | 无 |
| 姓名 | 全部走 `truncateDuoName`（>6 截断、空 → 朋友） |
| 词系 | 排桌 / 同桌 / 同行 / 这局 |
| 语气 | 陈述事实，不道歉、不安慰过度、不催促 |

---

## 7. 最容易被工程师实现错的三处（建议直接写成 AC）

**① 把 `inviterBound` 当成「文案开关」，而不是「这张邀请还能不能用」的总门控。**
现状有五个消费点各自判断：`showDuoBanner`（`useDuoRegistration.ts:306-314`）、`guestArrival`/`isGuestSurface`（`:335-338`、`:351`）、卡片 `guest` 态（`PoolRegistrationDuoCard.tsx:216`）、`shouldCreateDuoCode`（`duoState.ts:108-110`）、单人确认弹窗门（`useDuoRegistration.ts:405-413`）。只改文案会导致：2人 仍被选中却永远成不了队，且**用户永远建不了自己的码**。
AC：`inviterBound=true` 时 `duoRole==='none'`、`isGuestSurface===false`、`showDuoBanner===false`、点 2人**必须**真实发出 `POST /duo-invites`、单人确认弹窗**不得**出现；落地先预选 2人、lookup 返回 `inviterBound=true` 后最终稳定在 1人（无抖动、无分享入口）。

**② 优先级写反 + L2 是恒量。**
`resolveGuestCopyVariant` 现在只看 `inviterRegistered`（`duoCopy.ts:138-142`）；`inviterBound=true` 必然同时 `inviterRegistered=true`，直接加参数会让「就等你」盖在「已经有同行」上——最糟的一句错话。同时 `getGuestDuoCopy` 的 L2 恒为 `DUO_GUEST_COPY_SHARED_TABLE_L2`，换了 L1 忘了 L2，就等于换个说法继续承诺同一桌。
AC：`inviterBound=true && inviterRegistered=true` → L1 为 taken、L2 为「你照常报名，悦仔会给你排一桌」，该屏任何文案不得出现「同一桌」。

**③ notice 生命周期 + expired 去重。**
两种错法：把 notice 写进 storage/query cache，导致换码成功后仍显示旧解释；或在落地已 410 的会话里再渲染一次 expired，变成连说两遍。
AC：同一会话「先被拒 → 再成功」后，成功面 notice 必为 `null`；落地已 410（`duoInviteInvalid=true`）时 **不渲染** expired 行；notice 在 swipe back 后不存在。

---

## 8. 附：与已上线文案的接缝

- `{name}` 插值统一走 `interpolateDuoName`，不要手写模板替换。
- 新常量全部落在 `apps/mini-program/src/lib/duo/duoCopy.ts`，卡片与 ceremony 一律不内联字符串（沿用 S2 AC-9 的所有权规则）。
- N2 的 notice 解析建议做成纯函数 `getDuoBindingNotice({ state, reason, inviterDisplayName })`，返回 `string | null`，单测逐字断言 5 条 + 2 条 null 分支。
