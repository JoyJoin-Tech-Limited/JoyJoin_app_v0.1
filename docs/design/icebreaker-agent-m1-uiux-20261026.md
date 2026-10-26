# 悦仔破冰副驾 M1 — UI/UX 设计策略

> 日期：2026-10-26 ｜ 状态：设计基线（未实现）
> 上游：`docs/deliberations/2026-10-26-icebreaker-agent-m1-deliberation.md`（M1 范围已拍板）
> 作者：专家 UI/UX 设计评审（只读调研），本文为其备忘录的落盘版
> 目标：极致的 精致度 / 高级感 / sleekness，同时不制造「被监视感」、不破坏微信审核与分包约束

**核心路径：静默观察 → 非模态征询 → 一次确认执行 → 安静降频。**

**一句话设计判断：M1 最精致的形态不是「更像一个 Agent」，而是大多数时候像不存在，需要时只出现一张恰到好处的卡，随后用一次稳定、安静的话题换新证明它确实帮上了忙。**

---

## 1. 设计主张

1. **克制就是高级。** 默认界面完全不新增 Agent 痕迹；没有观察灯、扫描线、常驻状态、动态头像或「正在思考」。
2. **Agent 的高级感来自时机与结果，不来自存在感。** 最值得打磨的是 Ask 出现得是否合时宜、话题卡换新是否连贯，而不是让 host 看见多少「智能过程」。
3. **Host 永远只做一个小决定。** 一张卡、一个问题、一个主动作；不解释信号、不展示评分、不让 host 学习新控制台。
4. **结果比过程更有表现力。** 动效只用于说明「征询出现」「状态改变」「话题已换新」，不用于装饰 Agent。
5. **诚实比漂亮更重要。** 旧话题保留到服务端提交成功；超时、未知结果、策展 fallback、离线都不伪装成成功。

### 关键裁决

| 设计问题 | 结论 |
|---|---|
| Ask 容器 | **现有 host shell 下方的非模态浮层卡**，无 scrim、不推挤布局 |
| 8 秒自动消失 | **取消。可执行 Ask 不做任何计时自动消失** |
| 常驻观察指示 | **完全不要。** 保留现有网络灰点，但它只表示连接状态 |
| 一键关闭 | Ask 内第三级文字动作「本场不再提示」，单击生效，不弹二次确认 |
| 执行反馈 | 原卡原位切换状态；不全屏 loading、不用假进度条 |
| 效果回看 | **M1 不新增主动回看 UI、不做数据面板** |
| Participant 感知 | 只有话题内容安静 crossfade；不出现「悦仔正在工作」的告示 |

---

## 2. Host 端四个时刻的界面规格

### 2.1 共用容器与层级

**唯一推荐：shell-anchored 非模态浮层卡。**

- 不选 **shell 内联展开**：会撑高 shell、推挤主卡与底部 dock，短屏破坏 zero-scroll，也让 Agent 显得过于常驻。
- 不选 **底部 action sheet**：需要遮罩与安全区管理，会盖住现有主 CTA；对二元决定过重，更像系统弹窗而非悦仔副驾。

结构：

```text
现有 40rpx 悦仔头像 + toneLine + 主持人菜单（不变）
└─ Ask 浮层卡
   ├─ 悦仔想确认一下
   ├─ 主问题，最多 2 行
   ├─ 状态/结果说明，固定保留 1 行
   ├─ 换一组话题卡（主 CTA）
   ├─ 先不用｜本场不再提示
   └─ 内容由 AI 生成 · 反馈（仅实际 AIGC）
```

尺寸与材质：

- 沿用当前 suggestion 锚点：`position: absolute; top: 100%; left/right: 32rpx; margin-top: 8rpx`
- 当前 `40rpx` 页面 inset 下，750rpx 设计稿卡宽 **606rpx**
- `padding: 24rpx`、`border-radius: 24rpx`
- 沿用现有 suggestion overlay 的白底、细边框与 `0 8rpx 32rpx rgba($color-text-primary, 0.1)` 浮层阴影
- **不调用 `ice-card-primary`**：页面主话题卡已是唯一 L1，Ask 不能再制造第二张主卡
- 预计高度 **320–364rpx**；带 AIGC 页脚不超过约 **408rpx**，无内部滚动
- 主问题 `28rpx / 1.5 / 600`，最多 2 行；辅助状态 `24rpx / 1.6`，固定一行槽位防跳动
- 主 CTA 高 **88rpx**，纯色 `#8B5CF6`，文字 `28rpx / 600`；次级动作点击区 ≥**88rpx**，文字 `24rpx`
- 不重复放第二个悦仔头像（一屏一个 mascot）

层级与可达性：

- 使用现有 `$z-modal = 200`，**无 scrim**；ritual/celebration overlay、系统 toast、原生 ActionSheet 仍在其上
- Ask 出现时抑制现有 coachmark；Ask 与旧 adaptive suggestion **永不同时出现**
- 只覆盖上方内容区，不覆盖底部 warmup dock；点击卡外不采纳、不忽略、不关闭
- 同一时刻最多一个 pending Ask，不排队堆叠
- 非模态 `group`，**不做焦点陷阱**；阅读顺序位于 shell 之后、phase 内容之前
- 主问题与执行状态 `aria-live='polite'`；执行中 `aria-busy`；禁用态用真实 `disabled`/`aria-disabled`
- 混合字号行一律 flex + `align-items: center`，不依赖 Text baseline；功能性文字对比度 ≥4.5:1

### 2.2 时刻一：静默观察

界面完全保留当前 slim shell：40rpx 静态 WebP 表情、band `min-height: 56rpx`、phase 表情 200ms crossfade、host-only「主持人 ···」菜单与 88rpx 点击区、网络失败灰点。

**明确不做**：「悦仔正在观察」「正在理解这桌」「氛围扫描中」；观察点、呼吸环、雷达、波形、在线状态、周期性表情；轮询/趋势计算/LLM 调用时的任何动效或 haptic；向屏幕阅读器播报观察过程。

**理由**：持续观察指示既不帮助 host 决策，又把「应用内不活跃」包装成「现实冷场」的视觉暗示，并制造最典型的监视感与 AI slop。

### 2.3 时刻二：Ask 出现

内容：Kicker「悦仔想确认一下」`22rpx`；主问题只描述可选择的情境，不宣称理解现实情绪；辅助行默认「你确认后，全桌一起换新」；主动作「换一组话题卡」；次级「先不用」「本场不再提示」。

动效：

- 出现 `200ms cubic-bezier(0.22, 1, 0.36, 1)`，`opacity 0→1` + `translateY(-8rpx)→0`
- 主动忽略后退出 `120ms ease-out`，opacity→0、上移 `4rpx`
- 不用 scale、bounce、闪烁、粒子；reduced-motion 直接出现/消失

触感：仅在 Ask **首次且前台可见**时复用一次现有 host-private `socialHostNudge`，受现有 haptic grammar 开关控制；无音效、不循环；rejoin、弱网重放、轮询刷新不重复震动；participant 无任何触感。

**8 秒规则的替代**：M1 Ask 只在以下情况关闭——① 采纳 ②「先不用」③「本场不再提示」④ phase 切换 / session 结束 / Ask 失效。不得有倒计时、自动淡化或「8 秒后视为忽略」。

**决策语义必须区分（服务端持久化，非本地时间戳）**：

| 语义 | 触发 | 后果 |
|---|---|---|
| `ignored` | 仅显式「先不用」 | 同类 Ask 冷却 ≥10 分钟 |
| `expired` | phase 改变、证据失效、被新 Ask 取代 | **不算忽略，不触发冷却** |
| `action_failed_dismissed` | 失败后「先继续」 | **不能记作 host 否定建议** |
| `closed_session` | 本场关闭主动建议 | 直到 host 主动重开 |

离线可暂时收起当前卡，恢复连接后先补写决策，再接收新 Ask。

### 2.4 时刻三：采纳执行

- **0ms**：请求与幂等执行立即开始，不等退出动画；原卡保持位置尺寸，主 CTA loading「正在换话题…」，辅助行「正在同步，当前话题仍可继续」；禁止重复采纳，忽略/关闭在执行期禁用；不遮罩全页、不把话题卡换成 skeleton，participant 继续看到旧话题。
- **4 秒未完成**：只把辅助行换成「网络有点慢，当前话题不受影响」；不显示百分比、假进度条、「正在思考」或省略号动画。
- **6 秒边界，以服务端结果为唯一事实**：
  - 已生效（观察到新的单调递增 `warmupTopicSetRevision`）→「新话题已就位」
  - 策展 fallback 成功 → 同样「新话题已就位」（真实可用结果，不报技术降级）
  - 明确未生效 → 旧话题保留，「这次还没换上，当前话题保留」+「再试一次」/「先继续」
  - 结果未知 →「还没确认换新，当前话题保留」+「重新同步」，重试沿用幂等键，**不能盲目再生成一组**
- **成功反馈**：「新话题已就位」停留 **240ms**，随后 **120ms** 退出；既有 JoyJoinIcon 成功图标，无 confetti/音效/庆祝页；服务端确认后仅一次 light haptic，不做「raw tap 震 + 成功再震」双震。
- Reduced-motion / 低性能：状态文案照常更新，取消所有过渡，结果立即可读。

### 2.5 时刻四：反馈与降频

- **忽略**：单击收起 + 一次轻量 secondary haptic；不弹「已忽略」toast、不显示 10 分钟倒计时、不让 host 感到被纠正。连续忽略后的降频发生在策略层，界面表现为**更少的打扰**，不是「已降低频率」徽章。
- **本场关闭**：第三级文字「本场不再提示」，不用红色/警告图标/二次确认；服务端确认后 toast「已关闭本场主动建议」；关闭后无常驻标记；「主持人 ···」里的手动「悦仔，给点建议？」保留；菜单中仅在已关闭时增加「重新开启主动提示」，不用红点/教练气泡/新通知引导重开。
- **效果回看**：M1 不新增。不做「悦仔本次帮助了多少」卡片、折线图、参与度百分比或前后对比；不显示「氛围已变好」等界面无法证明的结论。反馈复用来自 deterministic 后续信号与 host 的采纳/忽略/关闭，trace 在后台闭环；若评测需主观 outcome label，复用既有 pulse/活动反馈渠道，不再造定时打断 host 的弹窗。

---

## 3. Participant 端话题卡过渡规格

**原则**：participant 不应知道「Agent 完成了一次任务」，只应感到主持人换了一组更合适的卡片，界面很稳。

**触发条件**：仅当客户端收到新的服务端 `warmupTopicSetRevision`。当前只监听 `currentTopicIndex` 不够——M1 整组替换可能仍是 index 0；也不能在 host 点击时提前在 participant 本地播放。

**保持不变**：L1 foil 外框、尺寸、圆角、阴影；ember rim、ready 数量、席位状态；底部 CTA 与所有点击区；当前 phase 与 host shell。

**只过渡内容**：问题文本；`第 N/M 题`、深度标记及对应 permission line；AIGC 页脚按新内容真实 meta 更新。

**360ms 双段 crossfade**

1. 0–120ms 旧内容退出：`opacity 1→0`、`translateY(0)→-8rpx`、`cubic-bezier(0.4, 0, 1, 1)`
2. 120–360ms 新内容进入：`opacity 0→1`、`translateY(8rpx)→0`、`cubic-bezier(0.22, 1, 0.36, 1)`

实现：现有 `question-zone` 内两个绝对叠放文本层，容器尺寸不变，只动画 transform/opacity；计数器 160ms 纯 opacity 切换。

**禁止**：重播首次发卡的 480ms deal / 500ms flip / sheen / halo；整组洗牌、3D 翻牌、粒子、光束、打字机；M1 换新时 permission line 静态呈现，**不重播 TypewriterText**；「悦仔已换题」「为你重新生成」toast；participant 震动或发声；请求期间清空旧卡或全桌 skeleton。

**降级**：reduced-motion 0ms 直接交换；低性能档单层 120ms opacity fade；rejoin、后台回前台、断网恢复直接绘制最终状态**不补播**；新内容到达前所有操作可用，到达后过渡也不锁点击。

---

## 4. 完整状态矩阵

| 状态 | Host 呈现 | Participant 呈现 | 决策与记录 |
|---|---|---|---|
| 首次 bootstrap / loading | 沿用现有全屏 loading，无 Agent skeleton | 同左 | 不用缓存旧 Ask 冒充有效状态 |
| 主动观察或生成中 | 完全静默，无 spinner | 无变化 | 不产生可见事件 |
| Host 手动找悦仔支招 | 沿用现有菜单及 action loading | 无变化 | 手动入口不受主动冷却影响 |
| Ask pending | 非模态浮层卡，持续到明确决策或失效 | 无变化 | 同一 phase 仅最新一条有效 Ask |
| 弱网、poll 失败 | 保留当前 Ask 与旧话题；沿用灰点与重连提示 | 旧话题保留 | 允许一次有界执行；6 秒后进入确定结果/恢复态 |
| 明确离线 | 「连接恢复后再换，当前话题保留」；采纳禁用，忽略仍可收起 | 旧话题保留 | 不启动假 6 秒倒计时；恢复后重新同步 |
| 执行中 | 原卡 loading；4 秒更新一次说明 | 旧话题可用 | 禁用重复动作，不广播 `warmupTopicsStatus='generating'` |
| 策展 fallback 成功 | 正常成功，无技术降级提示 | 正常换新 | 记录 `fallbackUsed`；非 AIGC 不显示角标 |
| 6 秒明确失败 | 「这次还没换上，当前话题保留」+ 重试 | 无变化 | 不用本地 phantom deck |
| 6 秒结果未知 | 「还没确认换新，当前话题保留」+ 重新同步 | 无变化直到服务端事实到达 | 同幂等键查询/重试，禁止重复生成 |
| 已忽略、冷却中 | 无卡、无倒计时、无观察指示 | 无变化 | 服务端记录同类冷却 ≥10 分钟 |
| 连续忽略、策略降频 | 仅表现为更少 Ask | 无变化 | 不显示频率设置或评分 |
| 本场已关闭 | 无主动 Ask；手动菜单仍在 | 无变化 | 持久到本场结束或 host 重开 |
| Rejoin 时 Ask 仍 pending | 静态恢复当前卡，不播进入动画、不震动 | 当前话题静态呈现 | 以服务端 Ask/decision 状态恢复 |
| Rejoin 时执行中 | 读取真实 action 状态，不重启本地 6 秒计时 | 当前已提交状态 | 已 ignored/closed/success 的旧 Ask 不复活 |
| Phase 切换时 Ask pending | 立即移除，不进入下一 phase | 正常 phase 切换 | 记 `expired`，不记忽略 |
| Phase 切换时 action 执行中 | 新 phase 不显示旧成功/失败 toast | 以服务端最终状态为准 | 服务端校验 expected phase；trace 保留 |
| Session 410 / ended | 沿用现有终止页 | 同左 | 清理 pending UI，不再发起动作 |
| Host 与非 host | Ask payload 服务端仅发 host，客户端再次 `isHost` 门控 | 非 host 无 Ask、菜单、角标、haptic | 角色变化后立即重算权限 |
| Ritual / celebration / tier sheet / 报告弹层 | Ask 暂缓显示或关闭，不叠层 | 原有体验 | 回到同 phase 且 Ask 仍有效时才恢复 |
| Reduced-motion / 低性能 | 全部状态可读，动画静态化 | 直接换新或单层短 fade | 动效不参与状态判定 |

---

## 5. 文案与语气

统一轻量悦仔口吻，**不描述监视证据，不判断现实冷场**。

**Ask 模板**
1. 默认：「这组话题不太好接吗？可以换一组。」
2. Phase 超过 run-plan 预算：「想换个话题继续吗？我可以换一组。」
3. 话题推进停滞：「这组先聊到这里吗？换一组新话题就好。」
4. Host 主动 pulse 表示不太顺：「刚才感觉不太顺，要换一组话题吗？」

固定动作：主 CTA「换一组话题卡」；辅助「你确认后，全桌一起换新」；忽略「先不用」；关闭「本场不再提示」。

**禁止**：「检测到冷场」「大家参与度下降」「我观察到没人说话」「智能分析」「AI 副驾」「算法判断」「实时监控」；任何个体点名、排名或参与度描述；违禁可见词与「首个」等宣传表述。

**执行与失败**：执行中「正在同步，当前话题仍可继续」；慢「网络有点慢，当前话题不受影响」；成功「新话题已就位」；失败「这次还没换上，当前话题保留」；未知「还没确认换新，当前话题保留」；重试「再试一次」；失败后退出「先继续」；关闭成功「已关闭本场主动建议」。失败路径不用语气词、卖萌或红色报警，不把责任推给 host。

**AIGC 角标**：Ask 卡最底部、次级动作之后，居中一行「内容由 AI 生成 · 反馈」，24rpx，反馈为下划线文字、点击区 ≥88rpx。显示条件必须 `aigcEnabled AND 当前 Ask.meta.aigc.aiGenerated === true`；curated、fallback、meta 缺失一律不显示。**不要照搬当前 adaptive suggestion 只看全局 `aigcEnabled` 的条件。**Ask 为策展文案但话题为实际 AIGC 时：Ask 不贴角标，话题卡按自己的 `warmupTopicsMeta` 贴角标。

---

## 6. 动效预算与禁止清单

| 场景 | 预算 |
|---|---|
| Ask 出现 | 200ms，opacity + 8rpx translateY |
| Ask 普通退出 | 120ms，opacity + 4rpx translateY |
| 执行/失败文案切换 | 120ms 单层 opacity，可静态 |
| Participant 话题换新 | 总计 360ms，最多两个文字合成层 |
| 成功确认 | 240ms 静态停留 + 120ms 退出，无庆祝动画 |

约束：单次常规反馈 ≤200ms，内容 reveal ≤360ms；不新增循环动画、逐帧 JS、`setData` 或动态 CSS variables；participant 同时最多两个动画文本层，外框与操作区完全静止；reduced-motion 与低性能均有无动画路径。

**禁止清单**：紫蓝渐变 CTA、glassmorphism、backdrop blur、霓虹光晕；雷达、扫描线、波形、观察呼吸灯、旋转光环；「AI sparkle」、机器人图标、智能徽章、科技感动效；循环 typing、三点思考、假进度条、百分比计数；常规换题的 confetti、全屏仪式、音效、群体震动；弹性/bounce 曲线、`transition: all`；动画 width/height/margin/top/left/box-shadow/filter；为 M1 重播 flip/deal/sheen/typewriter；新增 sprite-sheet 或恢复任何 mascot sprite 动画；用动画延迟网络请求、禁用操作或掩盖未确定结果。

---

## 7. 与现有代码的集成点

**建议新增**
- `apps/mini-program/src/pages/icebreaker-session/components/XiaoyueAgentAsk.tsx` — 纯展示，覆盖 pending/executing/success/failure/offline
- `apps/mini-program/src/pages/icebreaker-session/components/XiaoyueAgentAsk.scss` — 必须由 `pages/icebreaker-session/index.scss` **`@use`**；TSX 中不做 SCSS side-effect import
- `apps/mini-program/src/pages/icebreaker-session/viewModels/xiaoyueAgentAskModel.ts` — 纯状态派生，区分 ignored/expired/failure-dismissed/closed
- 必要时 `hooks/useXiaoyueAgentAsk.ts`，避免继续膨胀 `index.tsx`

**修改点**
- `components/mascot/XiaoyueSessionShell.tsx`：增加独立 `agentAsk` 插槽/props；**M1 不复用 `adaptiveSuggestion` 的 8 秒 timer**；保留 10-phase band、静态表情、host 菜单、sync dot、手动建议 fallback；feature flag 下 Ask 与旧 suggestion 只能二选一，不得叠卡
- `pages/icebreaker-session/index.tsx`：负责 host/phase 门控、overlay 仲裁、rejoin、`useResetOnShow`；状态机交给 hook/viewModel
- `pages/icebreaker-session/index.scss`：`@use './components/XiaoyueAgentAsk'`，关键 selector 纳入分包样式验证
- `pages/icebreaker-session/hooks/useSocialActions.ts`：M1 动作需独立 6 秒边界、幂等键与结果同步；**不直接复用当前 topics 的 8 秒请求与多轮 backoff 冒充 M1 的 6 秒契约**
- `WarmupPhaseView.tsx` / `WarmupCardSlot.tsx` / `.scss`：以 `warmupTopicSetRevision` 触发 quiet switch；保留首次进入 deal/sheen，M1 替换不触发；transition transient state 纳入 re-show reset
- `packages/shared/src/socialIcebreaker.ts`：增加有界 Ask/decision/action DTO 与 `warmupTopicSetRevision`；participant sanitize 必须移除 Ask 与决策字段；AIGC 用现有 `AIResponseMeta`，不另造显示布尔值
- `packages/shared/src/copy/icebreakerSession.ts`：收纳可见文案及 tone metadata

**明确不动**：`styles/_ice-materials.scss`（不新增 scrim、accent alpha 或材质等级）；`mascotConfig.ts`、`xiaoyueExpressions.ts`（无需新角色/sprite/动画资源）；现有 warmup 首次发卡仪式、ember rim、底部 dock；participant 其他 phase 页面；现有 `⋯` 手动建议入口与 rejoin catch-up 机制。

**关键工程边界**：M1 换题不能复用「全桌 generating」表现——agent 执行 pending 是 **host-only 状态**；旧话题必须保留到新 deck 原子提交；只有服务端 revision 才能驱动全端过渡；不允许客户端先显示本地 fallback deck 再被下一轮 poll 替换。

另外：**`micro_challenge` 在没有第二个真实动作的 M1 中应保持观察与反馈复用，不要展示带「采纳」承诺却仍需 host 手动完成的主动 Ask**；需要建议时保留现有手动菜单路径，避免制造假闭环。

---

## 8. 验收清单

### 视觉与渲染走查
- [ ] WeChat DevTools 检查 375×667、390×844 及一台小屏 Android
- [ ] Ask 1/2 行问题、最长辅助文案、AIGC 开/关、成功/失败/离线/禁用态
- [ ] 无孤字、截断、溢出、基线漂浮、CTA 被遮挡或底部 dock 被推挤
- [ ] 按 R1–R8 核对：Text 垂直堆叠有 block/flex-column；混合字号行 flex-center；无死 margin
- [ ] 正文 line-height ≥1.6；主问题短 display 至少 1.5
- [ ] 点击目标 ≥88rpx；禁用 CTA 在真机上无平台默认色导致的白字消失
- [ ] Ask 与 coachmark、旧 suggestion、phase intro、celebration、toast 不叠层冲突
- [ ] 无新增页面滚动；短屏仍能触达原 warmup 主 CTA
- [ ] Host 一屏只有一个悦仔视觉锚点，无第二张「AI 主卡」

### 真机与状态验证
- [ ] iOS + Android 微信真机验证 Ask 首次 haptic 仅一次，rejoin 不重播
- [ ] Participant 设备无 Ask payload、无 Agent UI、无震动，只收到话题更新
- [ ] 弱网、离线、后台、冷启动 rejoin、host 转移、410 expiry 均符合矩阵
- [ ] 点击采纳、4 秒、6 秒、phase 切换的边界做竞争测试
- [ ] 重复点击与重试不生成重复 deck；ready 数量与成员状态不丢失
- [ ] 6 秒内要么看到新 revision，要么进入确定可恢复 fallback
- [ ] Rejoin 后所有端 `topicSetRevision`、当前题目、AIGC 角标一致
- [ ] Reduced-motion 与低性能档无位移、无双层动画、无功能依赖

### 构建、性能与分包样式
```bash
npm run typecheck -w mini-program
npm run test -w mini-program
npm run test -w @joyjoin/server
npm run guardrails
npm run design:audit:changed
npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program
npm run check:package-size -w mini-program
```
- [ ] 不产生非空、页面不可见的 `sub-common.wxss`
- [ ] 新 Ask 关键 selector 出现在 `icebreaker-session` 页面 WXSS
- [ ] 无新增 raster 资源与明显包体增长
- [ ] DevTools Performance 无 layout-triggering animation、无逐帧 JS 更新；中端机目标 60fps
- [ ] H5 可复现时运行 `audit:visual`；不可复现时用 WeChat DevTools/真机截图 + vision review 并注明原因，不能仅凭单测签核视觉

### 用户视角审计
Host 自问：
- [ ] 我是否一眼知道「要我决定什么」，而不需要理解 Agent？
- [ ] 我是否感觉自己在掌控，而不是被系统催促？
- [ ] 我能否毫不犹豫地忽略或永久关闭？
- [ ] 网络慢时，我是否知道当前话题还能继续用？
- [ ] 我是否从未看到对个人或全桌的评分、监控和判断？
- [ ] 下一次主持时，我是否仍愿意保留这项能力？

Participant 自问：
- [ ] 我只感到话题自然换新，而没有感到「AI 介入了这一桌」吗？

---

## 9. 设计风险 Top 3

**1. 健康安静被误判为冷场** — 一桌人正聊得投入，host 却收到「救援」提示，监视感与误报同时发生。
对策：activeRate 绝不单独触发、不进可见文案；不做常驻观察指示；Ask 用假设式可选择措辞，「先不用」就是低成本纠错；验收优先看健康场误 Ask、投诉与关闭率，而不是点击率。

**2. 可执行 Ask 从「帮忙」变成新的打断源** — 为证明 Agent 存在而频繁弹卡，host 最终永久关闭。
对策：无决策不展示；一个 phase 最多一个有效 pending Ask，不排队；无真实动作的 `micro_challenge` 不制造假闭环；卡片非模态、无 scrim、无倒计时；关闭入口始终同卡可见；降频的成功标准就是界面更安静。

**3. 弱网与动画共同制造「已经成功」的假象** — host 看到新卡，其他端却没变；或超时后重复生成、rejoin 回滚，信任一次归零。
对策：只信服务端 revision，不用本地乐观 deck；请求期间保留旧卡，原子提交后全端才过渡；幂等键贯穿执行、重试与 rejoin；6 秒区分成功/明确失败/结果未知；动画只跟随已确认状态，绝不承担状态判断。
