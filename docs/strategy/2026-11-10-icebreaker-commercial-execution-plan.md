# Social Icebreaker 商业化 × 产品执行计划

> 2026-11-10 · v1.1 · Draft for decision
> 依据：T46 文章复盘（含用户一手补充）、1,000 人模拟面板、PM Agent / 商业化 Agent delta memo
> 范围：30 / 60 / 90 天；不新增 phase、不做独立 SKU、不做 30 天内 premium 发布
> v1.1 硬化：G2 冻结 run plan、实验卫生、24h 时间锚点、隐私/保留/删除、通知审核、边界条件、premium 成本阈值、ops staffing、验收测试

---

## 0. 决策摘要

| 问题 | 决策 |
|---|---|
| 是否做破冰独立 SKU？ | **不做。** 破冰是活动体验的一部分，向活动票收费，不向软件收费。 |
| 是否涨挂牌价？ | **不涨。** 单场 ¥88 / 三连 ¥211 / 六连 ¥370 / 月卡 ¥98 保持不变。 |
| 是否加新 phase？ | **不加。** 先修安全、主持、互选、节奏，再谈内容扩张。 |
| 30 天最大赌注 | **证明“专业主持”相对“首到者轻主持”的增量价值**；同时上线 24h 互选闭环。 |
| 是否发布 premium 主理人桌？ | **30 天内不发布。** 先同城同价 ¥88 做 A/B；主持价值被证明后，才考虑深圳 ¥138。 |
| 商业上最该先修的 | **全包价感知**：JoyJoin 酒水局约 ¥168–238，T46 ¥88–118 含一杯。先谈 venue 含杯，不先涨价。 |
| 产品上最该先修的 | **关系闭环**：0–5 人选择 → 24h 待揭晓 → 互相选择才解锁微信 → 下一桌。 |

**一句话：**
> 不为主持人提价，先用同城同价 ¥88 证伪“人必须坐在桌边”；同时把“散场后 24 小时”做成产品，而不是把海报做成产品。

### 0.1 v1.1 变更（相对 v1.0）

| 变更 | 原因 |
|---|---|
| **G2 期间冻结 run plan**；W4 的 BREEZE/BLAZE v2 移到 G2 之后，或作为独立第三臂 | 否则“主持模式”和“format 变化”混在一起，无法归因 |
| G2 只在**深圳**，同 venue 档 / 同 weekday-time band / 同 ¥88；按桌随机，预注册 eligible tables，至少 8 桌/arm | 控制城市、场地、时段、价格和桌级聚类，避免把噪音当胜负 |
| 24h 时间锚点定死：`opensAt = eventStart + 3h`；`revealAt = eventStart + 24h` 后的下一个 21:00（Asia/Shanghai）；`closesAt = revealAt`；UTC 存储 | 消除 `dateTime + 27h` 的模糊 fallback 和客户端时钟风险 |
| 补选择数据的隐私、保留、账号删除规则；analytics 只存 count，不存 target ID | pending selection 是敏感社交意图，不能当普通埋点 |
| 补通知审核、边界条件、premium 成本阈值、pilot staffing、验收测试 | 让计划从“方向正确”变成“可执行、可回滚、可验收” |

---

## 1. 证据与前提

### 1.1 已经知道的

| 证据 | 结论 | 可信度 |
|---|---|---|
| 1,000 人模拟面板 | IEI 73.5/100；CSAT 3.5/5；NPS +10.6；one-sided connection 38.8%；awkward 36.3% | **校准模型，不是实测** |
| 真实 session 数 | 本地 / staging / production 均为 0 | 已核实 |
| 桌级方差 ICC | 34.2%；36% 的桌 <70，9% <60 | 模型参数，需真实实验验证 |
| 最低分维度 | 主持负担 66.6（主持人自评 58.8）；pacing 70.0 | 模型结果 |
| 最高分环节 | speed_friending 4.06（n 小）、group_mirror 4.03、warmup 3.99 | 模型结果 |
| 最低分环节 | auction 3.20、undercover 3.35、lie_detective 3.59 | 模型结果 |
| 内向者 | reserved 22%，IEI 71.5，NPS −6，awkward 53%；mirror 4.18 | 模型结果；战略上最重要的人群 |
| T46 | 6 人/桌、无专职主持、首到者义务轻主持、纸卡牌、24h 互选、12 城、¥88/118 含一杯 | 官方/媒体 + 用户一手补充 |
| T46 平台自述 | 40k+ 付费、复购 >50%、≥90% 桌子有互选、14 城 | **未审计，不可当基线** |

### 1.2 T46 的正确读法（已按一手信息修正）

T46 不是“零主持”，而是：

> **无专职主持 + 第一个到场的人按惯例义务做轻主持。**

它删掉的是：

- 专职主持 / 认证主持
- 主持费
- “只有主持能推进”的权限门

它没有删掉 facilitation：卡牌负责节奏，首到者负责开场和收尾，任何人都能翻牌。

**因此实验问题不是“人是否必须”，而是：**
> **专业主持相对于“首到者轻主持”，是否创造可测量的增量？**

### 1.3 数据诚实边界

- 所有体验分数来自 1,000 人模拟，**不是真实用户测量**。
- PRD 里的 MRR ¥45,680 / LTV ¥586 / NPS +42 / atmosphere 4.2 是 mock dashboard，**永远不能当基线**。
- T46 没有公开 CSAT / NPS / awkward 数据；40k 付费只证明“需求 + 单位运营”成立，不证明体验质量。
- 所有 30 天目标都是**实验假设**，不是承诺。

### 1.4 战略含义

1. **先修尾部，不修均值。** 36% 的桌 <70；一场糟糕的桌会覆盖品牌记忆。先让 60→70、70→75。
2. **好玩和连接是两个产品。** fun 75.2，one-sided connection 38.8；脚本化 phase 买到乐趣，但挤掉了 1v1 的空气。
3. **内向者是可服务市场。** reserved + slow = 50% 的可移动人群；他们也是 T46 在上游匹配时保护的人。
4. **主持是供应链，不是 UI。** 32.4% 愿意再主持；第一次主持 −2.7 IEI；主持电话可冻结整桌。
5. **关系资产不是海报，是 24h 后的待揭晓。** 海报是“发完就走”，互选是“明天再打开”。

---

## 2. 核心战略

### 2.1 两个产品，不要混在一起

| 产品 | 用户问题 | 当前表现 | 30 天动作 |
|---|---|---|---|
| Fun product | “今晚好不好玩？” | fun 75.2；warmup / mirror / dice 强 | 保留，砍掉最弱环节，缩短 blaze |
| Relationship product | “我有没有认识一个人？” | one-sided 38.8%；mutual 未测 | 新增 24h 互选 + 揭晓 + 下一桌 |

**判断：** 如果只优化 fun，会得到“玩得开心但没认识人”的一次性产品；如果只做关系，会失去活动的娱乐性。30 天先补关系闭环，不牺牲 fun 的前半段。

### 2.2 主持命题

| 模式 | 定义 | 适用 | 风险 |
|---|---|---|---|
| A. 专业主持 | 现有 host + phase engine；有培训/认证/费用 | 当前默认；高客单/企业局 | 成本高；主持是单点故障；第一次主持体验差 |
| B. 首到者轻主持 | 第一个到场者自动成为 host；一张“轻主持卡”；3 个动作：开场、翻牌、收尾 | 30 天 pilot；日常 6 人桌 | 轻主持可能不出现；卡住时需要接力 |

**B 不是 hostless，也不是自动推进。** B 保留 `hostUserId` 和现有 phase engine，只把“专业主持”换成“首到者轻主持”，并增加玩家接力。

### 2.3 关系闭环

```
活动结束 / 反馈开放
  → 选择 0–5 位想继续了解的人
  → 提交后进入「待揭晓」（不显示谁选了你）
  → 24h 后统一揭晓
  → 双方都选 → 解锁微信号 → Connections
  → 下一桌 / 第二次见面
```

**关键原则：**

- 不显示“谁选了你”，不显示被选次数，不做拒绝通知。
- 没有互选 ≠ 失败；文案不制造羞耻。
- 24h 是“明天再打开”的理由，不是拖延。
- 微信号只在互相选择后出现；不在选择阶段暗示“已匹配”。

### 2.4 商业命题

**不向软件收费，向“一桌人的一晚”收费。**

- 标准局：6 × ¥88 = ¥528；贡献约 ¥516（不含场地溢价/主持）。
- T46：¥88/118 含一杯；JoyJoin 酒水局全包约 ¥168–238。**差距在全包价，不在挂牌价。**
- 先谈 venue “含一杯”合作，保持 ¥88；不要用涨价解决感知问题。
- premium 主理人桌只有在“专业主持显著提升互选/复购”后才成立；¥138 是差异化，不是毛利动作（收入 +57%，贡献约 +11%）。

---

## 3. 产品集成地图

### 3.1 复用现有表面，不造新 tab

| 需求 | 现有落点 | 改动 |
|---|---|---|
| 0–5 人选择 | `apps/mini-program/src/pages/event-feedback/steps/ConnectionsStep.tsx` | 加 `maxSelections=5`、`revealAt`、新文案；复用 2 列网格/头像/选中环 |
| 反馈提交 | `apps/mini-program/src/pages/event-feedback/index.tsx` → `POST /api/events/:eventId/feedback` | 服务端加 0–5 校验、窗口校验、`mutual_pending` |
| 待揭晓 | `apps/mini-program/src/pages/connections/index.tsx` + `/api/shell/connections` | 顶部 quiet card：只显示数量 + 倒计时，不显示身份 |
| 揭晓 | Connections tab | 揭晓后显示 mutual cards；复用现有 `Card` / 微信号复制 |
| 主持 | `apps/mini-program/src/pages/icebreaker-session/` | 首到者轻主持卡 + 接力入口；不新建页面 |
| 复盘 | `event-feedback` keepsake + icebreaker recap | 变成“去待揭晓”的 prompt，不抢关系闭环 |

### 3.2 数据模型

**`connections` 增加：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | varchar | `pending | mutual_pending | mutual`；新增 `mutual_pending` = 双方已选、等待揭晓 |
| `revealAt` | timestamptz null | 该桌统一揭晓时间；`mutual_pending` 时必有 |
| `revealedAt` | timestamptz null | 实际揭晓时间；现有字段复用 |

**新增 `connection_selection_windows`：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | varchar PK | |
| `eventId` | varchar unique FK `events.id` | 一桌/一场一个窗口 |
| `opensAt` | timestamptz | 反馈开放时间（event start + 3h，可运营覆盖） |
| `closesAt` | timestamptz | 选择截止 = `revealAt` |
| `revealAt` | timestamptz | 统一揭晓时间 |
| `createdAt` | timestamptz | |

**时间锚点（v1.1 已定）：**

- `opensAt = eventStart + 3h`，与反馈开放一致；运营可覆盖。
- `revealAt = eventStart + 24h` 之后的**下一个 21:00（Asia/Shanghai）**；`closesAt = revealAt`。
- 统一存 UTC；服务端返回 ISO 时间；客户端只渲染 +8，不自行计算窗口。
- 缺少 `eventStart` 时仅允许运营后台覆盖，不给客户端 fallback。

**实施备注（G0 后端切片落地，2026-11-10 — 与上文的偏差需知会）：**

- `connection_selection_windows` 只作为**运营覆盖层**：无行时按上述锚点实时推导，服务端不懒写。避免两个并发读者抢插入，也保证「未配置即默认」。
- 锚点边界取「**不早于** eventStart+24h 的下一个 21:00」：若 +24h 恰好落在 21:00，就取该时刻，不再顺延一天（否则该类场次晚一天揭晓）。推导范围恒为 `[start+24h, start+48h)`。
- 揭晓扫描是**单条集合 UPDATE**（`status='mutual_pending' AND revealed_at IS NULL AND reveal_at <= now()`），代替 §4.3 写的 `FOR UPDATE SKIP LOCKED` 逐行处理：同一谓词天然幂等，重复/并发扫描只会空跑，且一次往返完成双微信号快照。scheduler 每 60s 跑一次，flag 关闭时空转。
- 窗口关闭后 `POST /feedback` 只在**携带选择**时返回 `409 SELECTION_WINDOW_CLOSED`；0 选择的评价照常提交（否则过期用户会被迫无法评价）。0–5 上限不受 flag 控制（W1 硬化项，6 人桌只有 5 位同桌）。
- 揭晓时刻暂**不发** `mutual_match` 站内/订阅通知（原即时互选路径才有）——需要先定推送策略，属客户端联动跟进项。

**保留与账号删除：**

- 揭晓后只保留 mutual connections；未互选的 pending 在窗口结束后 30 天内软删除/匿名化。
- analytics 只保留 `count` / `window_state`，不记录被选 target ID。
- 账号删除按 `docs/runbooks/account-deletion.md` 处理：`connections`、`revealedAt`、WeChat 快照、pending selection audit 一并清理；财务保留例外不变。

### 3.3 API 契约

| 端点 | 变化 |
|---|---|
| `GET /api/events/:eventId/feedback-state` | 返回 `connectionSelection: { state: 'open'|'closed'|'revealed', revealAt, maxSelections, selectedCount }` |
| `POST /api/events/:eventId/feedback` | `connections` 最多 5；窗口关闭返回 `409 SELECTION_WINDOW_CLOSED`；返回 `connectionSelection`；`mutualMatches` 只在已揭晓时返回 |
| `PUT /api/events/:eventId/connection-selection` | 窗口内全量替换 0–5；可编辑/清空；幂等；关闭返回 `409 SELECTION_WINDOW_CLOSED`；不触发反馈 XP |
| `GET /api/shell/connections` | 新增 `pendingReveal: { count, revealAt } | null`；**不返回身份** |
| `GET /api/events/:eventId/participants` | 保持不变；选择页只用同桌/活动参与者 |
| `POST /api/social-icebreaker/:id/claim-host` | 新增：首到者轻主持模式下，host 静默 ≥180s 后，玩家可 CAS 接力；审计、拒绝 bot |
| `POST /api/admin/social-icebreaker/:sessionId/transfer-host` | 保留；运营兜底 |

**契约细节（v1.1）：**

- 第 6 个选择返回 `400 TOO_MANY_SELECTIONS`；服务端校验永远优先于客户端 chip。
- 反馈提交里的 `connections` 作为首次写入；后续编辑走 `PUT /connection-selection`，两者共用同一套 0–5/窗口校验。
- 任何读取路径在揭晓前都不得返回 peer 身份：`feedback-state`、`/api/shell/connections`、`/api/my-connections`、错误信息、日志都不行。
- `pendingReveal` 只返回 `count` 和 `revealAt`；不返回姓名、头像、桌号。
- 幂等键：同一用户+同一 event 的重复提交只保留最后一次；重复点击不产生新行。

### 3.4 状态机

**互选（v1.1）：**

```
open --submit 0..5--> submitted
submitted --edit/clear until closesAt--> submitted
submitted --closesAt--> revealing
revealing --scheduler--> revealed
closed/cancelled --submit--> 409 SELECTION_WINDOW_CLOSED
event cancelled --> cancelled（立即关闭，void 所有 pending reveal）
```

**连接（v1.1）：**

```
pending (one side)
  --second side selects--> mutual_pending (revealAt = window.revealAt)
  --scheduler at revealAt--> mutual (snapshot WeChat, notified)
  --no second side at revealAt--> expired（软删除/匿名化，永不通知“有人选你”）
  --event cancelled--> void（不揭晓、不通知）
```

**主持（v1.1）：**

```
A: professional host (existing)
B: first arrival -> light host -> advance / handoff
   host silent >= 180s -> player claim (CAS + audit) -> new host
   claim target is bot / already host / stale phase -> 400/409 + toast，不静默失败
```

**边界补充：**

- 用户在 `closesAt` 前可编辑/清空，只有最终状态参与揭晓；重复 PUT 幂等。
- 活动取消立即关闭窗口，所有未揭晓的 `mutual_pending` 置 void，不发送任何“有人选你”的暗示。
- 未互选 pending 在窗口结束后进入 expired，30 天内软删除/匿名化。
- 主持接力失败必须给明确 toast；不做静默夺权。

### 3.5 Feature flags

| flag | 默认 | 用途 | 回滚 |
|---|---|---|---|
| `mutualSelectionV2Enabled` | off | 24h 待揭晓、0–5 上限、`mutual_pending` | 关闭后回到即时 mutual 旧行为 |
| `icebreakerLightHostEnabled` | off | 首到者轻主持卡 + 玩家接力 | 关闭后回到专业主持 |
| `hostedTablePilotEnabled` | off | A/B 分组与运营 allowlist | 关闭即停止实验 |

> 所有 flag 走 `apps/server/src/lib/featureFlags.ts`；生产回滚：`UPDATE feature_flags SET value='false' WHERE key='<flag>'`。5s LRU 生效。

---

## 4. 工作流

### 4.1 W1 — 信任与安全硬化（第 1 周，不可后置）

| 动作 | 文件 | 验收 |
|---|---|---|
| 谎言侦探：投票匿名，揭晓前不下发 `voterId` / `guess` | `socialIcebreakerStore` sanitize + lie phase state | 客户端 payload 无 voter→guess；测试锁定 |
| 群像镜像：去掉 voter→target attribution，只保留聚合 | `sanitizeStateForClient` | `groupMirrorAnswers` 不再携带 voter |
| 谁是卧底：不公开点名被投出者，软化揭晓文案 | lie/undercover phase view + recap | 无“被抓/出局”羞辱词；测试 |
| 机智对决：投票阶段隐藏作者 | quip phase state | displayName 不在 pre-reveal payload |
| 暖场 fallback：第一张卡必须轻，深水卡后置 | warmup deck | fallback 顺序测试 |
| 反馈提交：服务端 0–5 上限 | `routes/domains/social.ts` | 6 人桌最多 5；超限 400 |
| 待揭晓隐私：`mutual_pending` 不暴露身份 | `connectionsRepo` | 任何 shell/API 都不返回 pending 身份 |

**为什么第 1 周：** T46 的监管灰区说明“实名 + 互选 + 线下”会被放大审视。我们的 attribution bug 不是小问题，是商业 liability。

### 4.2 W2 — 主持模型实验（第 1–4 周）

**A 组（专业主持）：** 现有 host + phase engine；主持拿到现有工具条。

**B 组（首到者轻主持）：**

- 第一个到场者自动成为 host（复用 first-caller promotion）。
- 一次性 `LightHostBrief`：
  - “你最早到，这一桌先交给你 3 分钟。”
  - “只需要做三件事：开场、翻牌、收尾。”
  - 主 CTA：「开始这一桌」
- 主持条只有 3 个动作：开始 / 下一张 / 收尾；不展示复杂规则。
- 玩家在 ⋯ 看到「接力主持」：host 静默 ≥180s 后可 CAS 接手；审计 `SOCIAL_ICEBREAKER_HOST_CLAIMED`；bot 拒绝。
- 不自动转移；不静默夺权；不做主持评分。

**B 组观测指标（v1.1）：**

| 指标 | 观测方式 | 通过线（排练） |
|---|---|---|
| 首到者是否自然拿起卡牌 | 现场观察 + 录像回看 | ≤2 分钟内发生 |
| `LightHostBrief` 是否被打开 | 客户端事件 | ≥5/6 桌 |
| 自然开场是否发生 | 是否有人主动说第一句 | ≥5/6 桌 |
| 专业主持救场次数 | Ops 记录 | **0** |
| 接力次数 / 抢权失败 | 服务端审计 | ≤1 次/桌，失败必须有 toast |
| 单桌 ops 分钟 | Ops 计时 | ≤20 分钟 |

**通过门槛（3 桌排练）：**

- 3/3 桌跑完
- ≤1 张卡被跳过
- 无 >90s 冷场
- 单桌人工 ops ≤20 分钟
- 轻主持不需要被授权也能自然出现
- ≥4/6 愿意再来

### 4.3 W3 — 24h 互选闭环（第 2–4 周）

**用户流程：**

1. 反馈页第 2 步「想继续了解谁？」：0–5 人，2 列网格；已选数量 chip。
2. 文案改为：“最多选 5 位。双方都选，明晚 21:00 一起揭晓。”
3. 提交后：不再显示“匹配成功”；显示“选择已收好” + “明晚 21:00 回来看看”。
4. Connections tab 顶部 quiet card：
   - “明晚 21:00 揭晓”
   - “你选了 3 位”
   - 点击打开 bottom sheet 解释规则；不显示任何人的名字。
5. 到点：通知“明晚 21:00，回来看看谁和你互相选择”；进入 Connections，200ms 静默揭晓；显示 mutual cards。
6. 无互选：不显示“0 人”，不显示“没人选你”；显示“本轮先到这里，下一桌见。”

**服务端：**

- `ensureConnectionSelectionWindow(eventId)` 幂等创建窗口。
- `upsertConnection` 第二次选择时进入 `mutual_pending`，不 snapshot 微信、不通知。
- `finalizeConnectionReveals` 每分钟扫描 `mutual_pending AND revealAt <= now`，事务内 flip + snapshot + 通知；`FOR UPDATE SKIP LOCKED`；幂等。
- 通知去重：`user + event + type` 唯一。
- 任何读取路径不得在揭晓前返回 peer 身份；测试覆盖。

**边界：**

- 窗口关闭后提交：409 + 只读文案。
- 网络失败：保留已选，重试；不重复插入。
- 用户中途退出：已提交选择保留；未提交不保留。
- 重复点击：按钮锁定 + 幂等键。
- 6 人桌：最多 5；活动参与者 >6 时仍 cap 5。

### 4.4 W4 — Run plan 与内容（G2 后，第 5–8 周）

> **v1.1 顺序约束：G2 期间冻结 run plan。** A/B 两组使用同一份当前 BREEZE 40 / GLOW 60 / BLAZE 90 计划；BREEZE/BLAZE v2 必须在 G2 readout 之后上线，或作为第三个实验臂单独标注。否则主持模式与 format 变化无法分离。
>
> 以下为**假设**，用 phase metrics 验证，不直接当结论。使用 `compileAgentRunPlan()`，`socialIcebreakerRunPlans.ts` 只做 fallback。

| Tier | 现 plan | 建议 v2 | 理由 |
|---|---|---|---|
| BREEZE 40 | warmup 10 + micro 10 + lie 15 + recap 5 | **warmup 8 + dice 12 + mirror 12 + recap 8 = 40** | reserved 的 dice 4.06 / mirror 4.18；去掉 forced-authorship lie；保留暖场+收尾 |
| GLOW 60 | warmup 8 + micro 8 + lie 15 + dice 12 + mirror 12 + recap 5 | 保持，安全修复后复测 | 结构完整；主要问题是 lie 压力，不是时长 |
| BLAZE 90 | warmup 8 + micro 8 + lie 15 + dice 10 + auction 17 + quip 17 + mirror 10 + recap 5 | **warmup 8 + micro 10 + lie 15 + dice 12 + quip 12 + mirror 12 + recap 6 = 75** | 90 分钟伤 pacing/host；auction 3.20、top2 8%，移出默认，保留 custom |

**内容：**

- 暖场第一屏用 curated deck，不等 LLM；LLM 只做 post-hoc 个性化。
- 深聊卡后置；第一张卡必须轻。
- 复玩去重：同一用户 30 天内不重复同一张卡。
- AIGC 角标 fail-closed；没有真实 AI 生成就不显示。
- 不做新 phase；`mini_script` 继续 flag-gated bonus，不进默认 plan。

### 4.5 W5 — 商业包装（第 3–8 周）

**不做：** 涨价、独立 SKU、30 天内 premium 发布。

**做：**

1. **Venue 含杯谈判**：每城 3 家；目标 ¥20–30/head welcome drink，票面保持 ¥88。
2. **全包价透明**：如果谈不下来，选择页/详情页明确“酒水自理”，不要让用户到场才发现。
3. **城市顺序**：
   - 深圳：轻主持 + 互选 pilot 首站（时间成本敏感、T46 未深耕）。
   - 上海：只打 ¥88 平价，作为 T46 对标/学习场。
   - 广州：连局包，不做溢价。
   - 北京：延后，不在 T46 叙事主场硬碰。
4. **Premium 门槛**：只在 G3 通过后；深圳 ¥138 起；上海不做溢价；广州做 pack；北京 later。

### 4.6 W6 — 指标与实验（第 1–4 周）

**北极星（双口径，永不合并）：**

1. **Per-person mutual intent** = 至少 1 个互选的人数 / 到场人数
2. **Dyad mutual rate** = 互选对数 / 15
3. **Mutual → WeChat exchange** = 互选后实际加微信 / 互选对数

**护栏：**

- awkward ≤30%
- 0 attribution exposure
- refund/complaint
- host minutes/table（专业主持 vs 轻主持）
- tables <70 ≤28%
- D7/D30 return by table band；zero-match 用户 D1 回访不得比 matched 低 >10pp

**基线：** 真实为 0；one-sided 38.8% 是模拟；mutual 20% 是实验假设，不是实测。

**G2 实验卫生（v1.1）：**

- 随机化单位 = 桌/组，不是用户；同一桌不混 A/B。
- 城市 = 深圳单城；同一 venue 档位、同一 weekday/time band、同一 ¥88。
- 预注册 eligible table：排除 test pool / bot / staff table / 取消或退款 / <4 位真实到场；不足 4 人桌单列，不混主分析。
- 最少 8 桌/arm 才做方向性判断；中途除安全回滚外，不改文案、run plan、venue、价格。
- 主指标按桌聚类；双分母并列；zero-match 用户 D1 回访作为护栏。
- 任何污染（换城市/换价/换 plan/换主持脚本）必须从主分析剔除并记录。

**隐私安全事件字典（v1.1）：**

| 事件 | 允许属性 | 禁止 |
|---|---|---|
| `connection_selection_viewed` | `window_state` | 不记录被选 target |
| `connection_selection_submitted` | `count`, `window_state` | 不记录 target id |
| `connection_selection_edited` | `count`, `window_state` | 不记录变更前后 target |
| `connection_reveal_viewed` | `mutual_count` | 不记录 peer id |
| `wechat_id_copied` | `mutual_count` | 不记录复制了谁的微信号 |
| `zero_mutual_viewed` | `window_state` | 不记录任何身份 |
| `light_host_claimed` | `table_id`, `phase` | 不记录用户画像 |
| `host_handoff` | `from_phase`, `frozen_minutes` | 不记录聊天内容 |
| `table_frozen_recovered` | `phase`, `recovery_seconds` | 不记录个人行为 |

> 事件只做聚合，不做“谁选了谁”的二次分析；选择目标 ID 只存在于 `connections` 业务表。

**Power（α=.05, 80%）：**

| baseline | +8pp | +10pp | +15pp | +20pp | +25pp |
|---|---:|---:|---:|---:|---:|
| 20% | 149 桌 | 98 | 46 | 28 | 18 |
| 30% | 184 | 119 | 55 | 31 | 21 |
| 38.8% | 200 | 129 | 58 | 33 | 21 |

> 12–20 桌只能检测约 25pp；8pp 需要 150–200 桌（900–1,200 人，6–8 周）。12–20 桌 A/B 是方向性实验，不是判决性实验。预注册主指标；按桌聚类；不要用用户当独立样本。

### 4.7 W7 — 丝滑性 / 高级感硬化（持续）

**原则：**

1. **一屏一个主行动。** CTA 固定底部，不浮动遮挡；不做双主按钮。
2. **服务端时间。** 倒计时用 server offset；不用设备时钟；不做假进度。
3. **无布局跳动 + 不做假倒计时。** 倒计时/数量 chip 预留空间；加载 >300ms 才出 skeleton；>6s 才出重试。时间未确认时只写「明天揭晓」，不显示倒计时、假进度或假秒数；已知时间也只用服务端 offset。
4. **克制的揭晓。** 180–220ms opacity/translate；无 confetti；`prefers-reduced-motion` 直接切换；haptic 只在选择和揭晓两个时刻。
5. **品牌语法 + 文案护栏。** 8rpx 节奏；88rpx 触控；solid `$color-primary`；无渐变；无 emoji；`JoyJoinIcon`；`Card` / `ParticipantAvatar` / `XiaoyueEmptyState` 复用。用户可见文案统一用「局 / 排桌 / 活动 / 同桌」，避免「匹配 / 社交 / AI」；待揭晓不得写成 popularity、被选次数或「谁选了你」。
6. **状态完整。** loading / empty / error / closed / pending / revealed / no-mutual / offline / duplicate / permission denied，每个都有出口。
7. **滑动返回安全。** `useResetOnShow` 重置 submitting/exiting；不把 transient flag 留在栈里。
8. **ScrollView 安全。** `min-height:0` 或显式高度；不在 ScrollView 内用 `Taro.pageScrollTo`；用 `scrollIntoView`。
9. **包体与样式。** 不新增重资产；子包新增样式后跑 `verify:subpackage-styles`；确认无 `sub-common.wxss`。
10. **可访问性。** aria label/role；对比度；触控 44pt+；读屏不读装饰元素。待揭晓状态读成「有 3 个选择等待揭晓」，不读任何人的名字；揭晓后只在 mutual 卡片读昵称。

**屏幕级验收：**

| 屏幕 | 必须 |
|---|---|
| 反馈选择页 | 0–5；已选数量；双方都选文案；窗口关闭只读；无“匹配成功” |
| 待揭晓卡 | 只有数量+时间；不显示身份；点击解释；无红点 |
| 揭晓 | 静默动效；互选卡片；微信号复制；无拒绝文案 |
| 轻主持卡 | 3 条规则；一个 CTA；可跳过；不挡流程 |
| 接力主持 | 180s 后出现；CAS；失败有 toast；不抢权 |
| 复盘 prompt | 指向待揭晓，不是终点；可关闭 |

---

## 5. 30 / 60 / 90 天

### 5.0 Pilot  staffing（v1.1）

| 角色 | 责任 | 投入 |
|---|---|---|
| Pilot DRI | 对 G0–G4 的节奏、范围和停止规则负责；唯一对外口径 | 1 人，全程 |
| Safety / on-call operator | 处理主持失联、冷场、投诉、隐私事件；有权一键切回 A | 1 人，活动时段 |
| Data readout owner | 每周产出 tables / dyad mutual / awkward / ops minutes / incidents；维护预注册 | 1 人，每周 2h |
| Venue BD | 每城 3 家含杯谈判、场地档期、现场问题 | 1 人，第 2–6 周 |

**每周 readout 固定五件事：** 有效桌数、dyad mutual、awkward 信号、ops minutes/table、安全/隐私事件。没有 readout 不开下一周。

### Days 1–7：安全 + 埋点 + 文案

| 交付 | Owner |
|---|---|
| 匿名投票/attribution 清理/卧底文案 | Backend + Taro |
| 0–5 上限、`mutual_pending`、`revealAt` schema | Backend |
| `connection_selection_windows` + 迁移 | Backend |
| 反馈页文案 + 待揭晓卡原型 | Design + Taro |
| 事件埋点：选择提交、窗口关闭、揭晓、微信复制 | Data |
| flag 脚手架 + 回滚演练 | Backend |

**Gate G0：** 0 attribution 泄漏；所有安全测试通过；迁移在 staging 预演；回滚可用。

### Days 8–14：3 桌排练 + 2 桌人工互选

| 交付 | Owner |
|---|---|
| 纸牌 + 首到者轻主持脚本 | PM + Ops |
| 3 桌排练（40 min） | Ops |
| 2 桌人工互选（表单 + 人工揭晓） | PM |
| 用户访谈（reserved 优先） | PM |
| 轻主持卡 UI | Taro |

**Gate G1：** 3/3 完成；≤1 跳过；无 >90s 冷场；ops ≤20 min/桌；≥4/6 愿意再来；轻主持自然出现；**需要专业主持救场 = 0**（首到者/同桌的自然轻主持介入不算失败）。

### Days 15–30：12–20 桌同城同价 A/B

| 组 | 体验 |
|---|---|
| A | 专业主持 + phase engine |
| B | 首到者轻主持 + 卡牌 + 无专业主持；保留 hostUserId/phase engine，无权限门 |

**交付：** 互选 v1 上线；每周 readout；主持工时/桌；安全事件 0；D7 回访。

**Gate G2（方向性）：**

**实验卫生（v1.1）：** 只跑深圳；同 venue tier、同 weekday/time band、同 ¥88；按桌随机分组；预注册有效桌（剔除 test pool / bot / 员工桌 / 取消退款 / <4 位真实到场）；每组至少 8 桌才做方向性判断；除安全回滚外，G2 期间冻结 run plan、文案、场地和价格。

- B 的 dyad mutual 不比 A 低 >10pp
- B ops ≤20 min/桌
- 0 安全事件
- 若 B ≥ A：专业主持未被证明，继续 powered test 或简化
- 若 A ≥ B +20pp：主持有显著价值，进入 powered test
- 中间地带：扩大样本，不宣布胜负

### Days 31–60：powered experiment + 商业包装

- 150–200 桌（或 60+60 分阶段）；预注册主指标；按桌聚类。
- Venue 含杯谈判（深圳/上海各 3 家）。
- Run plan v2 上线（BREEZE/GLOW/BLAZE）。
- Recap → 待揭晓 prompt；50/50 holdout。
- D7/D30、第二次见面、推荐意愿。

**Gate G3：** 8pp 可检测；主持增量明确；awkward ≤30%；退款/投诉可控。

### Days 61–90：商业决策

- 如果专业主持显著提升互选/复购：深圳 ¥138 premium pilot；上海 parity；广州 pack；北京 later。
- 如果主持无增量：phase engine 是成本，转向 card-led/轻主持产品，保留安全与互选。
- 如果互选本身无留存：停止扩互选，回到 fun product，不拿海报当关系。

**Gate G4：** premium 贡献 ≥¥550/桌；互选/awkward 不恶化；host 成本可解释；且 `host + venue premium ≤ ¥300/桌`（超过则贡献跌破标准局）。

---

## 6. 商业模型

### 6.1 单桌经济（假设，非实测）

| 场景 | 收入 | 成本 | 贡献 |
|---|---:|---:|---:|
| 标准 ¥88×6 | ¥528 | 支付 ~¥3 + 物料 ¥8 | **~¥516** |
| ¥88 含 ¥20/head 杯 | ¥528 | +¥120 | **~¥396** |
| ¥88 含 ¥30/head 杯 | ¥528 | +¥180 | **~¥336** |
| ¥138×6 + 专业主持 + 场地溢价 | ¥828 | 主持 ¥120 + 场地 ¥120 + 支付/物料 ¥13 | **~¥575** |

**结论：** ¥138 收入 +57%，贡献仅 +11%；premium 是差异化，不是利润修复。先谈 venue 含杯，让 ¥88 的全包感知接近 T46。

**Premium 成本阈值（v1.1）：** ¥138×6 = ¥828；支付/物料约 ¥13；贡献 = ¥815 −（host + venue premium）。要守住标准局约 ¥516 的贡献，`host + venue premium` 必须 ≤ 约 ¥300/桌；¥240 时贡献约 ¥575，¥300 时约 ¥515，超过 ¥300 即低于标准局，不应发布。

### 6.2 城市

| 城市 | 判断 | 动作 |
|---|---|---|
| 深圳 | 时间成本敏感，愿为“省时间”付费；T46 未深耕 | 轻主持 + 互选 pilot 首站；后续 ¥138 premium 首站 |
| 上海 | T46 总部/11 人；会被逐项比价 | 只打 ¥88 平价；学习/对标 |
| 广州 | 务实、性价比、复购好 | 连局包；不做溢价 |
| 北京 | T46 叙事主场（朝阳）；心价比/身份感 | 延后；不打溢价 |

### 6.3 不做的商业动作

- 不做破冰独立订阅/SKU
- 不涨挂牌价
- 不把 premium 放进月卡/季卡权益（会稀释 ¥16/场锚点）
- 不在 30 天内做 paid acquisition；先测 D30
- 不复制 T46 的 print/delivery/venue agent stack；先测 ops minutes/table

---

## 7. 风险与回滚

| 风险 | 信号 | 缓解 | 回滚 |
|---|---|---|---|
| 互选变成拒绝机器 | reserved 用户 D1 回访下降；访谈负面 | 不显示谁选了你；不显示数量；无拒绝通知；先 2 桌人工测试 | 关闭 `mutualSelectionV2Enabled` |
| B 组冷场 | >90s  silence；跳过卡 >1 | 轻主持卡；玩家接力；主持人 nudge；纸牌 fallback | 全量切 A；关闭 `icebreakerLightHostEnabled` |
| Ops 过重 | >20 min/桌 | 自助卡牌；SOP；只保留异常处理 | 停止 B；回到专业主持 |
| 揭晓 scheduler 失败 | backlog >5 min；通知延迟 | 幂等 job；告警；admin 手动触发 | 手动揭晓；关闭 v2 |
| 隐私泄漏 | pending 身份出现在 API/UI | `mutual_pending` 状态隔离；测试 | 立即关闭 v2；审计 |
| 主持接力滥用 | 频繁抢权 | 180s 门槛；CAS；审计；rate limit | 关闭接力；仅 admin transfer |
| Venue 含杯谈不下来 | 成本 >¥30/head | 透明“酒水自理”；换 venue；不做假含杯 | 保持现价 |
| 文案违规 | 出现“匹配/AI/社交” | copy review；WeChat review checklist | 回滚文案 |
| 包体/样式回归 | 主包超限；sub-common.wxss | 复用组件；构建门 | 移除新资产/样式 |
| 范围蔓延 | 新 phase/新 tab/新 AI | 本计划“不构建”清单 | 回到 gate |
| 实验污染 | G2 期间 run plan/文案/场地/价格变动；组间基线不一致 | 冻结变更；预注册；只允许安全回滚 | 作废该周数据，延长 G2 |
| 通知模板不可用 | 订阅模板未审核/字段不匹配/触达失败 | 先走站内 notification；模板审核后再灰度；deep link 到 Connections | 关闭通知，只用站内 |
| 互选数据保留/删除 | pending 身份残留；账号删除未清理 | TTL soft-delete；账号删除走 runbook；analytics 只存 count | 关闭 v2，清理 pending，审计 |

---

## 8. 不构建清单（30 天）

- 不做破冰独立 SKU / 订阅
- 不加新 phase
- 不做 premium 主理人桌发布
- 不做主持认证/培训体系作为第一解
- 不做自动推进（auto-advance 复活）
- 不做 T46 的 print/delivery/venue agent stack
- 不做新的 AI 生成表面；AI 退出关键社交路径
- 不做 matching weight 调整
- 不做新 tab；不把待揭晓做成独立页面
- 不做“谁选了你”/被选次数/拒绝通知/排行榜
- 不做跨 event 互选；不做 AI 代写选择理由（v1 连自由文本都不做）
- 不做假倒计时、假进度、任何 popularity 暗示
- 不做 confetti/重度揭晓动画

---

## 9. 验收清单

### 产品

- [ ] 反馈页 0–5 选择、数量、窗口关闭只读
- [ ] 提交后进入待揭晓，不显示 mutual
- [ ] Connections 待揭晓卡只显示数量+时间
- [ ] 到点揭晓；mutual cards；微信号只对互选可见
- [ ] 无互选文案不羞辱
- [ ] 轻主持卡 3 条 + 一个 CTA
- [ ] 接力主持 180s + CAS + 审计
- [ ] 复盘 prompt 指向待揭晓
- [ ] 第 6 位选择被服务端拒绝，客户端有明确 toast，不静默丢弃
- [ ] 窗口关闭后选择页只读；提交返回 `409 SELECTION_WINDOW_CLOSED`
- [ ] 截图状态齐全：选择页 / 待揭晓 / 揭晓 / 零互选 / 窗口关闭 / 轻主持卡 / 接力主持

### 技术

- [ ] `mutual_pending` 状态；无 pre-reveal 身份泄漏
- [ ] 0–5 服务端校验
- [ ] 窗口幂等创建；scheduler 幂等
- [ ] 通知去重
- [ ] 迁移 additive；staging 预演；`db:verify`
- [ ] flag 回滚演练
- [ ] `npm run guardrails` / typecheck / server tests
- [ ] `verify:subpackage-styles` + package size
- [ ] 真机：冷启动/弱网/滑动返回/杀进程/时钟偏差/重复点击
- [ ] 第 6 位选择返回 `400 TOO_MANY_SELECTIONS`；关闭窗口返回 `409 SELECTION_WINDOW_CLOSED`
- [ ] `/api/shell/connections`、feedback-state、`/api/my-connections`、错误和日志均无 pre-reveal 身份
- [ ] reveal scheduler 重复 tick 幂等；claim-host 拒绝 bot、CAS 失败安全返回
- [ ] flag off 恢复旧即时 mutual 行为；回滚演练通过

### 数据

- [ ] 选择提交、窗口关闭、揭晓、微信复制、D7/D30 埋点
- [ ] 双口径 mutual 报表
- [ ] 0 attribution 监控
- [ ] 实验预注册；按桌聚类；有效桌剔除规则已执行
- [ ] analytics 不含被选 target ID；只存 count/window_state
- [ ] 账号删除/保留 runbook 演练：mutual 保留、非 mutual pending 清理、微信 snapshot 处理

---

## 10. 开放问题（v1.1）

1. **通知模板**：现有订阅模板能否承载「明晚 21:00 回来看看」的服务通知？字段、审核、deep link 是否都通？未通前只走站内 notification。
2. **轻主持激励**：pilot 先不给 thank-you 或工资；host ladder 后置。需要确认“义务 3 分钟”是否会影响首到者体验。
3. **专业主持成本**：¥120/桌是否成立？需要真实结算数据；若显著高于 ¥120，premium 阈值更紧。
4. **Venue 含杯**：能否谈到 ¥20–30/head？谈不下来是否换 venue，还是透明“酒水自理”？
5. **多人活动范围**：活动参与者 >6 时，互选是按桌/按 group 还是按 event？v1 建议严格按同桌 group，不做跨桌。
6. **保留与删除**：非 mutual pending 的 30 天清理、微信 snapshot、账号删除边界的法务确认。
7. **T46 90% 口径**：仍需一手确认；未确认前不做对外比较。
8. **Premium 阈值**：`host + venue premium ≤ ¥300/桌` 是否作为 G4 硬门槛？建议是；超过则不放 premium。

---

## 11. 附录

### 11.1 文案 deck

| 场景 | 文案 |
|---|---|
| 选择页标题 | 想继续了解谁？ |
| 选择页说明 | 最多选 5 位。双方都选，明晚 21:00 一起揭晓。 |
| 已选 | 已选 3 位 |
| 提交后 | 选择已收好。明晚 21:00 回来看看。 |
| 待揭晓卡 | 明晚 21:00 揭晓 · 你选了 3 位 |
| 待揭晓解释 | 只有互相选择，才会看到彼此的微信号。 |
| 揭晓 | 有 2 位和你互相选择 |
| 无互选 | 本轮先到这里。下一桌，认识新的人。 |
| 轻主持 | 你最早到，这一桌先交给你 3 分钟。 |
| 轻主持三条 | 开场 · 翻牌 · 收尾 |
| 接力 | 主持人暂时不在，你可以接手这一桌。 |
| 复盘 prompt | 把今晚收进一张卡，明晚 21:00 回来看看。 |

### 11.2 关键文件

- `apps/mini-program/src/pages/event-feedback/index.tsx`
- `apps/mini-program/src/pages/event-feedback/steps/ConnectionsStep.tsx`
- `apps/mini-program/src/pages/connections/index.tsx`
- `apps/server/src/routes/domains/social.ts`
- `apps/server/src/repositories/legacyStorageRepo.ts`
- `apps/server/src/repositories/connectionsRepo.ts`
- `apps/server/src/repositories/shellRepository.ts`
- `packages/shared/src/schema/_definitions.ts`
- `apps/server/src/lib/socialIcebreakerHostResilience.ts`
- `apps/server/src/routes/socialIcebreakerExtended.ts`
- `apps/server/src/routes/domains/adminSocialIcebreaker.ts`
- `packages/shared/src/runPlanCompiler.ts`
- `packages/shared/src/socialIcebreakerRunPlans.ts`
- `apps/server/src/lib/featureFlags.ts`
- `apps/server/migrations/seed_pricing_plans_20260805.sql`
- `packages/shared/src/budgetTiers.ts`
- `docs/research/2026-11-10-t46-article-review.md`

### 11.3 来源

- T46 文章（融了么，2026-11），用户一手参与补充（2026-11-10）
- 投资家网 2026-11-02；tableforsix.cloud 2026-10-20；Tencent News 2026-10-15；投资界 entity record
- JoyJoin 1,000 人模拟面板（seed 20261110；0 真实 session）
- PM Agent delta memo；商业化 Agent delta memo

---

## 12. 实施状态（2026-11-10）

**代码侧 G0 已完成，未提交。** 已落地：四类 attribution 隐私清理（谎言侦探、群像镜像、卧底、机智对决）与复盘匿名化；warmup fallback 先轻后深；服务端 0–5 上限；`mutual_pending` + `reveal_at`；`connection_selection_windows` 与迁移 0101；24h 时间锚点；揭晓 scheduler + 站内通知；30 天非互选清理；同桌校验；不透明 quip answerId；待揭晓卡；互选重进回填与编辑；7 个 G0 analytics 事件；`mutualSelectionV2Enabled` 默认关闭及回滚文档。

**验证：** G0 定向服务端 12 文件 / 245 通过 + 7 跳过；小程序互选/反馈/Quip 相关 15 文件 / 199 通过；`build:weapp` 通过（主包 1.24 MB / 2 MB）；`verify:subpackage-styles` 通过；全 workspace typecheck 通过；guardrails 0 error、12 个既有 design warning；`git diff --check` 干净。

**尚未关闭的现实 gate：**
1. 迁移 0101 未在 staging 执行，不能声称 G0 migration gate 通过；步骤见 `docs/runbooks/connection-selection-v2-g0.md`。
2. G1 三桌纸牌 + 首到者轻主持排练、两桌人工互选尚未执行；步骤见 `docs/runbooks/icebreaker-g1-pilot.md`。
3. G2 12–20 桌同城同价 A/B 尚未执行，因此 W4 run plan v2 与 W2 轻主持软件按计划**不提前落地**。
4. 真机 / 微信开发者工具未验：重进回填、替换态禁用 CTA、409 关窗 toast、Quip `（我的）` 标记与长按举报。
5. 揭晓通知跨副本 dedupe 目前是 `INSERT … WHERE NOT EXISTS`，唯一约束有意延后；同桌分组在 pool group 不可用时退化为同活动校验。

**结论：** 代码已推进到必须由真实场次才能继续的边界。下一步不是继续加代码，而是执行 G1 排练与 staging 迁移演练，再决定 G2 与后续 W4/W2。

---

**最终判断：**
> 不要用更多的局，掩盖更少的关系。先把一桌人接住，再谈溢价。
