# 破冰 recap 分享通路 + quip 灵感 chips 实施规格（2026-10-20）

> 状态：**已批准立项，可直接按图施工**。纯文档，零代码。
> 输入：`docs/deliberations/2026-10-16-icebreaker-uiux-audit.md` §7 P1（recap 零分享通路）、`docs/deliberations/2026-10-20-icebreaker-polish-review-and-commercial-memo.md`（recap 分享升级 P0 = CAC 第一杠杆；⑥quip chips 赞同加界入 P2）。
> 文案纪律：`docs/copy/brand-copy-strategy.md`（🔴 Hard Rules）+ 微信审核姿态（可见文案禁 社交/匹配/灵魂/撮合/AI；分享物料禁激励性措辞，防诱导分享）。
> 施工许可范围（沿用 10-16 审计 §4.3）：`apps/mini-program/src/pages/icebreaker-session/` + `packages/shared/src/copy/` + 服务端 analytics 白名单；不许顺手波及 tab 页。

---

# 规格一：recap 分享通路

## 1. 路线选型（三选一）

| 维度 | (a) 复活 MomentCardView 暗色卡 | (b) insightPoster 管线小程序海报 | (c) 纯 onShareAppMessage 原生卡 |
|---|---|---|---|
| 开发成本 | M–L：孤儿 700+ 行需重新挂载、chrome token 化、遥测接线、与现行浅色 recap 设计语言对齐 | M：新 draw 函数 + hook 复用 + 视图接线；管线已有两次实战（insightPoster 2026-10-15、keepsakeCard event-feedback） | XS–S：一个 hook + title/path/imageUrl |
| 分享转化 | 中：主路径仅保存相册，无 QR 归因、无 action sheet | 高：保存相册 + `showShareImageMenu` 直接转发 + referral QR 归因（`fetchShareQrCodeImage` 现成） | 低–中：无个性化物料，静态 `imageUrl`（CDN 图可用，city-unlock 先例） |
| 品牌一致性 | 中：暗底虽有 artifact 例外登记（10-16 审计 §4.2），但与现行浅色 premium recap 视觉断裂 | 高：1080×1560 浅色 results 公约，两次过审先例 | 中：微信原生卡，品牌靠 title + 静态图 |
| 维护负担 | 高：第二条 canvas 管线，违 `eventFeedbackFlow.test.ts`「no parallel fork」纪律；与服务端 `momentCardRenderer.ts` PNG 实现长期漂移 | 低：共享 `canvasHelpers` / 权限链 / QR 管线 / 测试范式 | 低 |

**推荐：(b) 为主路线，(c) 为同 PR 伴随项**（页面级转发入口，边际成本近零，二者共用 title 与归因约定——(c) 不是独立路线，是任何分享策略都需要的原生出口）。**(a) 明确否决**：

- `MomentCardView.tsx` 保持孤儿、不复活、不挂载；10-16 审计 §4.2 的 artifact 例外登记继续有效，文件暂留（其 keepsake 导出函数被 `momentCardKeepsake.test.ts` 消费）。
- 服务端 `GET moment-card.png` 路由维持 flag-OFF（`SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER`，`socialIcebreakerGameplayExtra.ts:214`），本次不通电。
- 登记退役债：海报上线且数据验证后，另立清理项删除 MomentCardView + momentCardRenderer（双实现漂移源）。

## 2. 产物内容（海报契约）

**画布**：1080×1560 竖版（results 页公约），legacy `createCanvasContext` + 隐藏 `<Canvas>` + offscreen SCSS，完全镜像 `lib/onboarding/insightPoster.ts` 纪律（含 spy-locked 单测范式）。

**数据全部来自既有 props/state，零新服务端字段**：

| 区块 | 内容 | 数据源 |
|---|---|---|
| 顶部 chrome | 「今晚的破冰纪念」+ `JoyJoin 悦聚` 字标 | 静态 |
| 局名日期 | 「畅聊局 · 2026.10.20」 | `session.eventTier` → 破冰局/畅聊局/狂欢局（tier manifest）；日期 = `sessionStartedAt` 客户端格式化 |
| 我的勋章 | 勋章名 + 「我拿到了」；无勋章则省略该区块 | `medals` prop 中 recipient = 当前用户（glow 场合同理取 glow block 同源数据） |
| 高光引文 | 一条引文，**不署名**（不用他人 displayName） | 优先级：`momentPanel.highlights[0].narrative`（面板已生成时）> `summary.moments[0]` / `recapData.funMoments[0]` > 静态兜底句 |
| 桌友群像 | 本桌原型图标横排（≤6）+「N 位有趣的桌友」 | `participants` prop 的 `archetype`（CDN 资产，canvas 走网络 URL 纪律）；**只画图标，永不画他人昵称** |
| QR 带 | referral QR + 「扫码，遇见对味的局」 | `fetchShareQrCodeImage()` fail-open；失败 → copy-only 带（沿用 insightPoster 固定文案白名单） |

**隐私硬契约（镜像 insightPoster REL-02/SEC-01）**：海报输入类型结构化排除他人身份信息——他桌成员只允许 archetype 图标 + 计数进入 canvas 原语；引文不带署名；本人 displayName 可选（与 insightPoster 同策）。spy 测试锁定。

**AIGC 角标规则（fail-closed）**：引文取自 AI 生成内容（moment panel / recap summary，均有 meta）且 `aigcLabelsEnabled` → 烘焙「内容由 AI 生成」；取自静态兜底句 → 不烘焙。

**文案（微信审核姿态复核后候选）**：
- 分享卡 title：`今晚这桌，聊得很对味` / `我们 N 个人把今晚聊热了`
- 海报兜底引文：`有些晚上，值得被记住`
- 全物料零激励措辞（无「快来/助力/领取/免费」），零 社交/匹配/灵魂/撮合/AI 字样——上线前过 brand-copy 🔴 扫描。

## 3. 入口与动线

三个出口，共用同一份 poster 生成/分享动作层：

1. **高光面板（主入口）**：`MomentHighlightsPanelView` 底部从单一「看完了」改为双按钮——主 CTA「存下这张高光卡」+ 次「看完了」。面板已打开说明引文数据就绪，转化最高点。
2. **CardFlip 背面**：「生成高光」按钮旁加「直接存卡」次 CTA（不打开面板也能分享，引文走 funMoments 回退链）。
3. **页面级转发**：session 页注册 `useShareAppMessage`（Taro hook，invite/city-unlock/results/squad-unboxing 四处先例），返回上述 title + referral 归因 path + 静态 CDN `imageUrl`。recap 相位在出口区加 `openType='share'` 的分享 `Button`（**微信机制硬约束：转发面板只能由 openType='share' 的 button 触发**，`Taro.showShareMenu` 开不了，invite 页 §G.3 已实证）；其余相位不显示该按钮，只保留 ··· 菜单能力。

**动线**：点「存下这张高光卡」→ 离线预检（`getNetworkType`）→ 生成中态（复用 `AiGenerationShell` 量级即可，全屏不必）→ action sheet「保存到相册 / 分享给好友 / 预览」（`showShareImageMenu` 能力检测降级，镜像 `useInsightPosterShare.presentShareOptions`）→ 保存走 `getSetting→showModal→openSetting` 权限链 → 成功 toast「已保存到相册」。临时文件 finally `unlinkSync`。

**归因**：`useShareAppMessage` 的 path 复用邀请页 `buildReferralMiniProgramPath` 约定（referralCode → landing，非参与者**绝不**落到 session 页——session 页有参与者 403 闸）；poster QR 本身已是 referral 归因码。两条链都汇入既有 pendingReferralCode / referral_conversions 体系，无需新归因基建。

## 4. flag 与回退

- **新 flag `recapSharePosterEnabled`**：DB-backed（`lib/featureFlags.ts`  canonical resolver，env fallback），经 `GET /api/auth/user` features 暴露给小程序；默认 dark。控制：海报两个 CTA + 页面级 `useShareAppMessage` 注册（OFF 时该 hook 返回 undefined/不注册，保持现状零分享）。
- **旧客户端回退**：服务端零变更——海报纯客户端渲染；保存/分享遥测复用既有 `POST moment-card-event`（action `save`/`share` 白名单早已存在但零调用方，本次正好通电，见 release-train 文档 T-3 孤儿图谱）；`generate` 埋点（`momentCardTelemetry.ts`）已在。旧版客户端无入口、无 403、无新 DTO。
- **回滚**：flag 置 OFF 即整体消失；无 schema、无路由、无数据迁移。

## 5. 验收 AC 草案（供 sprint contract 直用）

1. flag OFF 时，高光面板仍只有「看完了」、CardFlip 背面无新 CTA、页面不注册分享——与现状逐像素一致（截图对照）。
2. flag ON 时，高光面板出现「存下这张高光卡」主 CTA，CardFlip 背面出现「直接存卡」次 CTA，recap 相位出现 openType='share' 按钮；非 recap 相位不出现该按钮。
3. 点 CTA 后：离线 → 提示网络异常且不进入生成；在线 → 生成 → action sheet 三选项（无 `showShareImageMenu` 能力时降级为两项）；保存权限拒绝 → 引导 openSetting；全流程失败 toast 文案走 copy 模块、无英文泄漏。
4. 海报内容断言（spy 测试）：含局档名+日期、本人勋章（如有）、引文、≤6 原型图标、品牌字标、QR 或 copy-only 兜底；**canvas 原语入参中不存在任何他人 displayName**（结构化排除 + 间谍锁定）。
5. 引文为 AI 来源且 `aigcLabelsEnabled` → 烘焙「内容由 AI 生成」；静态兜底句 → 不烘焙；角标缺条件时一律不渲染（fail-closed）。
6. 保存成功 → `moment-card-event {action:'save'}`；菜单分享成功 → `{action:'share'}`；fire-and-forget，失败不阻塞 UI（toast 不受遥测成败影响）。
7. `useShareAppMessage` 返回 title 过禁用词扫描（社交/匹配/灵魂/撮合/AI/激励词表 = 0 命中），path 携带 referralCode 且非参与者打开落 landing 页而非 session 403。
8. 服务端零新增：无新路由、无新 DTO、无 schema 变更；`momentCardRenderer` PNG 路由保持 503 flag-OFF 行为不变。

**度量**（搭补6 健康指标便车）：分享率 = (`save`+`share`) / `generate`，目标 ≥15%（备忘录口径，待验证基线）；wave3 漏斗 SQL 的 moment-card 段直接可用，无需新表。

---

# 规格二：quip 灵感 chips 内容池

## 1. 分层法则（落地为设计约束，写入模块头注释）

- **chips = 静态策展**：纯客户端常量池 + 纯函数取样，**零 LLM 调用、零网络请求**。
- **零 AIGC 角标**：角标 fail-closed 原则（仅当内容确为 AI 生成才渲染）⟹ 策展 chips 天然不挂角标；任何「给 chips 挂 AI 标」的改法都是违规。
- **去 mascot 化**：chips 区不出现悦仔形象/口吻/「悦仔」字样；引导语用中性系统文案「灵感起手」（toneMode = system-ui）。
- **永不与生成式通道并排**：chips 与「悦仔帮我写」类 AI 生成入口（现存于 lie_detective compose，`LieDetectiveHeroView.tsx:320`）**不同屏共存**。quip_battle 当前无 AI 帮写；未来若给 quip 加生成式帮写，必须先下 chips 或做二选一互斥开关——此条写进 `socialIcebreakerYuezaiCopy` 相关设计注释与 review checklist。

## 2. 内容池（27 条，9 族 × 3）

落位：`packages/shared/src/copy/quipInspirationChips.ts`（copy 治理纪律：用户可见文案集中管理），每条 ≤16 字、零 emoji、零禁用词，覆盖 quip fallback 题库全部 category（自嘲/生活/幻想/比喻/状态/脑洞/时光/身份/假设/社死/拟人/互动/秘密/情感/吐槽）。

| 族 | chips（id 后缀 01–27） | 覆盖题型 |
|---|---|---|
| 爆料式 | 说出来你们可能不信 / 我最后悔的一次 / 有次我脑子一热 | 生活、社死、秘密 |
| 自嘲式 | 不瞒大家说，我 / 我这人最大的毛病 / 别笑，这事我真干过 | 自嘲、身份 |
| 悬念式 | 结果第二天 / 万万没想到 / 从此我再也没 | 生活、情感 |
| 夸张式 | 我当场就想 / 我敢打赌，在场没人 / 那一刻我觉得自己 | 脑洞、状态 |
| 坦白式 | 这事我谁都没告诉过 / 其实我一直偷偷 / 讲真，我有点 | 秘密、情感 |
| 生活式 | 上周我刚 / 每次点外卖我都 / 有天半夜我突然 | 生活、社死 |
| 互动式 | 在座的有没有 / 谁来评评理 / 你们肯定也干过 | 互动、吐槽 |
| 假设式 | 如果能重来一次 / 要是明天不用上班 / 十年后回头再看 | 幻想、假设、时光 |
| 比喻式 | 我现在的状态就像 / 用三个字形容就是 / 我和它之间只差 | 比喻、状态、拟人 |

（入池前每条过一遍 brand-copy 🔴：无机器词、无审核敏感词、无负能量钩子如「想死/自杀」谐音；源码测试锁定 ≤16 字 + 零 emoji + 禁用词表零命中。）

## 3. 确定性取样机制

- **种子解读注记**：任务书原文「按 sessionId+题号确定性取样（同桌不同人不撞车）」存在张力——仅以 sessionId+题号为种子，全桌看到相同 3 枚，两人点同一 chip 即答案撞车（公开投票环节会尴尬）。**本规格采用三元种子 `sessionId + promptId + userId`**：同 person 同题跨 remount/断线重进稳定（与 P0 E1 草稿持久化语义一致），同桌不同人高概率各见不同子集 = 不撞车；不同桌自然不同。若产品坚持「全桌共享 3 枚」（共享题目感），只需从种子中去掉 userId（一行改动）——该备选登记于此，默认不采用。
- **算法**：`hashSeed = fnv1a32(sessionId ∥ promptId ∥ userId)` → mulberry32 播种 PRNG → Fisher–Yates 洗牌 27 条池 → 取前 3。纯函数 `pickQuipInspirationChips(sessionId, promptId, userId, count = 3)` 放 shared 模块，单测锁定：确定性（同入参同出参）、子集内不重复、跨 user 相异率（100 随机 user 同题，两两全同率 < 2%）。
- **渲染时机**：仅作答相位（`!hasSubmitted && !revealed` 且 `prompts.length > 0`）渲染，每题输入框下方一行 3 枚；投票/等待/揭晓相位不渲染。

## 4. 交互与埋点

- **填入逻辑**：点 chip → 若输入框为空、或现值恰为任一 chip 原文（即上次点 chip 填的）→ 直接替换填入；若现值为手打内容 → 轻确认（「替换掉现在写的内容？」确认/取消）后替换。填入后即为普通文本，可自由编辑，计入既有 `maxlength=100` 与字数条；haptics('light')；组件复用 `components/ui/Chip.tsx`（L3 安静级）。
- **草稿协同**：chip 填入物走既有 `useIcebreakerDraft` 持久化链路（P0 E1 已上线），无需特判。
- **埋点事件名建议**（client union + 服务端 `ALLOWED_SOCIAL_ICEBREAKER_EVENT_TYPES` 白名单 parity，parity 测试随 PR 一起改）：
  - `quip_chip_shown`：每题 chips 行首渲染一次（metadata: promptId）
  - `quip_chip_tap`：点 chip（metadata: promptId, chipId, replaced: boolean）
  - `quip_chip_adopted`：提交成功且某答案以 chip 原文开头（metadata: promptId, chipId）——采用率分子
- **flag**：`quipInspirationChipsEnabled`（同规格一的 DB-backed 模式），默认 dark；OFF = 与现状逐像素一致。
- **安全链路**：chips 本身为预审策展内容不入敏感词管线；用户基于 chip 改写后的提交文本仍走既有/E9 UGC 过滤路径，不受 chips 影响。

## 5. 验收 AC 草案

1. 作答相位每题输入框下方渲染 3 枚 chips；同 user 同题跨 remount 子集完全一致（确定性锁定）；同题 100 随机 user 两两全同率 < 2%（统计测试）。
2. 空输入框点 chip → 直接填入；现值为另一 chip 原文点新 chip → 直接替换；现值为手打内容点 chip → 弹确认，取消则不动。三种路径均有 haptics('light')。
3. 池内 27 条每条 ≤16 字、零 emoji、零禁用词（源码扫描测试常跑）；九族齐全且与 quip fallback 题库 category 有映射覆盖。
4. 全流程零 LLM 请求（网络面板断言）、零 AIGC 角标渲染、chips 区零 mascot 文案/形象；与「悦仔帮我写」类入口同屏互斥的约束注释落入模块头。
5. `quip_chip_shown / tap / adopted` 三事件 client union 与 server 白名单 parity 测试通过；adopted 判定以「答案以 chip 原文开头」为准。
6. flag OFF → 作答相位与现状逐像素一致；flag ON → 投票/等待/揭晓相位仍不渲染 chips。
7. chip 填入文本计入 100 字上限与字数条，超限时按既有 slice 截断；提交后走既有草稿清理与 UGC 过滤，无回归。

---

# 实施者速读

**规格一（recap 分享，规模 M）**
- 新文件：`pages/icebreaker-session/recapSharePoster.ts`（draw+generate，~250 行，镜像 insightPoster.ts）、`pages/icebreaker-session/hooks/useRecapSharePoster.ts`（动作层，~180 行，镜像 useInsightPosterShare.ts）。
- 改文件：`phases/RecapPhaseView.tsx`（面板双 CTA + CardFlip 背面次 CTA + 隐藏 Canvas）、`index.tsx`（`useShareAppMessage` + openType='share' 按钮）、`index.scss`（@use 新 SCSS，防 sub-common.wxss 坑）、`scripts/verify-subpackage-styles.mjs`（登记选择器）。
- 服务端零改动（复用 moment-card-event save/share + features 暴露新 flag）；flag：`recapSharePosterEnabled` dark。
- 依赖：`canvasHelpers`、`fetchShareQrCodeImage`、`useAIGCLabelsEnabled`、invite 页 referral path 约定；测试范式照抄 insightPoster.test.ts / useInsightPosterShare.test.ts。
- 不做：复活 MomentCardView、通电服务端 PNG 路由、新归因基建。

**规格二（quip chips，规模 S）**
- 新文件：`packages/shared/src/copy/quipInspirationChips.ts`（27 条池 + `pickQuipInspirationChips` 纯函数，~150 行含注释）、`pages/icebreaker-session/components/QuipInspirationChips.tsx`（~100 行）。
- 改文件：`phases/QuipBattleHeroView.tsx`（作答相位挂载 + 填入/确认逻辑 + 3 埋点）、`lib/analytics/socialIcebreakerAnalytics.ts`（union +3）、`apps/server/src/routes/domains/analytics.ts`（白名单 +3）、`index.scss`（@use）、`verify-subpackage-styles.mjs`（登记）。
- flag：`quipInspirationChipsEnabled` dark；依赖：`Chip.tsx`(L3)、`useIcebreakerDraft` 既有链路、fnv1a32/mulberry32 自实现（~30 行，零新依赖）。
- 不做：LLM 生成 chips、chips 入敏感词管线、全桌共享子集（备选已登记不采用）。

---

# 退役债登记（2026-10-20 实施注记）

- `apps/mini-program/src/pages/icebreaker-session/overlays/MomentCardView.tsx` 按规格一 §1 决议**保持孤儿现状**：本次 recap 分享通路以路线 (b)（insightPoster 管线海报）落地，未复活、未挂载 MomentCardView，未新增任何消费方（其 keepsake 导出函数仍仅被 `momentCardKeepsake.test.ts` 消费）。服务端 `GET moment-card.png` 路由继续维持 flag-OFF（`SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER`），本次不通电。海报上线且分享率数据（(save+share)/generate ≥15%）验证后，另立清理项删除 MomentCardView + 服务端 `momentCardRenderer.ts`（双实现漂移源）。
