# JoyJoin City GO — Phase 0 PRD

**Status:** Draft (backlog-ready)  
**Scope:** WeChat Mini Program (Taro) + Server  
**Timeline:** 3 months, small team (1 frontend + 1 backend + 1 game/UX designer + 0.5 PM)  
**Target Market:** Shenzhen, single district (海岸城 / 深圳湾公园周边)  
**Feature Flag:** `cityGoEnabled` (DB-backed, env `CITY_GO_ENABLED`, default `false`)

---

## 1. Problem Statement

JoyJoin 的免费入口「闪现」已经能说服用户低门槛出门，但“出门动机”仍依赖活动列表，缺乏一个**日常、游戏化、低心理成本的钩子**。

- Game-first 用户需要更即时的反馈和探索感，而不是每次都预约一场正式局。
- 平台需要提升 DAU 和次日/7 日留存，并把免费用户的活跃度转化为后续「闪现」或 Blind Box 的参与。

JoyJoin City GO 用**伪开放像素地图 + 地标副本 + 虚拟 NPC** 提供一个独立的 Freemium 游戏面，让用户在现实城市里“走到哪、玩到哪”。

---

## 2. Target Users and Scenario

### Primary: Game-first 城市青年
- 20–35 岁，已做人格测试，对 Mascot 和 12 原型有认同。
- 喜欢轻游戏、探索、收集，不排斥出门，但讨厌重预约和社交压力。
- 使用场景：午休、下班、周末无聊时打开地图，看到附近地标有“怪”刷新，走过去做 5 分钟任务。

### Secondary: Relationship-first 潜力用户
- 被游戏化任务吸引出门，在“限时副本”中遇到结构化匹配的队友。
- 通过系统安排的共同任务降低初次社交压力。

### 当前 workaround
- 刷小红书 / 抖音找附近活动。
- 在 JoyJoin Discover 刷活动列表，但看到的多是未来预约局，不够即时。
- 玩 Pokemon GO 等 LBS 游戏，但这些游戏没有真实社交关系沉淀。

---

## 3. Goals and Non-Goals

### Goals
1. **DAU / habit：** Phase 0 内测用户中，每周人均打开 City GO ≥ 2 次。
2. **非付费用户破冰：** City GO 用户中 ≥ 20% 在 7 天内报名参加至少一次「新手限时副本」；其中 ≥ 60% 的副本参与者为此前未参加过付费线下活动（Blind Box / 付费 闪现）的用户。
3. **付费转化：** 参加过限时副本的用户中，≥ 15% 在 30 天内报名首次付费 Blind Box / 付费 闪现。
4. **留存信号：** 使用过 City GO 的用户的 7 日留存比未使用对照组高 ≥ 10 p.p.。
5. **完成 MVP：** 3 个月内上线 1 个街区、3 个地标、3 种任务类型、1 个虚拟 NPC、能量系统、基础数据分析。

### Non-Goals
- 不做全城开放地图（Phase 0 只覆盖一个高密度街区）。
- 不做持续后台定位（仅前台定位 + 到场手动签到）。
- 不做纯随机路人匹配（队友只通过“限时副本”活动报名匹配）。
- 不做开放聊天、UGC 任务或玩家自建内容。
- 不做付费抽卡 / 数值碾压（Phase 0 不上付费，只预埋能量和通行证入口）。
- 不替代 Blind Box 的核心付费体验。
- 不做「我的伙伴」养成/数值系统（潮流值、等级、套装加成等）——只保留视觉展示，并合并进「我的故事」。

---

## 4. User Stories / Primary Flows

### 4.1 日常探索：打开地图 → 走到地标 → 打怪
1. 用户在 Discover 看到「城市冒险」入口（或 Tab 中心按钮新增入口）。
2. 进入 City GO，看到像素化街区地图，自己的 Mascot 在地图上移动。
3. 地图显示附近地标和当前刷新的「怪」/「事件」。
4. 用户走到地标范围内（前台定位或手动扫码），点击「进入副本」。
5. 进入回合制战斗：选择原型技能（如柯基·破冰、猫头鹰·深度提问）击败「社交困境怪」。
6. 战斗胜利后获得：地点纪念、原型经验、能量/道具。
7. 返回地图，故事页自动记录一次「城市冒险」经历。

### 4.2 新手限时副本：让未付费用户先尝一次轻线下社交
> **目标人群：** 已完成人格测试、对 JoyJoin 感兴趣，但尚未报名任何付费线下活动（Blind Box / 付费 闪现）的用户。

1. 用户在地图上看到今晚 20:00 海岸城刷新「新手夜行副本」——明确标注“免费、30 分钟、2–4 人”。
2. 点击「报名」→ 复用现有活动池注册流程，但**无需付费**。
3. 系统优先匹配同样未参加过付费活动的用户。
4. 活动前 Center 接管，显示集合地点范围、队友 Mascot 剪影、任务预告。
5. 到场扫码签到，系统自动组队。
6. 队友一起完成一个轻任务（如：互相投票决定下一站、用话题卡完成 3 轮对话、拍一张集体选择照）。
7. 完成后可选择是否与队友保持连接；互选后进入「连接」系统。
8. 副本结束后弹出“首次完整体验邀请”：展示下一场匹配的 Blind Box（¥68 首单价）或 ¥88 标准局，并赠送一张仅限首次付费可用的限时 coupon。
9. 该经历进入「我的故事」，掉落稀有装备/纪念。

### 4.3 虚拟 NPC：获取传闻和支线
1. 用户在某个地标反复完成任务后，触发常驻 NPC。
2. NPC 根据用户原型和历史经历给出个性化对话：
   - “作为太阳鸡的你，最近是不是有点缺少话题？”
   - “今晚有个类似的副本，可能会遇到猫头鹰类型的人。”
3. NPC 提供一次性支线任务（如“连续三天路过这里”），完成后解锁称号或皮肤。

### 4.4 我的伙伴：视觉包装，合并进我的故事
1. 用户在「我的故事」页看到自己的 Mascot / 像素化身，穿着代表最近经历的视觉装备。
2. 每件装备来自一次真实经历：一次限时副本、一次地标战斗、一次 Blind Box。
3. 没有数值、等级或加成；装备只是记忆的视觉化。
4. 在 City GO 地图或副本中，该化身作为用户头像/标识出现。
5. 用户可切换展示装备，但无法通过充值或刷怪获得属性优势。

---

## 5. Acceptance Criteria

- [ ] Given 用户在前台打开 City GO，When 地图加载完成，Then 3 秒内渲染出当前街区像素地图和地标节点。
- [ ] Given 用户距离地标 ≤ 100 米，When 打开该地标副本，Then 允许进入；> 100 米时提示“再走近一点”。
- [ ] Given 用户无剩余能量，When 尝试进入战斗，Then 显示“今日能量已用完”和明日恢复时间。
- [ ] Given 用户完成一场战斗，When 结算，Then 地点纪念 + 经验写入用户资产，且故事页可见。
- [ ] Given 用户报名限时副本，When 到场签到，Then 走现有 event-pool 签到和匹配流程，不新增独立状态机。
- [ ] Given 用户触发 NPC 对话，When 对话失败或无 AI 返回，Then 使用预设兜底文案，不影响主流程。
- [ ] Given 功能开关 `cityGoEnabled=false`，When 用户进入 Discover，Then 不显示 City GO 入口。
- [ ] Given 用户关闭小程序，When 再次打开，Then 不请求后台定位，只在前台进入地图时刷新位置。

---

## 6. Constraints, Risks, Dependencies, and Open Questions

| Type | Item | Mitigation or Owner |
|---|---|---|
| **Constraint** | 小程序包大小限制（2 MB） | 像素美术优先走 CDN，核心 Mascot sprite 复用本地；上线前跑 `check:package-size` |
| **Constraint** | 只能使用前台定位 | 怪物/副本只在用户主动打开地图时刷新；用“建议到达窗口”替代实时追踪 |
| **Constraint** | 只通过平台组织的线下兴趣局进行小组匹配 | 队友必须报名限时副本并通过到场签到，聊天限制为预设动作 |
| **Risk** | 用户位置作弊（模拟器/飞定位） | 能量奖励和副本签到结合 WiFi/蓝牙/扫码验证；异常模式识别后降权 |
| **Risk** | 免费层太好玩，侵蚀正式付费转化 | 稀有奖励和深度关系推进只保留给真实活动；City GO 每日能量设上限 |
| **Risk** | 内容消耗快，用户很快无聊 | 任务库按地点、时间、原型组合变化；NPC 支线每周轮换 |
| **Dependency** | 用户已有人格测试结果和 Mascot | 复用 `packages/shared/src/personality/` 和 `archetypeAssets` |
| **Dependency** | 需要真实场地合作/授权 | 首轮只选 3 个已合作或公开场地，避免商务谈判拖期 |
| **Dependency** | AI NPC 对话 | 复用现有 `socialModelRouter` + AITrace，按 `llm-runtime-safety-and-integration` 规范 |
| **Open Question** | 用户是否愿意为一个街区打开地图？ | Phase 0 加 A/B holdout，明确对照组 |
| **Open Question** | 是否要在 3 个月内就上付费？ | 建议 Phase 0 只测试能量耗尽后的自然转化，付费留到 Phase 1 |

---

## 7. Scope Boundaries

### In Scope (Phase 0 — 3 months)
- 1 个街区的高密度像素地图（海岸城 / 深圳湾公园周边）。
- 3 个认证地标 + 3 种地标任务模板。
- 伪开放地图：节点图 + 前台定位，非全城自由移动。
- 单人回合制战斗（3 种「社交困境怪」）。
- 1 个常驻虚拟 NPC，提供传闻和 2–3 条支线。
- 能量系统：每日 2 点免费能量，预留付费扩展点。
- 1 种面向未付费用户的「新手限时副本」活动类型（免费，复用现有 event-pool 注册/签到）。
- 基础奖励：地点纪念、经验、原型称号。
- 我的伙伴视觉展示：在「我的故事」和 City GO 界面中展示 Mascot / 像素化身，装备来自真实经历，无数值养成。
- 全程埋点 + Feature flag `cityGoEnabled`。

### Out of Scope (v2+)
- 全城覆盖和真实世界连续大地图。
- 后台定位和 push 通知驱动的实时遭遇。
- 纯随机的路人实时组队。
- 开放文字聊天、UGC 任务、玩家交易。
- 付费抽卡 / 装备数值交易系统。
- AI NPC 自由对话和情感陪伴。
- 跨平台 Web 版本（小程序优先）。

---

## 8. Success Metrics

| Metric | Unit | Target | Window | Notes |
|---|---|---|---|---|
| City GO 入口点击率 | % | ≥ 15% | 1 week post-launch | `city_go_entry_tap / discover_dau` |
| 每周人均打开次数 | 次 | ≥ 2 | week 2–4 | 仅统计进入地图且停留 >5s 的会话 |
| 地标战斗完成率 | % | ≥ 60% | 1 week | `battles_completed / battles_started` |
| 限时副本报名率 | % | ≥ 20% | 2 weeks | `副本报名 / 看过副本卡片` |
| 副本参与者中未付费用户占比 | % | ≥ 60% | 2 weeks | 用于确认目标人群命中 |
| 限时副本 → 首次付费转化 | % | ≥ 15% | 4 weeks | 副本参与后 30 天内报名首次付费活动 |
| City GO 用户 7 日留存 | % | 比非用户高 ≥ 10 p.p. | 2 weeks | 同 cohort holdout 对比 |
| 闪现 / Blind Box 转化率 | % | ≥ 10% | 2 weeks | `City GO 活跃用户中报名正式活动 / 总活跃用户` |
| 能量耗尽后回流率 | % | ≥ 30% | 2 weeks | 能量耗尽后次日再次打开 City GO 的比例 |
| 位置作弊/异常率 | % | ≤ 2% | 1 week | 用于判断反作弊策略是否足够 |

---

## 9. Engineering Impact Areas (Hypotheses)

### Server
- **New route** `GET /api/city-go/landmarks` — 返回认证地标列表 + 当前刷新状态。
- **New route** `GET /api/city-go/spawns` — 基于用户当前位置返回可遭遇的怪/事件。
- **New route** `POST /api/city-go/battle/complete` — 记录战斗结果、发放奖励、写故事记录。
- **New route** `GET /api/city-go/npc/:npcId/dialogue` — 返回 NPC 对话，复用 `socialModelRouter`。
- **New schema** `city_go_landmarks`, `city_go_spawns`, `city_go_battles`, `city_go_user_energy`, `city_go_npc_states`.
- **Integration** 复用现有 `event_pools` + `pool_registrations` + `pool_checkins` 实现限时副本，新增 `eventType: 'city_go_raid'`。
- **Integration** 奖励写入用户资产系统，故事记录复用 `my_story` / `user_achievements`。
- **Visual packaging** `my_story` / profile page optionally displays Mascot with event-derived cosmetics; no progression schema needed.

### Mini Program
- **New page** `pages/city-go/map/index` — 像素地图主界面。
- **New page** `pages/city-go/battle/index` — 回合制战斗界面。
- **New component** `CityGoMap` — 基于 Taro Canvas 或轻量 WebView 的伪开放地图渲染。
- **New component** `NpcDialogueSheet` — 虚拟 NPC 对话面板。
- **Asset pipeline** — 像素地标、怪物、NPC sprite 优先 CDN，本地只保留核心 Mascot fallback。
- **Analytics** — `city_go_map_enter`, `city_go_landmark_tap`, `city_go_battle_start`, `city_go_battle_complete`, `city_go_raid_register`, `city_go_npc_dialogue_view`, `city_go_energy_depleted`。

### AI / Content
- **NPC 对话生成** — 固定人设 + 用户上下文注入，通过现有 LLM 路由，要求 AITrace 和 fallback。
- **任务生成** — 运营配置模板，不开放用户生成。模板变量包括：地点、时间、原型、天气、城市事件。

---

## 10. Rollout Questions

- [ ] **Feature flag:** `cityGoEnabled` 是否默认只对内部 + 5% 用户开放？
- [ ] **Dark launch:** 是否先在团队内部和种子用户中跑 1 周，确认位置精度和任务完成率？
- [ ] **Rollback:** 如果 7 日留存或转化未达目标，是否直接关闭入口并保留地图数据？
- [ ] **城市选择：** 是否锁定深圳海岸城作为唯一试点，直到指标达标？
- [ ] **合规预审：** 是否先和产品/法务确认前台定位、平台组织的小兴趣局文案和审核口径？

---

## 11. Open Questions for Next Step

1. **是否把“新手限时副本”作为 Phase 0 核心目标，并压缩单人 PvE 内容？** 你刚才明确目标是“没参加过付费线下活动的用户”，这意味着副本匹配和转化链路必须在 3 个月内跑通。
2. **City GO 入口放在哪里？** Discover 顶部 Banner、Center 中心按钮、还是新增底部 Tab？
3. **付费测试节奏：** 3 个月内是否只观察能量耗尽后的自然回流，还是直接上一个 ¥12/月的「City Pass」A/B？

---

*Next artifact: 若通过此 PRD，应产出 Sprint Contract（Tier 2）和 交互原型 / 像素地图美术 brief。*
