# T46 P1c 游客预告卡 — 用户视角情绪 rubric 报告

> 2026-10-20 · user-satisfaction-audit（Persona walk + 六维情绪 rubric + 编排裁决）
> 审计对象：`components/onboarding/GuestEventPreviewCard.tsx` / `GuestEventPreviewSection.tsx` / `GuestEventPreviewCard.scss`，插入点 `pages/onboarding/personality-test/results/FinalStage.tsx:766-770`，登录发射 `results/hooks/useResultsLoginHandoff.ts:160-167`
> 审计纪律：只审计不改代码。🔴 文案红线扫描 = 零命中（交付源码 + contract test 双重锁定）。
> 证据基准：**源码级审计**（本 sprint 审计惯例）。实机渲染证据（DevTools 截图/录帧）在合并前批次统一补——本报告所有「待实机确认」结论在 §10 集中列出，未确认项不影响源码级结论的成立。

---

## 1. Scope & Persona

- **Surface**：测评结果页（FinalStage）底部新增的游客预告卡 section——整页旅程的尾段（收集格 → 预告卡组 → 登录墙）。
- **Entry point**：匿名用户答完 8–16 题 → slot 机悬念 → 原型揭晓庆典 → 下滑经过命格图鉴 → 抵达本 section。
- **Persona**：**A — 首见用户**（24 岁深圳白领，10 分钟前从朋友分享链进来，做完了匿名测评，刚拿到原型）。注意力预算 ~30 秒，拇指悬在退出键上。这是本 surface 会遇到的**最不熟悉**的用户，也是最严苛的清晰度评判者。
- **不是本审计的对象**：命格图鉴、分享海报、slot 机庆典（既有面，仅作上下文）；EventFlowStrip / FAQ（同 sprint 另案审计）。

---

## 2. 第一人称旅程 walk（Persona A）

> 我刚测完，老虎机咔哒咔哒转完，蹦出来我的原型——开心柯基。上面那一屏挺热闹：海报、解读、悦仔气泡。我往下划。

**Beat 1 — 命格图鉴** ✦
「已解锁 1/12」——收集感很轻，一闪而过。好，我是 12 种命格里的一种。

**Beat 2 — 三张卡升起来** ✦
往下一划，三张卡片安静地升上来，图从轻微放大落回画框里，差不多一秒内全部落定，结尾有一下很轻的震动（不是庆典那种，是「笃」一下收住的感觉）。像是有人把三张真实的卡片推到我面前：

- 「周五微醺小聚」· 10月30日 周五 · 19:00 · 酒局 · 南山区
- 「还剩 5 座」

哦。**这些局是真的。**刚才那个原型不是问卷玩具，这座城市里周五真的有一桌酒局在等人。这个转折是这一屏给我的一下心动——庆典之后的第二拍，quieter but real。

**Beat 3 — 我读卡** ✦
一行读完：什么时候、什么局、在哪个区、还剩几座。不用解码，没有黑话。「还剩 5 座」是个安静的事实，不是「仅剩 5 席！！！」那种鬼叫。我信它。

**Beat 4 — 我想去，我问：多少钱？** ⚡
「我想去」的念头刚起，下一个念头就是「多少钱」。卡上没有，这屏上哪儿都没有。朋友链进来的我，对「付费局」是有心理准备的，但完全没有锚点。行吧，先登录看看。（⚡ 摩擦：决策信息缺一块——见 N2）

**Beat 5 — 钩子句 + 登录按钮** ✦
「微信登录，为你留座」——七个字，「留座」这个词我很喜欢，像餐厅订位，不像互联网黑话。下面就是那个绿色的微信按钮。

**Beat 6 — 三连同登** ⚡
等等——「微信登录，为你留座」下面还有一行小字「登录后，悦仔就开始为你寻找同频的人」，再下面按钮写着「微信登录，查看谁和你最搭」。三个登录请求连着排：留座？找同频？看谁最搭？三个承诺，三个说法。我停顿了一下——不是困惑到要退出那种，是「你们到底想说什么」的一下眨眼。（⚡ 摩擦：pitch 堆叠稀释了钩子句的锋利——见 C1）

**Beat 7 — 我点了卡（另一条路径）** ✦
其实我刚才先点的是卡片本身——也震了一下，弹出来「微信登录…并看看为你准备的局」，和卡上说的是同一件事，没有落差。好。

**Beat 8 — 心理账户** ✦
周五 19:00，南山区，还剩 5 座。这个局**有时间、有地点、有名额上限**——它会在我登录与否的情况下照常在周五发生。这让我有理由现在登录（留座），也有理由周五前回来看看（万一没登录）。这就是「会过期的事实」自带的分量。

**Exit risk 评估**：低-中。转化路径无死胡同（点卡/点按钮殊途同归），最大泄漏点是 Beat 4（无价锚）和 Beat 6（pitch 堆叠）——都是「迟疑」级，不是「退出」级。

**加载/空/错态 walk（单独 beat 组）**：
- **数据加载中**：section 完全不存在（byte-level null），上方是图鉴、下方是登录墙——快速下滑时会穿过一个「还不存在」的缺口，无骨架。可接受（fail-closed），但快速滑动时有轻微布局跳动感（N3）。
- **供给不足 3 场 / 接口报错 / flag 关闭**：整组不渲染，页面退回 legacy 终态——游客看到的就是登录墙本身。**这是正确的安静**（不渲染「暂无场次」这种哭丧脸，是设计纪律的胜利）✦。
- **reduced-motion / observer 缺失**：静态直出，内容与 CTA 完整可用，曝光埋点照发（交付方声明偏离 #3，源码核实为正确决策——漏斗分母不能丢）✦。
- **CDN 图失败**：奶油色底卡照常升起，文字永远活在奶油罩上——降级态有尊严 ✦。

---

## 3. 情绪价值 rubric（六维，各 0–4）

评分基准：交付 section 所在的整页尾段体验（庆典在上方已交付的情绪属上下文，不计入本交付物的创造）。对抗性默认 2 分起，证据上下调。

### 编排版（observer 正常路径）

| 维度 | 分数 | 证据 |
|------|------|------|
| 归属感 | **2** | 真实饭局/酒局可见，但卡上零人味信号（没有同桌的人、没有社区语言）；归属感的真正来源是上方刚揭晓的原型，本 section 只负责「把它接到真实世界」。 |
| 成就感 | **2** | section 自身无完成庆祝（这是转化面不是里程碑面，本就不该抢功）；默认 2 分不动摇。 |
| 身份认同 | **3** | 奶油卡 + display 字役标题 + 安静事实行，register 与品牌一致；「为你留座」是对我个人的直接称呼，不装熟、不客服腔。 |
| 惊喜感 | **3** | Beat 2 是明确的惊喜时刻（「这些局是真的」）；编排（升起 + Ken Burns 定场 + 一句钩子落定）是 crafted 的、一次性的。不到 4：全 session 唯一的微笑已在 slot 机用掉，这里是余韵不是第二峰。 |
| 被理解感 | **2** | 卡是「深圳 + 最早三场」的通用供给，与我的原型结果无任何关联；钩子说「为你留座」，但「你」并没有被理解——展示的不是「我的局」，是「存在的局」。设计上有意不个性化（范围控制正确），但 felt experience 就是浅。 |
| 仪式感 | **3** | 滚动抵达 → 卡组次第升起 → 图像定场 → 钩子句落位 + 单次轻 haptic = 微型的 build-up → reveal → settle；与庆典峰值有 ≥400ms 硬隔离（源码 MIN_SETTLE_GAP_MS + observer 触发点天然靠后）。不到 4：这是转化仪不是成年礼。 |
| **合计** | **15/24** | |

### 静态版（reduced-motion / observer 缺失路径）

| 维度 | 分数 | 与编排版差异 |
|------|------|------|
| 归属感 2 / 成就感 2 / 身份认同 3 / 被理解感 2 | 不变 | 内容 identical |
| 惊喜感 | **2** | 内容惊喜保留（「真实的局」），crafted 感消失 |
| 仪式感 | **1** | 直出即终态，机械呈现，零 occasion 感 |
| **合计** | **12/24** | |

### 门槛判定（有规格歧义，需 orchestrator 裁决）

- **设计规格 §4 既定门槛**：P1c ≥ **14/24**（`docs/deliberations/2026-10-20-t46-design-strategy-confirmation.md` §4 情绪价值 rubric 行，明确标注 /0-24）。编排版 **15/24 ✅ 通过**；静态版 12/24 ❌（若设备走静态路径，情绪面跌破门槛——这正是「编排必须赢」规则的量化体现）。
- **本任务书门槛**：「情绪 rubric（0–20），≥14」。按 0–20 归一（15/24×20 = **12.5**）则不通过。⚠ **两个口径冲突**（12.5 < 14 vs 15 ≥ 14），倾向解释为任务书笔误（设计冻结稿写的是 /0-24 ≥14），请 orchestrator 确认口径。**无论用哪个口径，方向性结论不变**：静态版必须被击败、编排版保住了这个差值；且 §5 的六维用户分（17/24，愿意回来带）不受此口径影响。

---

## 4. 编排版 vs 静态版裁决

**裁决：KEEP 编排。**

| 判据 | 证据 |
|------|------|
| §5.4 既定规则（编排情绪分 ≥ 静态） | 15 vs 12 ✅ 满足（+3 全来自仪式感/惊喜感，正是编排要买的两个维度） |
| 全部防爆红线 | 源码 + contract test 双锁：无 loop 上内容（唯一 infinite 是 loading shimmer，GPU-safe opacity 脉冲，repo 既定模式）；无 confetti 二用；无 urgency 词（仅剩/抢手/马上/赶快/手慢 被 contract test 锁零命中）；无滚动视差；阴影不动；transform+opacity only；总 880ms ≤ 1000ms ✅ |
| 克制感成立？ | 成立。880ms 里只有三下动作（升、定、落）+ 一次 light haptic。haptic 用 light 不用 success——庆典峰值属于 slot 机，钩子是余韵，分寸正确（InsightRevealCard 先例的正确移植）。 |
| 降级尊严 | 奶油降级参与同一编排、文字恒在奶油罩上、reduced-motion 双保险（JS 门 + 页级 CSS !important 兜底）✅ |
| 性能风险 | transform/opacity only + one-shot + opacity 脉冲 shimmer，无 layout 动画；掉帧面小（中端机录帧待确认，§10） |

**规格内部矛盾备案**：设计 §5.3.5 原文「第三张卡落定后 150ms（总序列 ≈880ms）」自身算不平（card3 落定在 580ms，+150+350 = 1080 > 1000）。实现选择忠于 ≤1000ms 硬纪律（钩子 +530ms 启动、与 card3 尾部重叠 50ms，同为曲线尾段，感知上无缝）。**实现的选择是对的**，建议回改设计稿一句话消歧（N5）。

---

## 5. 六维用户满意度打分（各 0–4，对抗性默认 2 起）

| # | 维度 | 分数 | 证据（walk beat） |
|---|------|------|-------------------|
| 1 | 3 秒 clarity | **3** | Beat 2/5：这屏是什么（真实的局）、下一步干什么（微信登录），绿色主按钮权重无可争议。扣一分在 Beat 6 的三连 pitch 需花一秒调和三个承诺。 |
| 2 | cognitive smoothness | **3** | 卡片事实行一行读完（10月30日 周五 · 19:00 · 酒局 · 南山区 / 还剩 5 座），无时间戳黑话、无状态枚举泄漏。唯一重读点在 Beat 6（钩子/副标/按钮三文案调和）。 |
| 3 | holistic cleanliness | **3** | 眯眼测试通过：三块奶油卡 + 一行 display 钩子 + 一颗绿按钮，单一视觉故事。页底累积密度偏高（重测 banner + 3 卡 + 钩子 + 副标 + 双按钮），每个 block 各自干净但整体是「满的」——不是吵，是满。 |
| 4 | emotional resonance | **3** | 情绪 rubric 15/24 → 3（映射表 15–19 → 3）。心动时刻 = Beat 2。 |
| 5 | return hooks | **3** | Beat 8：有具体时间/地点/名额的局是会过期的 pending thread——「周五那桌酒会在我登录与否的情况下照常发生」是被感觉到（felt）而非被告知的回来理由。若抽掉这个事实层只剩「悦仔会帮你找人」的 stated 承诺，本维度掉到 2。 |
| 6 | share-worthiness | **2** | Beat 级证据：我不会截图这三张卡发给朋友——干净但与我无关（无个人数据、无原型关联），截图后说不出「你看这个」。本屏的分享载体是上方的原型海报（既有 UX）；本 section 的正确 KPI 是转化不是转发。**作为已知限制保留**，不建议为本 section 硬造分享点（那会稀释它的唯一任务）。 |
| | **总分** | **17/24** | |

**Band：愿意回来（15–19）**。非峰值 cap 情形（angle 4 = 3 > 2）。Band 指引「fix every angle ≤2 before ship」→ angle 6 的唯一修法是把分享做进转化面，判断为方向性错误，保留 2 分并以「已知限制」豁免（理由见上）。

**Grill-me 应答**：无 4 分项；≤2 项为 angle 6，hesitation beat 已标注（Beat 5/6——我不会截图它）。

---

## 6. 用户四问 verdict

| 问题 | 答案 | 为什么 |
|------|------|--------|
| 会分享吗 | **否**（section 级）/ 是（页面级） | 分享载体是原型海报；预告卡是转化面不是传播面。 |
| 明天会回来吗 | **是** | 周五 19:00 的微醺小聚还剩 5 座——具体、会过期、与我刚测出的原型在同一个 App 里。 |
| 会推荐吗 | **条件性会** | 「测个 8 题的小问卷，最后会给你看真实的局」——test→reality 的衔接顺滑且诚实，值得安利；前提是登录后的详情页兑现卡上承诺（超出本审计范围）。 |
| 会为此付费吗 | **还没到** | 登录前无价锚（Beat 4 ⚡），付费意图在登录后的详情/收银台才形成。对本转化面是「可接受的延迟」，但对整体 funnel 是 N2 的根据。 |

---

## 7. 发现清单

### 🔴 BLOCKING
**无。** 🔴 文案红线扫描（匹配/社交/灵魂/AI/算法/智能/撮合/仅剩/抢手）在交付源码零命中，且被 `GuestEventPreviewContract.test.ts:174,182` 锁定为回归测试。零 PII（schema .strict() 双向合同锁，含 tainted-key 反泄漏测试）。无源码级 Class A 渲染缺陷证据（实机复验在 §10）。

### 🟠 CONCERN（不阻塞 ship，进修复单）

| # | 发现 | 证据 | 建议修法 | 路由 |
|---|------|------|---------|------|
| C1 | **三连登录 pitch 堆叠**：钩子「微信登录，为你留座」→ next-horizon「登录后，悦仔就开始为你寻找同频的人」→ 按钮「微信登录，查看谁和你最搭」三个相邻元素三种承诺，稀释设计 §5.3.5 的「句→钮」对位（中间被 next-horizon 隔断）。 | `FinalStage.tsx:776-791`；walk Beat 6；angle 1/2 各扣一分 | 预告 section 渲染时（guest 且有供给），抑制 guest 态 next-horizon（「悦仔帮你找人」promise 与钩子句职能重复），把「句→钮」还给钩子；或统一为一个承诺口径。copy 变更需双签。 | frontend-hook-engine（CTA 层级）+ copy 双签 |
| C2 | **「还剩 0 座」可渲染**：服务端资格判定不过滤满员 pool（只查 active/deadline/city/test），容量口径下 spotsLeft=0 的活跃 pool 合法存在（Discover 对它们显示「已满员」）；卡组件无满员态，会渲染「还剩 0 座」——游客视角读作 bug 或陷阱，且该卡对 guest 无可行动路径（唯一 CTA 是登录订座）。极端情形：3 张全 0。 | `guestEventPreview.ts:83-172`；`GuestEventPreviewCard.tsx:90` | 二选一：服务端过滤 spotsLeft>0（推荐——guest 面只放可行动的局；注意与 ≥3 供给门的相互作用）；或卡上加安静「已满员」态（复用 OracleCard full-state copy）。 | backend-engineer（+ copy 若走满员态） |
| C3 | **observer 静默不触发的「不可见」尾巴**：try/catch 覆盖构建/调用抛错，但「observe 回调永不触发」不在防御范围内——此情形下 phase 永远停在 pre，卡片 opacity:0 永久不可见、曝光埋点丢失、整组 P1c 静默失效（功能级失败模式）。同模式在 HeroPromoBanner/AlangDiscoverCard 有设备先例（大概率无事），但本面是转化关键面。 | `GuestEventPreviewSection.tsx:134-202`；无 watchdog | 加 ~2.5s watchdog：数据就绪后超时未触发 → flip static（5 行内，fail-closed 到静态直出，与设计「绝不 fail 到不可见」一致）。DevTools 批次顺带验证 observer 在 results ScrollView 内确实触发。 | taro-engineer 或 frontend-engineer |

### 🟡 NIT

| # | 发现 | 建议 |
|---|------|------|
| N1 | 卡总高 ~290rpx（hero 176 + facts ~116），高于设计建议 ≤240rpx；3 卡 + 钩子 ≈ 900rpx，667px 短机上登录 CTA 被推到约 2 屏深。设计 §2 的「667px 验证」本就是 merge 前置，结论待 DevTools 批次；若实测 CTA 过深，短视口减至 2 张是规格内置的泄压阀。 | 实机验证后定夺 |
| N2 | 登录前全程无价锚/费用信号（Beat 4 ⚡）。产品是付费局，「我想去→多少钱」是天然决策链。设计四事实刻意不含价格；是否补一个安静的「¥88/位起」级 live 事实，是 PM 级权衡（价锚促转化 vs 门口报价吓客）。 | PM 决策；若补，走 live query + quiet fact，禁 urgency |
| N3 | 数据在途时 section 渲染 null，快速下滑穿过「不存在的缺口」有轻微布局跳动。低概率低伤害，不修可接受。 | 观察 |
| N4 | 城市硬默认深圳（client 不传 city，server 兜底）——非深圳访客看到的是异城局，被理解感进一步打折。登录前申请定位权限得不偿失，列为未来杠杆。 | 产品 backlog |
| N5 | 设计稿 §5.3.5 内部算式矛盾（+150ms vs 880ms 总长），实现正确选了 ≤1000ms 纪律。 | 回改设计稿一句话 |

---

## 8. 交付方声明偏离的核实（3 项，全部认可）

| 声明偏离 | 源码核实 | 裁决 |
|---------|---------|------|
| haptic 调度点从 observer effect 移到 entered-phase 自带 effect | `GuestEventPreviewSection.tsx:124-130`：observer effect 的 cleanup 恰在 phase 翻转瞬间执行，其拥有的 timer 会被清掉；挂在 entered effect 上 timer 生命周期正确，haptic 恰一次（render test 断言 toHaveBeenCalledTimes(1)） | ✅ 正确，注释已说明因果 |
| guestPreviewLoginPending 守卫 | `useResultsLoginHandoff.ts:160-167`：flag-off/供给不足游客走普通 CTA 登录时**不**发 guest_preview_login_success，杜绝幻影 attempt 污染 guest_to_login_conv；正常 CTA 的既有事件（login_cta_tap / login_handoff_duration）原样保留 | ✅ 正确，分母分子都干净 |
| 静态路径 impression 补发 | `GuestEventPreviewSection.tsx:116-119`：reduced-motion/observer 缺失时卡确实可见，曝光照发——漏斗分母不塌、两路径可比 | ✅ 正确（设计未禁止，且不发反而是数据缺陷） |

---

## 9. 已审计并明确保留的长处（勿在修复中回退）

1. **Fail-closed 全家桶**：flag off / 供给 <3 / 接口错 / auth loading / 已登录 / observer 抛错 / reduced-motion，七条路径全部落到「字节级 null 或静态直出」，没有一条 fail 到错误页或不可见（render test 全覆盖）。
2. **安静的供给纪律**：<3 场整组不渲染，不渲染「暂无场次」哭丧脸——克制是设计本体。
3. **factual-not-scarcity 平移成功**：「还剩 X 座」是 live query 安静事实，口径与详情页容量一致（server 注释明示 mirror resolvePoolCapacity），urgency 词表被 contract test 锁死。
4. **编排纪律**：单曲线 cubic-bezier(0.22,1,0.36,1)、400/90/180 stagger、Ken Burns 与升起同帧同曲线、钩子 +530/350、单次 light haptic、总 880ms——与设计 §5.3.5 逐 token 对上（contract test 锁定）。
5. **零新增资产 + 零吉祥物配额侵占**：vignette 复用 pool-registration ceremony CDN 条目，CDN 失败奶油降级且参与编排（ProfileReviewInviteCard 先例的正确移植）。
6. **埋点纪律**：4 事件 client union + server whitelist 双登记（`analytics.ts:309-312`）、guestAttemptId 自动携带、enum-only 零 PII。
7. **语汇连续性**：「留座」钩子、「正在为你排桌…」登录成功 toast、与 EventFlowStrip 的「订座→悦仔排桌→集结房间等开席→现场入座」及 FAQ #2 同一条 canonical 词汇链，无一处口径漂移。
8. **可达性**：卡 role=button + 完整 aria-label（含「点击微信登录后查看」）、reduced-motion 页级 CSS !important 双保险。

---

## 10. 待实机确认清单（合并前 DevTools 批次，对应本报告每一处渲染依赖结论）

- [ ] **Class A 扫描**（重叠/裁切/对比度）：title absolute 叠 scrim（vignette 与奶油降级两态）、事实行窄机换行孤字、hook 与按钮垂直节奏。
- [ ] **667px 视口**：登录 CTA 首屏可达性（N1）——3 卡 + 图鉴 + 海报的完整页高实测。
- [ ] **observer 在 results ScrollView 内触发验证**（C3 的前置事实）+ 若成立顺手加 watchdog。
- [ ] **中端机录帧**：升起 + Ken Burns + shimmer 的帧率（performance-audit 的 P1c PASS 门禁 input）。
- [ ] **慢 CDN 时序**：图迟到时 shimmer 与升起动画的叠加观感。
- [ ] **880ms haptic 的体感**：与 slot 机庆典的隔离感（≥400ms 门 + observer 触发点双重保障是否可感知地成立）。
- [ ] **swipe-back 重入**：页面栈存活下 observer once-only 不重演——重进时直出静态的观感（once-only ref 随页面实例存活，预期静态直出，属可接受）。

---

## 11. 总 verdict

- **情绪 rubric**：编排版 **15/24**（设计门槛 ≥14 ✅）；静态版 12/24。任务书 0–20 口径（归一 12.5）与设计稿 /0-24 口径（15）存在歧义，已上报裁决，不改变方向性结论。
- **编排裁决**：**KEEP 编排**（15 ≥ 12，红线全过，克制感成立）。
- **六维用户分**：**17/24 — 愿意回来**。
- **Ship 判定**：**ship-with-fixes**——零 BLOCKING；C1（pitch 堆叠）/ C2（0 座渲染）/ C3（observer watchdog）进修复单后再全量；N1 绑定 DevTools 批次结论。
- **分享/回来/推荐/付费**：否（section 级）/ 是 / 条件性会 / 未到——对一个登录前转化面，这是它该交的全部答卷。

---

*报告人：user-satisfaction-auditor（Persona A 视角）· 2026-10-20 · 源码级证据，渲染证据待 §10 批次补齐*
