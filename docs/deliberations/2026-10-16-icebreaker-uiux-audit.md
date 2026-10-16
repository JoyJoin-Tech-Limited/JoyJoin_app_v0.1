# 破冰游戏 UIUX 排查与统一设计计划（38 条 · v2 合并修订版）

- 日期：2026-10-16
- 触发：用户 warmup 截图反馈（「我准备好了」按钮后突兀白色方块）+「整体视觉效果臃肿杂乱」
- 排查方式：taro-engineer（视觉系统逐行排查，全 file:line 证据）× product-manager（13 环节端到端 UX 走查）双专家并行
- 范围：`apps/mini-program/src/pages/icebreaker-session/` 全部（壳层、13 个 phase 视图、18 个组件、6 个弹层、viewModels、hooks）+ 共享 UI 件 + 设计 token
- v2 修订：合并评审发现的 6 处内部张力修正（§3）+ 8 个盲区新增 #31–#38 + 防回退附录（§4）
- 执行状态：**第一波「壳层与材质统一」✅ 完成（2026-10-16）** — Sprint Contract `sprint_20261016_icebreaker_uiux_wave1` accepted→completed，QA verdict ACCEPT 21/21；第二波（定向与减负，纯客户端）与第三波（状态泛化与度量，需服务端+flag）待各自 Sprint Contract。

---

## 0. 总体诊断：为什么会「臃肿杂乱」

底层工程纪律是 A 级（token 化、动效统一 `cubic-bezier(0.22,1,0.36,1)`、主文案零 emoji、AIGC 角标 fail-closed、reduced-motion 全覆盖）。碎感来自 5 个系统性断层：

1. **壳层布局失控** — CTA 白条内缩漂浮、原生导航栏白底压在米色渐变上（`index.config.ts` 未设 `navigationBarBackgroundColor`）、全程无环节进度
2. **每屏信号过载** — 话题卡顶叠 4 套无标签符号、切环节四重播报（overlay + toast + toneLine + 震动）、recap 十连块
3. **第二视觉语言** — BonusGate/MomentCard 暗色孤岛（`#1e1e2f`/`#d4af37` 全内联）、scrim 七档（0.08/0.30/0.40/0.45/0.55/0.85）、auction 单文件 accent alpha 九档即兴
4. **状态诚实覆盖不均** — warmup 有分阶段「生成中」直播文案，quip/undercover/group_mirror/auction/dice 五个 AI 环节玩家端干等最长 28s
5. **认知负荷头重脚轻** — warmup 卡下半截全空，lie_detective 表单（3 行×4 控件）、group_mirror 18 按钮墙、recap 10+ 区块过载

---

## 1. 统一视觉语言（骨架）

### 1.1 材质分层（三级，不再多）

| 层级 | 配方 | 用途 |
|---|---|---|
| L0 页底 | 暖米渐变（`page-warm-bg`）+ 导航栏 `navigationBarBackgroundColor: #FDFCFA` | 消除顶端材质断层 |
| L1 主卡 | `$color-surface` 白底 + `$card-radius`(32rpx) + 2rpx `rgba(accent, 0.32)` 描边 + 单阴影 `0 8rpx 24rpx rgba(accent, 0.12)` | **每屏至多一张**；取消 tint 卡面（warmup tint `#FFFAF4` 与页底撞色） |
| L2 次卡 | `$color-surface` + `$radius-md`(16rpx) + `rgba($color-text-primary, 0.06)` 发丝边，无阴影 | 列表项/信息卡 |
| L3 pill | `$radius-pill` + accent 0.08 底 + accentDeep 文字 | 唯一 pill 配方 |

### 1.2 配套纪律

- **accent 四档**：`border(0.32)` / `fill(0.08)` / `deepText(accentDeep)` / `solid(accent)`，写进 `phaseAccents.ts` 注释 + guardrail 扫描（见 #31）
- **scrim 两档**：sheet 类 `rgba(0,0,0,0.45)` / 仪式类 `rgba(0,0,0,0.55)`；删 0.08/0.30/0.85
- **CTA 唯一语法**：页级主 CTA 一律吸底 dock（`pool-reg__footer` 式 ScrollView flex 兄弟）；卡内 action zone 只放次级操作；删 dice fixed 悬浮方言
- **圆角/字号/z-index**：`999rpx`/`50%`/`100rpx` 归并 `$radius-pill`/`$radius-circle`/`$radius-full`；禁止 `+2rpx` 离阶字号（回归 `type-*` mixin）；z-index 全映射 `$z-*` 阶梯，toast 固定 `$z-toast`(300)
- **播报权重表**：轻环节 = 仅 toast；重环节 = overlay 吸收 toast 文案合并为一次；全屏仪式只留章节级切换。禁止 overlay + toast 同发
- **artifact 例外登记**：暗色 canvas 分享卡（MomentCard 本体）登记为例外，其 chrome（按钮/说明文字）必须走 token；例外清单维护在本文档 §4

---

## 2. 38 个设计点

### A. 壳层与定向

**#1 CTA 白色补丁 → 吸底 dock（v2 修正：直接上目标态方案 A）**
- 根因：`WarmupActionBar.scss:3-11` `.warmup-action` 白底流内元素，被 `index.scss:72-76` `__inner` 的 `$container-padding`(40rpx) 左右内缩 + 双重 safe-area（`WarmupPhaseView.scss:15-16` vs `index.scss:75`）→ 白条上下左右被米色包围 = 「不明来由的白色正方形」
- 改法：学 `pages/pool-registration/index.scss:866-877` —— 页根 flex column + ScrollView `flex:1; min-height:0` + action bar 提升为 flex 兄弟 footer（`flex-shrink:0` 满宽白底 + top shadow + 单边 safe-area）。**跳过负 margin 过渡方案**（短屏 media query 下脆弱）
- ⚠️ 禁止 `position: fixed`：`__phase-shell` 入场动画 `both` fill 保留 transform，会劫持 fixed 后代包含块（`WarmupCelebrationOverlay.tsx:45-47` 已踩过）
- 收益：消灭用户反馈第一问题；所有 phase 页级 CTA 参照统一

**#2 常驻环节进度**
- 问题：`runPlan.segments`/`completedPhases`/`enabledPhases` 在 session state 里躺着却从不渲染，用户进场即盲玩
- 改法：壳层悦仔条加「第 2/5 环 · 侦探」chip；纯客户端，零服务端成本

**#3 入场环节地图**
- 问题：选模式时承诺「3 个游戏 · 60 分钟」，进会话后承诺再无下文
- 改法：入场首屏一行预览（话题卡 → 侦探 → 回顾），与 #2 共用数据

**#4 host「⋯」空心圆钮 → 文字 pill**
- 问题：`XiaoyueSessionShell.tsx:188-199` 纯 glyph「⋯」无标签；coachmark 一生一次 6 秒（`index.tsx:782-814`），错过即永远
- 改法：「主持人 ···」文字 pill；coachmark 改首次点击前常驻；ActionSheet 菜单行瘦身（「更换模式」，当前模式移壳层 caption）

**#5 切环节播报 → 权重表（v2 修正）**
- 问题：PhaseIntroOverlay 1.6s + toast 3s + toneLine + haptic 四重同发
- 改法：按 §1.2 播报权重表执行，**不一刀切砍 overlay**（mini_script 等重仪式环节保留）

**#6 玩家「我离开一下」+ host 失联兜底**
- 问题：全页无 leave affordance；host 掉线全桌死等到 session 过期
- 改法：次级离开入口 + 安心文案；host 心跳超时后玩家端提示。第三波（需服务端）

### B. 话题卡信息架构（截图核心区）

**#7 卡面三段分布吃掉下半空白**
- 根因：`WarmupCardSlot.scss:233-251` `__content` 只有 deep_chat/AIGC 才有 `margin-top:auto`，普通话题卡内容全顶对齐，480rpx 卡下半截全空
- 改法：meta 顶行 / 问题句 `flex:1` 垂直居中 / 底部常驻槽（无 permission/AIGC 时放「第 N/M 张」）

**#8 卡顶 4 套无标签符号合并**
- 问题：进度圆点（`WarmupCardSlot.tsx:521-531`）+ 「深度·L2」印章（18rpx 低于 20rpx 地板）+ 余烬灰点骑边框线（`WarmupEmberRim`）+ 48rpx 氛围图标，全无语义标注挤同一角落；「灰色齿轮」即被边框切成两半的余烬点
- 改法：圆点→文字「1/3」并入右上印章行；「L2」内部词改「走心/轻松」且字号 ≥20rpx；氛围图标配文字或删；余烬加首燃教学提示

**#9 未激活进度点隐形**
- `WarmupCardSlot.scss:275-286` `#F3F4F6` on `#FFFAF4` ≈ 0 对比 → `rgba($color-text-primary, 0.18)`

**#10 翻牌正面承载氛围揭晓**
- 正面只有 icon+「话题马上揭晓」（`WarmupCardSlot.tsx:420-427`）→ 正面放 host 所选氛围名 + 一句氛围文案，翻牌 = 揭晓今晚的聊法；背面问题句字号上调

**#11 预热卡 tint 撞色**
- `#FFFAF4` 与页底几乎同色，卡浮不起来 → 白底 foil 描边（L1 配方）

### C. 材质与色彩统一

**#12 BonusGateOverlay 暗色孤岛改造**
- `overlays/BonusGateOverlay.tsx:79-129` 全内联 `#1e1e2f`/`#d4af37` + 半角 `?`/`!` → 暖色底部 sheet（迁 SCSS），加上下文「今晚的环节玩完了」，全角标点

**#13 MomentCardView chrome token 化（v2 修正：artifact 例外登记）**
- 内联 `#888`、内联 rpx（H5 静默崩坏）、`保存中...` → chrome 迁 SCSS + token；**暗色 canvas 卡本体登记 artifact 例外保留**（分享缩略图场景暗底更高级）

**#14 双重庆祝语法统一**
- `CelebrationOverlay`（0.55 黑底深卡）vs `WarmupCelebrationOverlay`（无 backdrop 白气泡）→ 统一「55% scrim + 浅卡 + 彩带」一种

**#15 scrim 七档 → 两档**
- 全局归 0.45（sheet）/0.55（仪式）；GroupMirror detail 0.08 提到 0.45

**#16 accent alpha 九档 → 四档纪律（v2 修正：guardrail ratchet 限定范围）**
- auction 单文件 0.08→0.45 九档是「每 phase 自创视觉语言」根源 → 四档白名单 + `check-icebreaker-visuals.mjs`（ratchet 式，baseline 放行存量，**仅扫 icebreaker-session 目录**）

**#17 `__fade` 冷色接缝**
- `WarmupPresenceStrip.scss:105-113` 用 `$color-bg`(#FAFAFA) 在暖底留冷缝 → 暖色系终点

**#18 调试局 strip → 居中 warning 胶囊 + 工程清污**
- `WarmupPhaseView.scss:34-47` 灰色满宽内缩条 → 居中胶囊（warning 浅底 + icon + 「测试局」）；顺手删死 token（`index.scss:60-64`）、`max()` 恒等式（`_mixins.scss:174,193,207`）、离阶字号 18/26/30rpx 回归 `type-*`、「调试局」字样 fail-closed 复核（微信审核姿态）

### D. 负荷削减（简洁易明）

**#19 Lie Detective 表单过载**
- `LieDetectiveHeroView.tsx:216-284` 3 行×4 控件双路径平铺 → 默认「悦仔帮我写三句」一键生成可逐句改；「哪句是谎言」拆为提交后独立一步

**#20 Group Mirror 18 按钮墙**
- `GroupMirrorHeroView.tsx:309-330` → 一次一题 stepper +「已选 2/3 题」进度

**#21 Recap 十连块中段塌陷**
- 顺序锁死 headline → 高光勋章 → 分享（两件合一）→ 告别 → 出口；数据卡收成一条可展开

**#22 骰子双就绪门合并（v2 修正：不碰 host authority）**
- ~~5s 自动推进~~ 违反 *host owns phase transitions*（auto-advance 已退役）→ 改为**门槛合并**：选完即视为对揭晓结果就绪，砍掉第二次体力点击；CTA「准备进入下一游戏（3/6）」→「继续（3/6）」；host 推进权不变

**#23 拍卖 V1 五控件 → V2 ladder 全量**
- +5/+10/全押/输入框/出价 → ladder 按钮；术语「标」→「拍品」

**#24 mini_script 幕间减负**
- 4-5 折叠块压指令 → 默认只展开「本幕指令 + 新线索」；投票四组输入 → 两轮各一问；「抓马」徽标 →「推理」

**#25 表情 reaction 假计数**
- quip/undercover/group_mirror 三处 TapReaction 计数纯本地 setState，六台手机各显各的 → 隐藏计数（零成本）或服务端聚合；诚实 > 热闹

### E. 状态诚实与交互反馈

**#26 AI「生成中」直播感泛化（第三波，需服务端 + flag）**
- warmup `warmupTopicsStatus: generating` 模式推广到 quip/undercover/group_mirror/auction/dice；feature flag `icebreakerContentStatusEnabled` + 旧 snapshot 客户端兜底降级

**#27 准备计数升级主状态位**
- `WarmupPresenceStrip.scss:94-97` 2.2:1 对比度 + 96rpx 死行高 + topic_card 态 avatar 条塌缩 → 大号数字 +「还差 2 人」+ 未准备者名字（6 人小桌社会压力是特性）；host 卡住显性「不等了，直接继续」（stall 机制 UI 显性化）；删内联 `style={{flex:1}}`

**#28 按压反馈补全**
- 12 文件 27+ 处 onClick 无 hoverClass（MiniScript 27/0、Recap 10/0、Auction 10/0）、HandshakeRitual 纯 Text onClick 零反馈、3 处触点 <88rpx → 补 hoverClass（`hoverStartTime={0}`）+ haptics + `$cta-min-tap`

**#29 JoyJoinIcon 占位白块 + PhaseHeaderIcon 三级链**
- 加载中 `opacity:0` + 浅色底方块 = 「补丁感」第二来源（慢网 ✓/徽章/氛围图标全中招）→ 占位全透明 + preload 扩充；`phaseUtils.tsx:99-114` CDN 失败 = 空紫圆环，且 13 个本地 phase-icons 未进 `packOptions.include`（死重）→ manifest 补条目 + localAsset→CDN→品牌占位（紫底 + phase 名称）三级链

**#30 fixed-in-transformed-shell 六处 → RootPortal**
- 线索抽屉、证据盘×2、moment panel、GroupMirror detail、dice fixed CTA → 全部 RootPortal（先例已存在）；左边缘卡片残影真机定性（发牌转角瞬态 / CardFlip `will-change`+scale(1.02) 裁剪逃逸，DevTools 对照实验）

### F. 基础设施与度量（v2 新增 #31–#38）

**#31 视觉语言固化成基础设施** ⭐ 与 #14–#16 同波落地
- `_ice-materials.scss`：`@include ice-card-primary / ice-card-secondary / ice-pill / ice-scrim($tier)`；accent 四档 + scrim 两档 guardrail ratchet；删死 token。规范写在文档里会烂，长在 mixin 和 CI 里才活

**#32 Phase × 状态矩阵**
- 13 phase × (loading/empty/error/同步中/已提交/旁观/replay/disabled/pressed) 矩阵表，第一波建表当验收清单，逐波填修复

**#33 全局 `muted` 误用审计（本计划内限定 icebreaker-session 范围）**
- `$color-text-muted` 用于功能信息（计数/时长/hint）米底全线不达标 → 功能信息禁用 muted，派生 `$color-text-secondary-warm` token

**#34 waiting 空档期升级**
- 玩家只看到数字 → 同桌头像条 + 今晚环节预览（复用 #3 素材）+ 开场前小知识；把最长空窗变成安心画面

**#35 胜利时刻清单（moment design）** ⭐ 决定本计划是「修复」还是「升级」
- 逐 phase 设计「完成瞬间」（挑战完成微震回响、侦探揭晓、落槌瞬间、骰子同频倒计时），统一为「胜利脉冲」微动效词汇表（transform/opacity only，≤500ms）

**#36 性能预算（老 Android 是现场主力机型）**
- 同屏 will-change ≤4 层；预烘焙纹理替代实时 blur/多重阴影；第二波完成后跑 performance-audit 技能

**#37 效果度量（否则改了无法证明）**
- 3 个 funnel 指标：ready-rate、phase-completion-rate、纪念卡保存率；事件两侧（客户端+服务端白名单）无条件注册预埋，30 天基线与改后对照（参照装备引导 V1 先例）

**#38 文案上收 copy 模块**
- 术语替换决策表（L2→走心、节奏球→点5下、开场包→悦仔开场提示、抓马→推理、标→拍品、胜率→「悦仔骗过全场 N 次」）落 `packages/shared/src/copy/`；按微信审核姿态复核

---

## 3. v2 内部张力修正记录

| # | v1 原文 | v2 修正 | 原因 |
|---|---|---|---|
| #1 | 负 margin 破出（过渡）→ 目标态 flex 兄弟 | 直接上方案 A | 负 margin 在短屏 media query 下脆弱；仓库已有正确范式 |
| #5 | 砍 toast 保留 overlay | 播报权重表，不一刀切 | overlay 对重仪式环节有强调价值 |
| #12/#13 | 暗色孤岛重构 | canvas 分享卡登记 artifact 例外，仅 chrome 归编 | 暗底分享缩略图反而高级 |
| #16 | accent guardrail 全局扫描 | 限定 icebreaker-session 目录 + baseline ratchet | 避免误伤存量、控制噪音 |
| #22 | 揭晓后 5s 自动推进 | 门槛合并，host 推进权不变 | host owns phase transitions 是架构红线 |
| #26 | 直接泛化 contentStatus | 加 feature flag + 旧客户端兜底，移第三波 | 需服务端 schema 变更 |

---

## 4. 防回退附录

### 4.1 已做对、禁止顺手丢的清单
- warmup 分阶段生成文案（4s 换句）+ 自动重试阶梯（`TOPICS_SERVER_RETRY_BACKOFF_MS`）
- 乐观准备 + 失败暖 toast 回滚（「刚才那一下没传到，再点一次试试」）
- calm-by-default 断网（灰点 + 单边沿 toast）、410 终态页（「回忆都帮你留好啦」）
- roster-locked 迟到旁观卡、honest opt-out（只想听）、静默超时诚实状态
- micro_challenge「全员完成前禁用推进 + 原因文案」gating 范本
- mini_script stepper（全场唯一有进度感的环节，#2 的参考实现）
- emoji 零容忍 + AIGC 角标 fail-closed + reduced-motion 全覆盖 + 动效锁定词汇

### 4.2 artifact 例外登记
| 例外 | 位置 | 理由 |
|---|---|---|
| 暗色 canvas 分享卡本体 | `MomentCardView.tsx` | 分享缩略图场景暗底更高级；chrome 不归例外 |

### 4.3 改版许可范围
仅 `apps/mini-program/src/pages/icebreaker-session/` + 共享 token/mixin + `packages/shared/src/copy/`（#38）+ `project.config.json` packOptions（#29）。**不许顺手波及 tab 页或其他页面**。

---

## 5. 三波落地计划

| 波次 | 主题 | 条目 | 性质 |
|---|---|---|---|
| **第一波「壳层与材质统一」** | 消灭截图级缺陷 + 立规矩 | #31（infra 先行）、#1、#29、#7–#11、#27、#14–#16、#17、#18、#33、#5、#32（建表） | 纯客户端，零数据结构改动 |
| 第二波「定向与减负」 | 每屏一个主行动 | #2/#3/#4、#19–#25、#28、#30、#34、#36、#38 | 纯客户端 |
| 第三波「状态泛化与度量」 | 诚实覆盖拉齐 | #26（flag）、#6、#37、#32（填完）、#35 | 需服务端配合 |

**每波硬门槛**：`npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program` + `npm run guardrails` + `npm run design:audit:changed` + class-coverage 无新增 orphan + `check-cdn-icon-coverage`（动 manifest 时）+ WeChat DevTools 实机验证清单（吸底栏/sticky/fixed/短屏/刘海）。

**收尾审计链**：ui-layout-audit → frontend-design-audit → completeness-audit + user-satisfaction-audit（桌前视角走查）。

## 6. 效果度量

#37 指标 30 天窗口对照：ready-rate、phase-completion-rate、纪念卡保存率。事件在 Wave 1 即预埋（无条件注册，两侧白名单 parity），保证基线窗口从部署即开始。
