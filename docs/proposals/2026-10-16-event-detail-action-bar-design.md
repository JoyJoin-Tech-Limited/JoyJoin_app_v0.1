# 活动详情页底部操作区 · 设计改造方案

> 2026-10-16 · 设计师产出（taro-engineer），父会话落盘。
> 状态：**已实施**（`pages/event-detail/` 底栏 + `__cta` 体系 + 状态矩阵，详见 `docs/agent-context/mini-program-events.md`）
> 实施后补强（父会话）：§4 的「任意时刻至多一个实心紫按钮」此前依赖 live 与 post-event 互斥；盲盒活动 `ongoing` 超过 +3h 时两窗口会重叠。现 去评价 在该组合下降级为 `--secondary` 描边变体（`index.scss` `&--secondary`），并由 `pages/event-detail/__tests__/eventDetailPage.test.ts` 新增 4 条结构锁覆盖（降级条件、locked 可点、done 不可点、非 `position:fixed`）。
> 配套产品计划：`docs/proposals/2026-10-16-event-feedback-activation-plan.md`
> 目标页面：`apps/mini-program/src/pages/event-detail/`（主包页面）

## §1 诊断（已用代码证据确认）

**根因 1 —「进入破冰」按钮是裸 WeChat 默认按钮（零样式）**
- TSX 引用 class：`index.tsx:181` `className='event-detail__icebreaker-btn'`
- `index.scss` 全文 267 行中**从未定义** `&__icebreaker-btn` → 渲染为 WeChat 原生默认按钮（白底、灰边框、默认圆角、默认字重）。
- 旁证：`scripts/check/class-coverage-baseline.json:10` 含 `"event-detail__icebreaker-btn"` — BEM 覆盖守卫的**存量孤儿**（baseline ratchet 只拦新增孤儿）。

**根因 2 — 容器无间距节奏，两按钮物理贴合**
- `index.scss:229-231` `.event-detail__actions` 只有 `margin-top: $spacing-lg`，**没有 `gap`**。对比：`welcome-back/index.scss:184-192` 双按钮栈用 `flex-direction: column; gap: $spacing-md`。

**附带发现（语义瑕疵）**：`index.tsx:31-32` 把 pool 状态 `active`（= 招募中）计入 live 集合；实际兜底靠 `matchedGroupId` 未解析 → `icebreakerTarget=undefined` → 按钮隐藏。逻辑能工作但隐式，状态矩阵显式处理。

## §2 布局决策

**结论：品牌标准固定底部操作栏（flex 兄弟节点模式，非 `position: fixed`），放弃 in-flow 堆叠。**

依据：① AGENTS.md §5 品牌模式（实色白底 + 顶部细影 + 安全区 inset），onboarding / pool-registration 已落地，event-detail 是异类；② 固定栏收编操作区为独立容器，内部 flex+gap 管控，重合问题无法复发；③ live 场景下「进入破冰」是限时动作，任何滚动位置可见；④ pool-registration 同款结构（footer 是 ScrollView 的 flex 兄弟节点），内容永不被栏盖住；⑤ 符合 viewport-zero-scroll 壳模式（`_mixins.scss` `no-scroll-page-shell`）。

**页面结构变化**（当前根节点是 ScrollView 本身，需改为壳结构）：

```
<View className='event-detail'>             ← 改为 flex 壳（no-scroll-page-shell）
  <ScrollView className='event-detail__scroll'>    ← flex:1; min-height:0
    <View className='event-detail__scroll-inner'>  ← 现有 padding 不动
      …hero / info card / description / support card…
    </View>
  </ScrollView>
  <View className='event-detail__action-bar'>      ← 新增：固定栏（有按钮时才渲染）
    …按钮栈…
  </View>
</View>
```

- 现有 `&__spacer`（80rpx）**删除**——栏是兄弟节点，不再需要占位。
- `--exiting` / `--static` 修饰符保留在根节点，行为不变。
- loading / error 两个 early-return 分支不受影响。

**容器规格**：背景 `$color-surface`；顶部影 `box-shadow: 0 -4rpx 16rpx rgba($color-text-primary, 0.04)`；padding `$spacing-md $container-padding`；`safe-area-inline($container-padding)` + `safe-area-bottom-padding(padding-bottom, $spacing-md)`；按钮栈 `flex-direction: column; gap: $spacing-sm`（16rpx）。

## §3 按钮设计规格

### 3.1 主按钮「进入破冰」（live 唯一主 CTA）
- 基底：`@include button-primary` + `@include type-brand-cta-label`（实色 `#8B5CF6`，96rpx 高，48rpx 圆角，品牌影 `rgba($color-primary, 0.35)`，Alimama 粗体 CTA 字形——与 pool-registration `&__submit` 同构）
- 布局：flex 行内三段 `[图标 chip] 进入破冰 [live 呼吸点]`，gap 12rpx
- 图标：**复用存量资产 `JoyJoinIcon emoji='👥'`**（24rpx，semantic tier，本地打包，零 CDN manifest 改动），置于 40rpx 圆形白 chip（`rgba($color-surface, 0.92)`）内保证彩色 webp 在紫底可读性
- Live 呼吸点：12rpx 白圆点，`animation: event-detail-live-dot-pulse 1.6s ease-in-out infinite`，**仅 opacity（0.4↔1）+ scale（0.85↔1）**，GPU 安全
- 按下：mixin 自带 `cta-pressed-active`（scale 0.98 + opacity 0.92）；`haptics('medium')`
- 入场：随栏整体 `fade-slide-up 0.28s`（复用现有 keyframes）
- 被否决图标：`💬` 在多个 map 中有歧义会回落原生 emoji；`🌅 phase-warmup` 是 CDN-only tier
- 克制论证：呼吸点是唯一微交互——live 性必须被编码进按钮；按钮本体不做整体脉冲。reduced-motion 下退化为静态圆点。

### 3.2 主按钮「去评价」（活动结束后唯一主 CTA）
与 3.1 同基底，**不带图标不带呼吸点**（平静的事后动作，视觉温度低于 live CTA）。`haptics('medium')`。
> 文案从「提交反馈」改为「去评价」（PM 决策，与 recap 模板「活动评价提醒」语义对齐）。

### 3.3 置灰态「去评价」（活动未结束时）
- 背景 `rgba($color-text-muted, 0.12)`（明确灰，非半透明紫——半透明紫传达"坏了"而非"未解锁"）
- 文字 `$color-text-tertiary`，`$font-size-md`，`$font-weight-semibold`；无阴影；96rpx / 48rpx 同构
- **PM 协调决定：置灰但可点**（不用原生 `disabled`——WeChat 吞点击事件，无法教学也无法采集 `feedback_locked_tap`）。点击 → toast「活动结束后才能评价哦」+ 埋点；`aria-disabled='true'` 保留语义，无 haptics、无 pressed 缩放
- 提示：按钮下方 8rpx 一行居中 caption `活动结束后可填写反馈`（`$font-size-xs` / `$color-text-tertiary`）

### 3.4 完成态「已评价」
- 白底 + `2rpx solid rgba($color-success, 0.4)` 描边
- 前缀 `JoyJoinIcon emoji='✓'`（status tier，本地打包）
- 文案 `已评价`，`$color-success-text-on-light`；`disabled` + `aria-disabled`，无 haptics

### 3.5 Haptics：进入破冰 medium；去评价（开放态）medium；置灰/完成态 无。

## §4 状态矩阵

TSX 派生显式生命周期（路由逻辑不动）：

```
lifecyclePhase = 'cancelled' | 'live' | 'post_event' | 'pre_live'
  cancelled  ← status ∈ {cancelled, declined, archived}
  live       ← icebreakerTarget 已解析（沿用现有 gate + group 解析，不改）
  post_event ← feedbackState ∈ {open, submitted}（服务端 resolver 输出为准）
  pre_live   ← 其余全部（招募中/排桌中/已成局未开始）
```

**核心层级原则：任何时刻屏幕上最多一个实心紫主按钮。**

| 生命周期 | 操作栏渲染 |
|---|---|
| 招募中 / 排桌中 | 不渲染操作栏（隐藏——PM D3：可持续数周，长期置灰是死 UI） |
| 已成局·未开始 | 栏 = [置灰可点·去评价] + hint「活动结束后可填写反馈」 |
| 活动进行中 (live) | 栏 = [**主：进入破冰**（图标+呼吸点）] + [置灰可点·去评价]（hint 在置灰态下沉为 caption；若反馈未开放则保留） |
| 已结束·未提交 | 栏 = [**主：去评价**] |
| 已结束·已提交 | 栏 = [完成态：✓ 已评价]（disabled） |
| 已取消 | 不渲染栏 |

**数据依赖**：置灰/开放/已提交信号来自服务端 `GET /api/events/:eventId/feedback-state` → `{ state: 'locked'|'open'|'submitted'|'ineligible'|'closed' }`（`locked`=未开放，`ineligible`=无资格/未成行——客户端隐藏栏，`closed` 预留）。网络失败兜底：按现状渲染（反馈按钮开放态显示）或保守隐藏——实现时选「失败时隐藏反馈入口」，避免假开放。

## §5 SCSS 落地方案

```
.event-detail                    ← 改造：@include no-scroll-page-shell
.event-detail__scroll            ← 新增：flex:1; min-height:0
.event-detail__scroll-inner      ← 不动
.event-detail__action-bar        ← 新增：固定栏容器（规格见 §2）
.event-detail__action-stack      ← 新增：column flex，gap $spacing-sm
.event-detail__cta               ← 新增：主按钮基底（button-primary + type-brand-cta-label）
.event-detail__cta--live         ← 新增：行内三段布局
.event-detail__cta-icon-chip     ← 新增：40rpx 白圆 chip
.event-detail__cta-live-dot      ← 新增：呼吸点
.event-detail__cta--locked       ← 新增：明确灰置灰态（可点）
.event-detail__cta--done         ← 新增：已评价完成态
.event-detail__action-hint       ← 新增：hint caption
@keyframes event-detail-live-dot-pulse  ← opacity+scale only
```

删除：`&__actions`、`&__feedback-btn`（被 `__cta` 体系吸收）、`&__spacer`。
TSX 删除 `event-detail__icebreaker-btn` 引用后跑 `node scripts/check/check-class-coverage.mjs --write-baseline` 从 baseline 移除孤儿。

```scss
.event-detail {
  @include no-scroll-page-shell;
  background: $color-bg-gradient;

  &__scroll { flex: 1; min-height: 0; }

  &__action-bar {
    flex-shrink: 0;
    padding: $spacing-md $container-padding;
    @include safe-area-inline($container-padding);
    @include safe-area-bottom-padding(padding-bottom, $spacing-md);
    background: $color-surface;
    box-shadow: 0 -4rpx 16rpx rgba($color-text-primary, 0.04);
    animation: fade-slide-up 0.28s ease-out both;
  }

  &__action-stack { display: flex; flex-direction: column; gap: $spacing-sm; }

  &__cta {
    @include button-primary;
    @include type-brand-cta-label;
    width: 100%;
    border: 0;

    &--locked {
      background: rgba($color-text-muted, 0.12);
      color: $color-text-tertiary;
      box-shadow: none;
      &:active { transform: none; opacity: 1; }
    }

    &--done {
      background: $color-surface;
      border: 2rpx solid rgba($color-success, 0.4);
      color: $color-success-text-on-light;
      box-shadow: none;
    }
  }

  &__cta-icon-chip {
    width: 40rpx; height: 40rpx; border-radius: 50%;
    background: rgba($color-surface, 0.92);
    @include flex-center;
  }

  &__cta-live-dot {
    width: 12rpx; height: 12rpx; border-radius: 50%;
    background: $color-text-white;
    animation: event-detail-live-dot-pulse 1.6s ease-in-out infinite;
  }

  &__action-hint {
    text-align: center;
    font-size: $font-size-xs;
    color: $color-text-tertiary;
    margin-top: $spacing-xs;
  }
}

@keyframes event-detail-live-dot-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.85); }
  50%      { opacity: 1;   transform: scale(1); }
}
```

合规备注：新增声明不用 `min()`/`max()`/`clamp()`（`button-primary` mixin 内部的既有声明照用）；event-detail 是主包页面，subpackage WXSS 门不适用；👥/✓ 均为本地打包 tier，不动 `cdn-asset-manifest.json` / `packOptions.include`。

## §6 无障碍与动效降级

- 主按钮 `aria-label`：live 态「进入破冰，活动进行中」；开放反馈「去评价这场活动」
- 置灰态：`aria-disabled='true'`（可点，不用原生 disabled）；完成态：`disabled` + `aria-disabled='true'`
- 现有 `@media (prefers-reduced-motion: reduce)` 块追加：`__action-bar { animation: none; }`、`__cta-live-dot { animation: none; opacity: 1; transform: none; }`（点保留静态存在）
- 触控：96rpx ≥ `$cta-min-tap`（88rpx）；stack gap 16rpx 误触隔离
- CTA 文案走 `type-brand-cta-label`；hint 保持系统字体

## §7 DevTools 验收清单

**结构 & 间距**（320px + iPhone 14 Pro Max 各一遍）：
- [ ] 栏为 ScrollView 兄弟节点，滚动内容永不钻到栏下
- [ ] 栏 padding 上下 24rpx / 左右 40rpx + 安全区；双按钮间距 16rpx；hint 距按钮 8rpx
- [ ] 按钮 96rpx 高 / 48rpx 圆角 / 全宽无溢出；`__spacer` 已删除

**视觉**：
- [ ] 进入破冰：实色紫无渐变、品牌影、Alimama 粗体、白 chip 内 👥 清晰、12rpx 白点 1.6s 呼吸
- [ ] 置灰：明确灰底（非半透明紫）、无阴影、按下无缩放
- [ ] 完成态：白底绿描边 + ✓
- [ ] 任意状态至多一个实心紫按钮（live 与 post-event 各截一张对比）

**交互**：
- [ ] 主按钮按下 scale 0.98 + opacity 0.92；真机震感 medium；置灰/完成态无震感无缩放
- [ ] 状态矩阵 6 行逐态核对；置灰点击出 toast「活动结束后才能评价哦」
- [ ] 招募中/排桌中/已取消：栏整个不渲染，页面无底部残留白边

**降级**：
- [ ] reduced-motion：栏无入场动画、呼吸点静态纯白
- [ ] computed style 无新增 `min(`/`max(`/`clamp(`

**CI 门**：
- [ ] `npm run guardrails` 通过（BEM 无新孤儿；baseline 孤儿 `event-detail__icebreaker-btn` 已消除）
- [ ] `npm run typecheck -w mini-program` 通过

## §8 涉及文件清单

| 文件 | 改动 |
|---|---|
| `apps/mini-program/src/pages/event-detail/index.tsx` | 壳结构改造、类名替换、`lifecyclePhase` 派生、feedback-state 接入、haptics、aria、删 `__icebreaker-btn` 引用与 `__spacer` |
| `apps/mini-program/src/pages/event-detail/index.scss` | §5 全部类 + keyframes；根节点 `no-scroll-page-shell`；删 `__actions`/`__feedback-btn`/`__spacer`；reduced-motion 追加 |
| `scripts/check/class-coverage-baseline.json` | `--write-baseline` 移除孤儿 |

**明确不动**：路由跳转目标、`eventDisplay.ts`、icon 注册表、`cdn-asset-manifest.json`、`app.config.ts`、subpackage 样式门脚本。
