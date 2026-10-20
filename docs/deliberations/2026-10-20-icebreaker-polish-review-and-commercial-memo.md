# 破冰会话打磨复审合并 + 商业化备忘录（2026-10-20）

> 输入：主审 10 项打磨点 + PM agent 复审 + UIUX 专家复审（均带 file:line 证据）+ 商业化小天才备忘录（趋势底稿离线兜底，websearch 当日不可用，标注「底稿来源」）。
> 排除：docs/deliberations/2026-10-16-icebreaker-uiux-audit.md §7 已登记 15 项不重复。

## 一、复审中翻案/修正的关键事实（比打磨点本身更值钱）

1. **「轮到你」haptic 已建成未通电**：`useSessionSensoryEvents.ts:151` own_turn 检测 + `haptics.ts:109` socialYourTurn 波形都在，`icebreakerHapticGrammarEnabled` 服务端默认 false（`featureFlags.ts:554`）。工作不是「新建」是「调音→去双震→Android 适配→通电」四步。
2. **4 个 phase view 绕过动作层**（Undercover/GroupMirror/QuipBattle/Recap 直调 apiRequest）：无 confirm 触感、无互斥、**Undercover 与 GroupMirror 提交后连 refetch 都不调** → 最长 3s 死寂。拍卖回显问题只是切片。
3. **keepScreenOn 挂错开关**：`index.tsx:273` 挂在 moodFieldEnabled（氛围 flag）上；锁屏即轮询死亡，「人还在却像掉线」。应挂会话生命周期。
4. **reveal 长震过载**：warmup 每话题一发 400ms 全桌长震；通知类震动合计 25-35 次/小时已到上限。通电前必须先降级纯信息类 reveal。
5. **mini_script 角色卡翻牌是单向的**：`MiniScriptHeroView.tsx:804-806` 翻开后盖不回去，秘密议程明文印在背面。

## 二、10 项复审裁决

| # | 裁决 | 合并后形态 |
|---|------|-----------|
| ①卧底卡 | 修正 | 删 500ms 自动翻开 + 轻触双向 + 5s 自动回盖 + didShow 盖态重置 + word-reminder 同步（否决 hold-only：可发现性差/可达性差/违 peek 法则） |
| ②拍卖回显 | 赞同收窄 | 不做假领先；被点梯级 loading + pending pill「我的 X 币·出价中…」（V2 refetch 底子已在） |
| ③轮到你 haptic | 修正 | = 通电包（见事实 1/4），收窄到 3-4 触发点 |
| ④时长预期 | 修正 | 「约 X 分钟」× waiting 环节链 + intro overlay；不做局内倒计时；先收敛双数据源（TIER_RUN_PLANS vs CUSTOM_GAME_OPTIONS 漂移） |
| ⑤rejoin catch-up | 赞同降级 | 纯函数「现在该干嘛」chip（S），与补5 掉线全桌可见合并做 |
| ⑥quip chips | 赞同加界 | 静态策展、per-prompt 3 枚、每桌随机子集、去 mascot 化；chips=策展/悦仔=生成 永不并排（写入设计规范） |
| ⑦mini_script 遮屏 | 修正 | 角色卡补双向翻 + didShow 盖态；否决全屏遮屏（过度工程） |
| ⑧keepScreenOn | 赞同扩写 | 判定下沉纯函数 resolveKeepScreenOn（phase≠ended && visible）；释放点只有 ended/recap；release note 写耗电变化 |
| ⑨toast 规格 | 赞同 | copy 矩阵 + 重试措辞收敛「再试试」+ duration 走 token + 删 12 字截断规则 |
| ⑩撤销窗 | **否决** | 通用撤销=假撤销撒谎 or 服务端 L+ 撤回路由；替代：全押确认 sheet（S）+ quip 提交前「你投出 N 票」可改汇总步（S） |

## 三、新增打磨点（PM 8 项 + UIUX S1-S8，去重后）

- **S1 三 view 动作层归口**（M，P1）：Undercover/GroupMirror/QuipBattle/Recap 迁 performSocialAction（最小修=成功后 refetch+轻触感）→ 解锁 confirm 语法一致性 + 互斥。
- **S5 滑卡手势加固**（S）：iOS 左缘 40rpx 禁区 + |dx|>1.5|dy| 方向锁 + 宽度 mount 缓存（SwipeCard.tsx:76/95）。
- **S6a 滑卡 tap 替代**（M）：投票目标行 tap-to-select（可达性 + 缓解手势冲突）。
- **补1 host 开场提词卡**（S）：PhaseIntroOverlay host 视角多一段「你可以这样说：…」curated 1-2 句，零 LLM。冷场最高点=环节切换 30s。
- **补2 recap 主持认可位**（S）：medals grid 模式加固定「本场主持」卡；host 复玩率=供给瓶颈。
- **补3「放下手机」全桌 beat**（M）：话题/轮桌 host 点「开聊」→ 全端弱屏态（大字计时+一句话）+ 释放 keepScreenOn + 3-5min 后 beat 震回。产品定义层。
- **补4 新人一句规则**（S）：intro overlay 按首次标识追加，一次性。与补1 同 overlay 一并出。
- **补5 掉线全桌可见**（S）：等待计数旁「等阿杰（暂离）」；与 ⑤ 一体两面。
- **补6 会话健康三指标**（S）：phase_completion_rate / per_capita_actions / recap_reach 从现有事件流派生。没有它本轮全无法证伪。
- **补7 全押确认 sheet**（S，替代⑩）。
- **补8 host 一键催办**（M，P2）：gate 未过点「还差 2 人」→ server nudge 未完成者（beat 通道）。

## 四、合并优先级（场景价值 × 成本）

**P0（本周，全 S/XS，互不耦合一两个 PR 清掉）**
①卧底卡修正版（隐私真事故）｜②拍卖在途回显｜⑧keepScreenOn 挂会话｜S8 CTA 动词收敛｜补7 全押确认｜⑨toast 规格｜补6 健康三指标（证伪地基）｜补1+补4（同 overlay 一次出）｜**§7 recap 分享通路升级入 P0**（商业化 CAC 杠杆，见备忘录）

**P1**
S1 动作层归口（先于此通电）→ ③haptic 通电包四步（S7 降级→归口去双震→Android 适配→flag 灰度一桌）｜S5+S6a 滑卡加固｜⑤+补5 rejoin 两侧｜⑦角色卡双向翻｜补2 主持认可位｜补3 放下手机 beat

**P2**
⑥quip chips｜④时长预期（先收敛数据源）｜S6b quip 提交前预览｜补8 一键催办｜动画退场交叠｜presenter turn 源｜1 人局脱困

**不做**
⑩通用撤销窗｜hold-only 窥视｜全屏遮屏｜破冰内新增任何付费触点（见备忘录风险节）

---

## 五、商业化备忘录（CEO 决策版）

**1. 决策建议**
破冰环节的变现策略 = **不在破冰内收钱，让破冰替三个商业指标打工**：①复购（单场 ¥88 → 悦聚卡 ¥98/6场的价值感引擎）②CAC（recap 分享物是唯一自然传播载体）③供给（host 复玩率决定能开多少局）。本季度只投这三条，全部落在已排期的 P0/P1 工程里，不新增付费表面。

**2. 核心依据**
- 行业首次收入下滑（2025 全球约会应用 60.7 亿美元首降）+ Tinder/Bumble 集体转 IRL 线下群组局（TechCrunch 2026-08/09，底稿来源 2026-10-12 检索）——形态被 incumbent 验证，差异化在执行质量而非形态。
- AI 陪伴 7 日留存中位数 34.1% vs 社交类 58.7%——「AI 当脚手架、真人当主角」是结构性优势；「放下手机 beat」不只是体验，是留存叙事的实体化。
- AI 情感诈骗报案 +117%、搭子骗局成灾区——真人核销线下局 = 合规卖点，可直接写进支付页信任文案。
- 国内无订阅心智——悦聚卡定价（¥98/6场 vs 单场 ¥88）已是正确的「低门槛场景包」结构，破冰质量是其续费率的最大单一变量。

**3. repo 落点**
- 复购链：PRODUCT_REQUIREMENTS.md §1.5 权益方案（悦聚卡/连局包/局票，pricing_settings DB 驱动）；破冰体验 → T+1 反馈分 → 复购，度量用 wave3 漏斗 SQL + 补6 三指标。
- CAC 链：recap 分享通路（§7 P1，MomentCardView 孤儿代码复活或 canvas 海报）+ 品牌水印；邀请体系 invitations/referral_codes 已存在可挂。
- 供给链：补1/补2 host 减负+认可；远期 P2 探索「主持激励」（优先排位/券，非现金）——届时走 payment-entitlement-authority。
- 合规卖点：真人核销 + 平台支付闭环（杜绝站外转账），反诈叙事入信任文案。

**4. 衡量指标**（无现成数据，先采集，标 待验证）
- 会话健康：phase_completion_rate、recap_reach、per_capita_actions（补6，本周随 P0 上）
- 商业关联：破冰完成局 → 7/30 日复购率、悦聚卡转化（待验证基线）
- CAC：recap 分享率目标 ≥15%（参照行业分享卡基准，待验证）、分享→新注册归因（referral_codes 已可承载）
- 供给：host 复玩率、host 开局率（待验证）

**5. 风险与回滚**
- 破冰内任何付费触点 = 微信审核姿态风险 + 体验掉价 → 明确不做（红线）。
- 分享卡营销文案 = 微信禁止订阅消息营销 + 分享物料需审核姿态复核（走 brand-copy-strategy 🔴）。
- 所有体验改动均有 flag/可回滚（haptic 语法、keepScreenOn 策略、分享通路各配 kill switch）。
- 主持激励若涉现金/券 → 先过 payment-entitlement-authority 与法务，非本季度事。

**6. 优先级与交接**
P0 工程批（本文件第四节）→ taro-engineer；补6 指标 → analytics-tracking；recap 分享 → wow-elements + frontend-hook-engine；合规文案 → joyjoin-brand-guidelines；主持激励探索 → 另立 PRD（draft-prd）。

**7. 本地化雷达**
- **深圳（首发）**：南山科技从业密度最高、¥88 价格敏感度最低、现有 venue 白名单缺口已知（dining 档无餐厅）——先补 venue 再放量。
- **上海（第二）**：WTP 最高、精品咖啡馆密度适配破冰场景；悦聚季卡主推城。
- **广州（第三）**：餐饮文化契合但社交付费更谨慎，用单场局票引流。
- **北京（第四）**：审核与通勤成本最高，先做核心 3 区，不全城铺开。

---

*备忘录趋势引用均标注「底稿来源」（ai-trends-baseline-2026.md，2026-08-05 校准 + 2026-10-12 追加），当日 websearch 不可用；商业数字除行业引用外全部标 待验证，先采集后决策。*

---

## 8. 边界打磨 E-track（2026-10-20 补，用户已批准立项）

「easy & fun」杀手级边界时刻清单（代码实证，全部为既有 12 项/§7 15 项之外的新发现）。状态：**已立项，待排 sprint**。

| # | 边界场景 | 现状实证 | 修法 | 优先级/规模 |
|---|---|---|---|---|
| E1 | host 切环节时用户正在打字 → 未提交草稿全丢 | quip `answerMap` 是组件本地 state（`QuipBattleHeroView.tsx:339`），phase `key` remount/强杀重进即丢 | ①草稿持久化 sessionStorage（key=sessionId+phase+userId），remount 恢复；②host advance 有未交者时确认 sheet「还有 N 人没交，确定继续？」 | **P0 / M** |
| E2 | host 误触「进入下一阶段」全桌跳走 | 推进无二次确认；group_mirror 允许部分提交但服务端 advance 无「N 人未提交」确认（已 grep 证实） | 并入 E1②（仅在有未完成者时弹，免打扰） | **P0 / S（并入 E1）** |
| E3 | ready 急躁双击 = 静默取消（toggle） | 在途有 pendingAction 互斥，成功后快速二点会取消且无感知 | 取消后 toast 明示「已取消准备」+ 400ms 二点忽略 | P2 / XS |
| E4 | 键盘弹起遮住吸底 dock（quip/卧底描述/侦探写稿聚焦时） | WeChat adjustPosition + RootPortal dock 的相互作用未验证，疑似提交钮被顶飞 | focus 时 dock 隐藏或降级为输入框内联提交；**真机验证先行** | **P0 / S** |
| E5 | 拍卖被超价后用户已息屏 | 被超 toast 3s 即逝 | 被超价列为「行动改变时刻」trigger，并入「轮到你」haptic 通电包（P1 既有项） | 并入通电包 |
| E6 | quip 平票时冠军展示规则未验证 | 并列 or 先达者未定 | 验证 + 并列双冠军文案（笑点时刻） | P2 / XS |
| E9 | 会话内 UGC 冒犯内容（quip/卧底/侦探自由文本） | AIGC 有角标+举报，UGC 无过滤无举报路径 | 提交过敏感词（复用 content-safety 管线）+ 长按举报 | P1 / M |
| E10 | 昵称含 emoji/超长进点名胶囊 | AI 文案有 stripEmojis，UGC 昵称无 | 胶囊截断折叠 + 昵称 strip emoji | P2 / XS |

**已验证无需修的边界**（防重复立项）：拍卖余额不足 disabled+文案（`AuctionHeroView.tsx:685-725`）、全员 0 出价流拍跳过、全员认怂标签、全零桌「静静发光」地板线、微信电话挂起恢复、低电量 degradation tier、系统大字体（rpx 天然稳定）。

**落地建议**：E1+E2+E4 一个 PR（同一「输入保护」主题）；E9 随 UGC 安全单独走（content-safety-abuse-detection 技能）；XS 项捎带。
