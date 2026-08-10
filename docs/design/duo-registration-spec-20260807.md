# 双人成行 · 报名流内嵌设计规格（实现就绪）

> 日期：2026-08-07
> 状态：产品方向已定稿，UI 规格实现就绪；FALLBACK 槽位文案待 owner 二选一（见 B 节）
> 输入：PM 竞品对照评估（T46）+ UX 审计（agent 报告）；本文档为最终实现规格，可直接交付实现 agent

## 0. 锁定产品决策（PM 定稿）

1. **入口**：pool-registration Step 0（STEP_BRIEF letter-card 步）放一张双人成行卡，内含紧凑分段控件「1人 | 2人」（借鉴 T46 底栏开关，但放 in-flow，不进底部 action bar——我们的底栏是步进 CTA 固定模式）。
2. **说明弹层**：T46 式三段结构（为什么做 / 注意事项 / 怎么玩），文案按 `docs/copy/brand-copy-strategy.md` 重写（悦仔 voice；禁出现 算法/权重/加分；CTA ≤12 字；描述 ≤25 字；无内联 emoji，用 JoyJoinIcon）。
3. **机制（文案必须如实反映）**：选 2人 → 生成 pool-scoped duo 邀请链接（微信分享卡）；朋友打开 → 承接页 → 微信一键登录 → duo 语境内嵌**完整 V4 性格测试** → 自动报名进**同一 pool** → 绑定成立。双方各自持有权益（悦聚卡/局票）；**不做代付、不做双人价**。
4. **匹配承诺**：duo 在匹配时为硬原子单元，**每桌最多 1 个双人组**（6 人桌）。Fallback 语义（整组顺延 vs 拆散+补偿券）待 owner 拍板，UI 已按"硬承诺 + 例外披露"预留槽位。
5. **被邀请方**：上下文横幅贯穿报名各步；成功页反映 duo 状态。
6. **卡片状态**：未邀请（默认）/ 已邀请待入队 / 双人成行已生效 + loading 骨架 + 局部非阻塞错误态（卡片失败永不阻断报名主流程）。

### 既有地基速查（本规格引用的真实模式）

| 用途 | 既有模式 | 位置 |
|---|---|---|
| Step 0 渲染结构 | header → NewRegistrantBanner → HeroPersonaSection → XiaoyueLetterCard | `apps/mini-program/src/pages/pool-registration/index.tsx:923-966` |
| 页面壳/CTA 常驻 | flex column + ScrollView `flex:1` + footer flex 兄弟节点（canonical zero-scroll） | `apps/mini-program/src/pages/pool-registration/index.scss:6-27, 1067-1078` |
| 底部弹层 | 全屏 overlay + backdrop + surface + handle，`role='dialog' aria-modal`，点 backdrop 关闭 | `apps/mini-program/src/pages/pool-registration/components/PersonaSnapshotSheet.tsx:37-109` |
| slim 横幅 | `pool-reg__persona-banner`（高约 52–56rpx，带关闭位） | `index.scss:29-68` + `PoolRegistrationNewRegistrantBanner.tsx` |
| 局部非阻塞错误条 | `pool-reg__persona-error`（灰底、点击重试、不阻断主流程） | `index.scss:70-88` |
| shimmer 骨架 | `pool-reg-shimmer` keyframes + `__brief-skeleton-line` | `index.scss:626-659` |
| 选中态控件 | `pool-reg__choice-card--selected` / `match-compass__pref-chip--active` | `index.scss:746-750`；`matching-status/styles/_match-compass.scss:391-406` |
| 完成态绿勾 pill | `pool-reg__completion-pill` + `__completion-check`（纯 CSS 勾） | `index.scss:1010-1057` |
| 图标 | `JoyJoinIcon`：`👥` ui tier tint #8B5CF6、`✅` ui、`⏳` status 均已有映射 | `packages/shared/src/iconSystem/emojiToIconMap.ts:233-236, 204` |
| Button | `openType` 经 `{...props}` 透传 Taro Button（Omit 仅 variant/size） | `apps/mini-program/src/components/ui/Button.tsx:4, 36-41` |
| 埋点 | `discoverAnalytics.track(event, poolId, metadata)`，snake_case 联合类型 | `apps/mini-program/src/lib/analytics/discoverAnalytics.ts:5-73` |
| 震动 | `haptics('light'|'medium'|'success')` | `apps/mini-program/src/lib/utils/haptics.ts:31` |
| 服务端邀请人查询 | `GET /api/referrals/:code` 返回 `inviter.displayName`（public） | `apps/server/src/routes/domains/referrals.ts:181-225` |
| 邀请码消歧/防自邀 | `invitations` 优先于 `referral_codes`，自带 self/dedup guard | `apps/server/src/routes/domains/userEventPools.ts:698-748` |

---

## A. Step 0 双人成行卡（`PoolRegistrationDuoCard`）

### A.1 插入点（精确）

`index.tsx` Step 0 块内（`index.tsx:923-966`），**`XiaoyueLetterCard` 之后、`</>` 之前**（即 `index.tsx:964` 与 `965` 之间）：

```
<PoolRegistrationHeroPersonaSection …/>     // :937
<XiaoyueLetterCard …/>                       // :954-964
<PoolRegistrationDuoCard …/>                 // ← 新增，仅 step === 0 渲染
```

理由：小信是情绪峰值，双人卡是行动点；不进 Step 1–3（那些是匹配偏好表单，stepper 标签 `flowConfig.ts:81-83` 保持不变）。

### A.2 组件解剖

```
┌─────────────────────────────────────────────┐
│ [👥icon] 双人成行                    玩法说明 │  ← header row, 40rpx
│ 想和朋友坐同一桌？选 2 人                     │  ← helper（未邀请态）
│ ┌──────────────┬──────────────┐             │
│ │     1人      │      2人     │             │  ← segmented, 72rpx
│ └──────────────┴──────────────┘             │
│ [status region：三态之一 / skeleton / error] │
└─────────────────────────────────────────────┘
```

### A.3 尺寸与 token（全部来自 `_variables.scss` / `_mixins.scss`）

| 部位 | 值 |
|---|---|
| 卡片容器 | `padding: $spacing-md`（24rpx）；`border-radius: $card-radius`（32rpx）；`margin-bottom: $spacing-md`；背景 `$color-bg-tint-purple`（#F5F0FF，`index.scss` 同款 tint 族，`_variables.scss:92`）；`border: 1rpx solid rgba($color-primary, 0.12)` |
| header icon | `JoyJoinIcon emoji='👥' tier='ui' size={40}` |
| 标题 | `@include type-body-emphasis`（32rpx semibold） |
| helper | `@include type-caption`（22rpx），`color: $color-text-secondary` |
| segmented 容器 | 高 `$button-height-sm`（72rpx），`border-radius: 999rpx`，`background: rgba($color-primary, 0.06)`，`padding: 6rpx`，两段 `flex: 1` |
| segmented 激活段 | **`background: $color-primary`（纯色，禁渐变）**，白字 `@include type-label` + semibold；非激活段透明底 `$color-text-secondary` |
| 说明入口 | 文本按钮"玩法说明"，`@include type-caption`，`color: $color-primary-dark`，命中区 ≥ `48rpx` 高（参考 `__persona-banner-close` 48rpx，`index.scss:50-56`） |
| 状态区 | 与 segmented 间距 `$spacing-sm`（16rpx） |
| 卡片总高（未邀请态预算） | ≤ 232rpx（24×2 padding + 40 header + 16 gap + 72 segmented + 40 helper + 余量） |

无新 token；全部复用。字体一律走 `type-*` mixin（`_mixins.scss:104-158`）。

### A.4 三态 + 两个辅助态（精确文案，字数已核：CTA ≤12、描述 ≤25）

| 态 | 视觉 | 文案 |
|---|---|---|
| **未邀请**（default） | segmented 可选，默认 1人 激活 | helper：`想和朋友坐同一桌？选 2 人`（13字） |
| **已邀请待入队** | segmented 锁定在 2人 且禁用（opacity 0.55，复用 `__choice-card--disabled` 语义）；状态行 `JoyJoinIcon '⏳'` + 灰紫底 pill；副行时间戳；右侧次按钮 | 主：`邀请卡已发出，等 TA 报名`（12字）；时间：`今天 14:32 已发出`（meta，`type-micro`）；次按钮：`再喊一次`（4字，`openType='share'`） |
| **双人成行已生效** | 复用 `__completion-pill` 绿底样式（`index.scss:1010-1026`）+ CSS 勾；卡片边框转 `rgba($color-success, 0.22)` | 主：`双人成行已生效`（7字）；副：`{name} 已报名，悦仔会安排你们同桌`（≤25字，name 过长 `text-truncate`） |
| **loading** | 骨架：1 行 medium + 1 行 short shimmer（复用 `pool-reg-shimmer`） | `aria-busy='true'`，`aria-label='正在加载双人成行状态'` |
| **local error** | 复用 `__persona-error` 灰条（`index.scss:70-88`），点击重试 | `双人状态没刷出来，点我重试`（13字）。**永不阻断报名主流程**：error 时 segmented 按 1人 渲染且可用 |

### A.5 交互

- 选 2人：`haptics('light')` → `POST /api/pools/:id/duo-invites`（幂等，同人同池复用同码）→ 成功进"待入队"；失败 toast（`getErrorMessage` 体系）且 segmented 回滚 1人。选回 1人（尚未分享过）：本地回"未邀请"，服务端码保留但无绑定，无需作废接口。
- 分享：待入队态主按钮 = `<Button openType='share'>`（Button.tsx 透传，`Button.tsx:4`）。页面新增 `useShareAppMessage`，动态返回：
  - `path`: `/pages/pool-registration/index?id=${poolId}&invitationCode=${duoCode}&duo=1`
  - `title`: `这场{eventType}，我想和你一起去`（保持短）
  - `imageUrl`: v1 省略（默认截图）；若后续出海报走 5:4。
  - 注意：WeChat 无分享完成回调，`sharedAt` 以"分享面板触发时间"存入 `jj_duo_share_<poolId>` storage 供重进恢复；绑定态以服务端为准。
- 状态获取：页面加载 + `useDidShow` 调 `GET /api/pools/:id/duo-status` → `{ state: 'none'|'waiting'|'bound', friendDisplayName?, invitedAt? }`；进入"已生效"时 `haptics('success')` 一次性（ref 防重）。
- 埋点（加入 `DiscoverAnalyticsEventType` 联合）：`duo_card_impression`、`duo_segment_select`、`duo_info_sheet_open`、`duo_info_sheet_close`、`duo_share_trigger`、`duo_status_update`（metadata `{from,to}`）。

---

## B. 玩法说明弹层（`DuoInfoSheet`，复用 PersonaSnapshotSheet 模式）

结构照搬 `PersonaSnapshotSheet.tsx:37-109`：root `onClick={onClose}` + `__backdrop` + `__surface`（`role='dialog' aria-modal='true' aria-label='双人成行玩法说明'`，`stopPropagation`）+ `__handle` + header + `ScrollView`。三段式，每段：`type-subheading` 段题 + `type-body` 条目（条目间 `gap: $spacing-sm`）。

**完整文案稿**（悦仔 voice；无 算法/权重/加分/数据；"匹配"按 🟠 规则仅用于价值陈述）：

> **标题：双人成行怎么玩**
>
> **为什么做**
> - 一个人开盲盒有点慌？悦仔懂。
> - 带上一个熟人，新桌子也聊得开。
>
> **注意事项**
> - 每桌最多一对双人，先成队先得。
> - 你和朋友各自报名，权益各自持有。
> - 朋友要完成性格测试，悦仔才认得 TA。
> - 〔FALLBACK 槽位 — 待老板定稿，二选一，字数均已 ≤25〕
>   - 变体 A（整组顺延）：`如果同桌实在排不开，你们一起顺延到下一局。`
>   - 变体 B（拆散+补偿券）：`如果同桌实在排不开，悦仔送上一张补偿券。`
>
> **怎么玩**
> 1. 选 2 人，把邀请卡发给朋友
> 2. TA 完成测试并报名这场局
> 3. 匹配时你们作为一个整体同桌
>
> **底部 CTA：`知道了`**（3字，`Button variant='primary'`，solid `$color-primary`）

dismiss：点 backdrop、点"知道了"、Android 返回键（弹层为组件态，用组件 state 控制显隐即可）。a11y：`aria-modal`、`aria-label`、条目用 `role='list'/'listitem'`（照 `PersonaSnapshotSheet.tsx:82-84`）。reduced-motion：surface 入场动画包 `@media (prefers-reduced-motion: reduce)`。

---

## C. 被邀请方承接

### C.1 slim 横幅（`PoolRegistrationDuoBanner`）

- 复用 `__persona-banner` 结构（`index.scss:29-68`），实测高 ≈ 52–56rpx，**≤ 88rpx 达标**。视觉差异：背景 `rgba($color-primary, 0.10)` + 左侧 `JoyJoinIcon '👥' size={28}`，**不带关闭按钮**（它是上下文不是推广位）。
- 文案：`{name} 喊你一起，报名即成队`（name + 13字 ≤25；name 取 `GET /api/referrals/:code` 的 `inviter.displayName`，`referrals.ts:215-220`；超长 `text-truncate`）。
- 数据源决策：双人码走新表/新端点则加 `GET /api/duo-invites/:code` 返回 `{ inviter: { displayName }, poolId, status }`；v1 若复用 referral_codes 则直接用现成 `GET /api/referrals/:code`，**前端组件 props 不变**，只换 queryFn。
- 持久性：`step 0-3` 全程渲染，位置 = `pool-reg__header` 之后、`PoolRegistrationStepper`（`index.tsx:977`）之上；step 切换时常驻不折叠。进入终态（success / already-joined）后由终态变体接管（C.3）。
- 埋点：`duo_banner_impression`（一次/页面挂载，ref 防重，照 `hasTrackedPersonaImpressionRef` 模式 `index.tsx:231-244`）。

### C.2 无效/过期码（坏码不阻断报名）

- 码查询 404/410（服务端已有 410 语义，`referrals.ts:252-254`）：不渲染横幅，改渲染一次性 toast：`这张邀请卡过期啦，自己来也很好玩`（16字，悦仔 voice），随后报名流程正常进行，`invitationCode` 不进 payload。
- 查询网络失败：静默不渲染横幅（logWarn），报名不受影响。

### C.3 成功页双人变体（改 `PoolRegistrationSuccess`）

`PoolRegistrationTerminalStates.tsx:194-251` 现有结构不动，加可选 prop `duo?: { partnerName: string; bound: boolean }`：

| 情形 | 标题 | 正文第一行 |
|---|---|---|
| 好友已报名（bound，被邀请方视角） | `双人成行已就位`（7字） | `你和 {name} 双人成行，悦仔会把你们安排在同一桌。`（≤25） |
| 邀请已发待报名（邀请方视角，待入队） | 保持原 `已加入这场{eventType}` | 在 success-pills 区（`:221-229`）追加一枚 pill：`等 {name} 报名，你们就是同桌` |

duo pill 样式复用 `__success-pill`（`index.scss:157-164`）。埋点 `duo_success_view`（metadata `{bound: boolean}`）。

### C.4 路由承接契约（mini-program 侧依赖，供服务端/路由实现对齐）

按锁定决策 #3，好友路径为：分享卡 → 承接 → 微信一键登录 → duo 上下文内完整 V4 性格测试 → 自动进入同一池报名。必须落地的三个断点修复（来自 UX 审计 P0-1/P0-2）：

1. 分享 path 必带 `id` + `invitationCode` + `duo=1`（A.5 已含）。
2. `useAuthGuard` 的 `reLaunch`（`useAuthGuard.ts:49`）需透传原始 query，或 app 级捕获启动参数写 storage 后回灌——否则码在登录跳转中丢失。
3. onboarding 完成后（nextStep=discover）若 session 有 pending duo，跳 `pool-registration?id=<poolId>` 而非 discover——`pendingReferralCode` 机制（`wechatAuth.ts:894-899`）已是现成载体，需扩展携带 poolId。

---

## D. 边界状态矩阵

| 情形 | 邀请方看到 | 被邀请方看到 |
|---|---|---|
| 好友永不报名 | 卡停留"待入队"；匹配照常进行，无任何惩罚/提示打扰 | — |
| 好友点开码但未完成性格测试 | 不变（待入队） | 横幅贯穿 onboarding（实现允许范围内），测试完成后落报名页见横幅 |
| 好友报名但未支付（NO_ACTIVE_ENTITLEMENT → 402 支付页） | 不变（待入队）——**绑定以报名行存在为准**（`userEventPools.ts:750-816` 事务内才写邀请记录） | 支付回跳走既有 resume context（`index.tsx:439-474`），横幅+resume card 并存 |
| 码过期/无效 | — | 一次性 toast（C.2），正常报名 |
| 邀请方选回 1人 | 卡回"未邀请"；服务端码无绑定自动失效 | 若已点开码：横幅仍显示（码有效），报名后无 duo 绑定——服务端按"双方均选 2人/码被消费"判定绑定 |
| 被邀请方已报过这场 | 好友报名时服务端 400（`userEventPools.ts:632-634`） | `AlreadyJoined` 终态（`PoolRegistrationTerminalStates.tsx:90-147`）追加一行：`你和 {name} 的双人成行已生效` |
| 匹配触发 fallback（每桌>1 duo） | 〔随 FALLBACK 槽位定稿〕A：匹配结果通知文案写"你们一起顺延到下一局"；B：写"这次没能同桌，补偿券已放进你的卡包" | 同左，双方对称文案 |
| duo 状态接口失败 | 卡内 local error 条（A.4），报名主流程零影响 | 横幅不渲染，正常报名 |

---

## E. 工程红线 checklist

- [ ] **BEM class coverage gate**：`PoolRegistrationDuoCard`/`DuoInfoSheet`/`PoolRegistrationDuoBanner` 的所有 `__` 类必须在同 PR 的 SCSS 中定义（`scripts/check/check-class-coverage.mjs`，新 orphan 即 fail）。
- [ ] **Subpackage style-splitting gate**：pool-registration 在子包，新组件 SCSS 必须 `@use` 进页面 `index.scss`（照 `index.scss:4` 对 `PoolRegistrationMascotSection.scss` 的做法），否则 `verify-subpackage-styles.mjs` 在 `build:weapp` 后 fail。
- [ ] **视口预算**：baseline 750×1334rpx 设备，footer 常驻 = 96rpx 按钮 + 48rpx padding + safe-area ≈ 144rpx+（`index.scss:1067-1078`），ScrollView 可用 ≈ 1190rpx。现状 Step 0 内容（header ~200-270rpx + HeroPersonaSection + 小信 ~640-860rpx）在最小设备上本就可能轻微滚动——CTA 因 flex 兄弟节点**恒可见**，不违反 zero-scroll。**双人卡未邀请态总高硬上限 232rpx**（A.3），待入队态 ≤ 280rpx，生效态 ≤ 240rpx，超出即压缩 helper 为单行。
- [ ] **瞬时态复位**：`isDuoSheetOpen`、share 触发的乐观时间戳等用 `useResetOnShow` 复位（照 `index.tsx:159` 对 `reacting` 的处理），防滑动返回后卡死。
- [ ] **reduced-motion**：页面已有 `reduceMotion` memo（`index.tsx:168-174`），传入新组件；卡片状态切换动画、弹层入场动画全部配 `@media (prefers-reduced-motion: reduce)` 降级（照 `index.scss:1209-1222`）。
- [ ] **无内联 emoji**：全部走 `JoyJoinIcon`（`👥`/`⏳`/`✅` 映射已存在）；`👥` 用 `tier='ui'`（本地打包，子包安全，`JoyJoinIcon.tsx:73-77`）。
- [ ] **纯色 CTA**：segmented 激活段、弹层 CTA 一律 `background: $color-primary`，禁渐变（`index.scss:1107-1111` 注释即品牌规则）。
- [ ] **不阻断原则**：duo 所有请求失败仅影响卡/横幅局部，永不 set 页面级 `error`（那个 state 是提交失败专用，`index.tsx:151`）。
- [ ] **埋点类型**：新事件加入 `DiscoverAnalyticsEventType` 联合类型（`discoverAnalytics.ts:5-73`），否则 TS 编译失败。

---

## F. 留给实现 agent 的开放点（不阻塞 UI 实现）

1. **FALLBACK 槽位文案二选一**（B 节已双稿备好）：整组顺延 vs 拆散+补偿券——owner 决策点。
2. **duo 码存储**：新表（作用域 poolId + 发起人 registrationId）还是复用 `referral_codes`（C.1 已做 props 隔离）。PM 建议复用 `invitations`/`invitation_uses` 轨并改作用域，与 referral 归因彻底解耦。
3. **分享卡片 `imageUrl`**：v1 省略（默认截图）。
4. **匹配侧改造**：硬原子分组 + MAX 1 duo/桌 + fallback 属于 `poolMatchingService.ts` 改造（duo 作为原子单元参与 seed，占 2 席；单元与他人 pair score 取双向均值；R1 对单元内每个成员单独校验；duo cap 与 `poolMatchingService.ts:1638` 容量检查同一挂点），不在本规格范围，但文案已按"硬承诺 + 例外披露"写好。

## G. 顺手修复的技术债（UX 审计 P0，建议同批落地）

1. **分享链接对老用户是死链**：邀请页分享路径只带 `invitationCode` 不带 poolId，已登录用户打开直接落 `PoolRegistrationEmpty` 错误页（`apps/mini-program/src/pages/profile-linked/invite/index.tsx:27` → `apps/mini-program/src/pages/pool-registration/index.tsx:867`）。
2. **冷启动丢码**：未登录用户被 `useAuthGuard` reLaunch 到登录页时 query 参数被丢弃（`apps/mini-program/src/hooks/useAuthGuard.ts:49`），`pendingReferralCode` 永远不会被设置——referral 归因大面积静默丢失。
3. **邀请页"分享给微信好友"是假按钮**：`invite/index.tsx:129-136` 只调 `Taro.showShareMenu`，不能唤起转发面板；应改 `<Button openType='share'>`。
4. **邀请页奖励阶梯服务端不兑现**：客户端展示的 1人=7折券/3人=5折券×2/5人=免费月卡（`invite/index.tsx:20-24`）无任何服务端发奖逻辑——要么实现要么改文案（合规风险）。
5. **`acceptPairs` 死字段**：Match Compass 的"接受带朋友"开关写入报名记录但 `poolMatchingService` 从不读取——可顺势定义为"solo 用户是否接受局内有 duo"并接入匹配，或下架该开关。

---

# 附录 H · 设计质量修订（2026-08-07 第二轮，deltas only）

> 目标：clean、minimalist、engaging、sleek。本附录仅覆盖视觉、动效与文案密度；未列出的条款维持原样。

## 设计质量原则（实现必须守住）

- **小信是本步唯一主角。** 双人卡永远低一个视觉声量：扁平、无插画、无阴影、无 mascot（品牌规范"一屏一个视觉锚点"）。宁可太静，不可抢戏。
- **默认收敛，按需展开。** 未邀请态只有一行；所有附加信息（CTA、状态、说明详情）只在用户表达意向之后才出现。
- **动画预算 ≤ 2。** 分段滑动+展开算一次，生效翻转算一次；其余全部即时；`reduceMotion` 下全部瞬时。
- **一种表面语言。** 全组件扁平 tint，无 border、无 shadow；状态靠 tint 色相切换 + 文字，不靠描边。
- **文案做减法。** 每行只承担一个信息；能在控件里说的，不另起一行。硬上限不变：CTA ≤12 字、描述 ≤25 字。

---

## A' · 双人卡修订（对 §A 的 deltas）

### A'-1 【改】默认态改为收敛单行（progressive disclosure）

- Before（§A.2）：默认即五元素卡（icon + 标题 + 玩法说明 + helper + segmented + 状态区），232rpx。
- After：**未邀请态 = 单行**，左侧标题 `双人成行`（紧跟一个圈问号 glyph），右侧紧凑 segmented「1人 | 2人」。选 2人 后卡片原地展开，下方出现分享 CTA 与状态区。
- 新解剖：

```
未邀请（默认，收敛）:
┌───────────────────────────────────────┐
│ 双人成行 (?)              [ 1人 | 2人 ] │   ← 单行, ≤104rpx
└───────────────────────────────────────┘

已选 2人（展开）:
┌───────────────────────────────────────┐
│ 双人成行 (?)              [ 1人 | 2人 ] │   ← segmented 锁定 2人、禁用
│ 已发给朋友，等 TA 报名        [再喊一次] │   ← 状态行（分享后为 waiting）
│ [      喊朋友一起来      ]              │   ← 分享前的主 CTA, size='sm' 72rpx
└───────────────────────────────────────┘
```

- Rationale：小信是情绪主角，工具行不该以"卡片"体量出现；意向未表达前展示 CTA/状态全是噪音。

### A'-2 【删】卡片 header 的 👥 图标

- Before：`JoyJoinIcon '👥' size={40}`（§A.3）。
- After：删除，纯排版。👥 仅保留在被邀请方横幅（那里没有标题层级，需要上下文标记）。
- Rationale：标题四字已自足；icon 与字母卡 mascot 争夺注意力。

### A'-3 【删】helper 行 `想和朋友坐同一桌？选 2 人`

- Before：未邀请态 helper（§A.4）。
- After：整行删除，不补位。
- Rationale：「双人成行 + 1人|2人」语义自足；利益点在弹层和生效态里讲，不在默认态推销。

### A'-4 【改】玩法说明入口降级为圈问号 glyph

- Before：右侧文本按钮"玩法说明"，`type-caption` 紫色（§A.3）。
- After：标题后 8rpx 处放纯 CSS 圈问号（24rpx 圆 + `?`，`color: $color-text-tertiary`，border 1rpx `rgba($color-text-tertiary, 0.4)`），命中区扩到 48rpx（透明 padding），`aria-label='玩法说明'`。无文字。
- Rationale：辅助信息入口不该与 segmented 争夺右侧黄金位；glyph 是通用语义，零阅读成本。

### A'-5 【改】待入队态：删时间戳行，文案收紧

- Before：主行 + 时间戳 meta 行 + 次按钮三元素（§A.4）。
- After：单行——`已发给朋友，等 TA 报名`（10字）+ 右侧 `再喊一次`（`openType='share'`，`Button size='sm' variant='secondary'`）。`sharedAt` 仍写 storage（§A.5 工程保留），**不渲染**。
- Rationale：时间戳不驱动任何行动；等待状态一行说清。

### A'-6 【改】已生效态：两行并一行，去标题冗余

- Before：主 `双人成行已生效` + 副 `{name} 已报名，悦仔会安排你们同桌`（§A.4）。
- After：单行 `{name} 已报名，同桌安排上了`（name+7字），前置 `__completion-check` CSS 勾；卡片 tint 从紫转 `rgba($color-success, 0.08)`（**不换边框**，见 A'-7）。
- Rationale：卡片标题已是"双人成行"，状态行重复四字是冗余；"安排上了"正是悦仔腔。

### A'-7 【改】表面语言：扁平 tint 唯一，全态无 border 无 shadow

- Before：`$color-bg-tint-purple` + `border: 1rpx solid rgba($color-primary, 0.12)`；生效态改 border 色（§A.3/A.4）。
- After：`background: rgba($color-primary, 0.05)`，**无 border、无 shadow**，`border-radius: $card-radius`（32rpx）不变；状态切换只换 tint 色相（默认紫 0.05 → 生效绿 0.08）+ 文字。字母卡保留其 richer 处理，双人卡刻意低一档。
- Rationale：一页之内 elevation 语言只能有一种声量排序——hero 用纸感，工具用扁平。

### A'-8 【改】segmented：浮动滑块式（floating thumb），弃整段填充

- Before：激活段整段 `background: $color-primary` 紫填充白字（§A.3）。
- After：轨道 `background: rgba($color-primary, 0.08)`，`border-radius: 999rpx`，高 56rpx、宽 240rpx（收敛行内紧凑版）；thumb = `$color-surface` 白 pill + `$shadow-sm`，激活文字 `$color-primary-dark` semibold，未激活 `$color-text-secondary`。滑动：`transform: translateX(100%)`，**200ms `cubic-bezier(0.22, 1, 0.36, 1)`**（页面标准曲线，`index.scss:1146`、`reg-confirm-card-pop` 同款）。
- Rationale：整段紫填在安静行里太重（紫色应留给主 CTA）；白 thumb + 紫字是 iOS 式安静分段，且滑动态天然提供"切换感"。

### A'-9 【定】两个动画时刻的精确规格（预算用尽，其余即时）

| 时刻 | 规格 | reduced-motion |
|---|---|---|
| ① 选 2人：thumb 滑动 + 卡片展开 | thumb 200ms（A'-8）；展开区用既有 `fade-slide-up` keyframes（`_mixins.scss:615-618`）240ms；`haptics('light')` | 全部瞬时切换 |
| ② 翻已生效：勾 pop + tint 渐变 | 复用 `pool-reg-check-pop` 0.28s 一次性（`index.scss:1164-1177`）+ tint `transition: background 300ms ease`；`haptics('success')` 一次性（ref 防重，§A.5 已述） | 勾静止呈现，tint 瞬时 |

- 待入队态**保持静止**：不加呼吸点/脉冲——等待不是成就，不配动画。状态靠 `useDidShow` 拉取更新。

### A'-10 【改】高度预算（替换 §A.3 末行与 §E 视口条）

| 态 | 预算 | 构成 |
|---|---|---|
| 未邀请（收敛） | ≤ 104rpx | 24×2 padding + 56 segmented |
| 已选 2人 展开（分享前） | ≤ 256rpx | 104 + 16 gap + 72 CTA（`size='sm'`）+ 余量 |
| 待入队 | ≤ 200rpx | 104 + 16 + 40 状态行 + 余量 |
| 已生效 | ≤ 148rpx | 24×2 + 40 状态行 + segmented 行（可隐藏 segmented，进一步降到 ≤96rpx，实现自选） |

---

## B' · 说明弹层修订（对 §B 的 deltas）

### B'-1 【改】为什么做：两行并一行

- Before：2 条 bullet。
- After：单行 `一个人开新桌有点慌？带个熟人，悦仔帮你们留座。`（23字）。
- Rationale：理由一句话就够，多一条就是多一次眼跳。

### B'-2 【改】注意事项：4 条 → 2 条 + FALLBACK 槽位

- Before：每桌一对 / 各自报名各自权益 / 要完成性格测试 / FALLBACK。
- After：
  - `每桌最多一对双人，先成队先得。`
  - 〔FALLBACK 槽位不变，双稿照旧〕
  - "权益各自持有"并入怎么玩 step 2（见 B'-3）；"性格测试"本就含在 step 2 的"完成测试"里，删。
- Rationale：机制属于"怎么玩"，只有约束和例外才配叫"注意事项"。

### B'-3 【改】怎么玩：三步文案收紧，剔除 🟠 词"匹配"

- Before：① 选 2 人，把邀请卡发给朋友 ② TA 完成测试并报名这场局 ③ 匹配时你们作为一个整体同桌。
- After：
  1. `选 2 人，把卡片发给朋友`（11字）
  2. `TA 完成测试，各自报名这场局`（13字，自带"权益各自持有"语义）
  3. `悦仔把你们安排进同一桌`（11字）
- Rationale：step 3 原来 13 字且含需 framing 的"匹配"；人格化表述更短、更暖、零合规负担。

### B'-4 【定】排版节奏（新增精确值）

- sheet padding：左右 `$spacing-lg`（40rpx）；header（标题）→ 第一段 24rpx（`$spacing-md`）；段题→条目 16rpx（`$spacing-sm`）；条目间 12rpx；段→段 40rpx（`$spacing-lg`）；末段→CTA 40rpx。段题 `type-subheading`，条目 `type-body`，CTA `Button variant='primary'` 默认尺寸。
- Rationale：与 PersonaSnapshotSheet 同族节奏，40/24/16 三档即全页既有阶梯。

### B'-5 【定】弹层形态决策（新增，因页面出现第二个 overlay）

- 页面现有两种 overlay：`PersonaSnapshotSheet`（底部弹层，信息型）与新增 `RegistrationConfirmModal`（居中 dialog，决策型，`RegistrationConfirmModal.scss:8-31`）。
- 规则：**信息说明型一律底部弹层**（DuoInfoSheet 维持 §B 不变），**提交决策型一律居中 dialog**；同屏最多一个 overlay，开 DuoInfoSheet 时若 confirm modal 可见则先关后者（反之亦然）；z-index 共用 `$z-modal`（200，`_variables.scss:254`）。
- Rationale：形态即语义，混用会让用户学两套心智。

---

## C' · 被邀请方承接修订（对 §C 的 deltas）

### C'-1 【改】横幅：去 border，icon + 单行文字

- Before：继承 `__persona-banner`（含 1rpx border，`index.scss:38`）+ `rgba($color-primary, 0.10)` 底（§C.1）。
- After：`background: rgba($color-primary, 0.08)`，**无 border**，左侧 `JoyJoinIcon '👥' tier='ui' size={28}` + 单行文字，无关闭按钮（不变）。高 ≤ 88rpx 不变。
- Rationale：与 A'-7 同一种表面语言；横幅是上下文条，不是卡片。

### C'-2 【改】成功页 bound 文案收紧

- Before：`你和 {name} 双人成行，悦仔会把你们安排在同一桌。`（23字，§C.3）。
- After：`已和 {name} 组成双人，悦仔会安排同桌。`（≤20字）。
- Rationale：与卡片生效态（A'-6）同一措辞体系，用户两处看到的是一句话的两个时态。待入队 pill `等 {name} 报名，你们就是同桌` 与横幅 `{name} 喊你一起，报名即成队` 不变（已达标）。

---

## E' · 工程红线追加（对 §E 的 deltas）

- [ ] **高度预算替换**：以 A'-10 为准（原"未邀请态 ≤232rpx"作废）；收敛态 ≤104rpx 是硬上限，超出即砍元素不准加行。
- [ ] **overlay 互斥**：DuoInfoSheet 与 RegistrationConfirmModal 不得同时可见（B'-5）；`isDuoSheetOpen` 同样走 `useResetOnShow`（原条款已覆盖，此处强调两 overlay 的 state 都要复位）。
- [ ] **动画零新增 keyframes**：A'-9 全部复用既有（`fade-slide-up`、`pool-reg-check-pop`、`pool-reg-completion-pop`）；segmented thumb 用 `transform transition` 即可。新增 keyframes 需要在本规格追加登记。
- [ ] **CSS-only glyph**：圈问号与勾均为纯 CSS/文本，不引新图片资产，不进 CDN manifest。

---

**未改动声明**：§A.5（接口契约、分享 path、埋点六事件）、§C.4（路由承接三修复）、§D（边界矩阵）、§F/§G（开放点与技术债）全部维持原样；本附录仅覆盖视觉、动效与文案密度。
