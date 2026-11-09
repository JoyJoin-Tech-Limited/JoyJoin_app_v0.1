# acknowledgment-beat-v1 — 开场接话提示实验合同

> 状态：实现合同已锁定（2026-11-09）。本文冻结实验定义、数据口径、人工编码规则和暂停权限。看到结果后不得修改口径；需要变更时必须另起 experiment id。
>
> 目的：验证一个**无新交互的开场提示**是否提升「我的发言有被同桌接住」的感受。它不是复购、留存、匹配或商业化实验。

## 1. 范围与不变量

### Treatment

在可见、已翻开的 warmup topic card 底部现有 chrome 位置显示一句静态文案：

> 先接一句，再换题；不想展开也可以。

- 没有按钮、点击目标、计时器、toast、overlay 或动画。
- permission whisper 与深聊锦囊优先；它们出现时本提示不占位。
- treatment 提示与原题数计数器复用同一底部槽位，不增加第二条教学行或卡片高度。
- 不改 phase 顺序、时长、run plan、host 权限、AIGC 标识、内容生成或预生成。

### Feedback

`feedbackAcknowledgmentItemEnabled` 开启时，活动评价 experience 页出现可选五点题：

> 今晚，我的发言有被同桌接住
>
> 凭感觉选一个就好，可不答

选项：`没有 / 偶尔 / 一般 / 较多 / 充分`，内部分值 1–5。未触碰 = `0`，提交时转为「未回答」，**绝不当作 0 分**。

### 明确不做

不做再约 CTA、Duo、定价/券/权益变化、付费包容、匹配/换桌/封禁、增减或重排 phase、自动推进、运行时六席模拟、新 LLM、私聊推断、服务消息营销，也不宣称提升第二晚到场、留存、收入或普遍真实桌质量。

## 2. 开关与回滚

| DB flag | Env fallback | 默认 | 独立作用 |
|---|---|---:|---|
| `icebreakerAcknowledgmentBeatEnabled` | `ICEBREAKER_ACKNOWLEDGMENT_BEAT_ENABLED` | `false` | warmup 提示、分配与曝光事件 |
| `feedbackAcknowledgmentItemEnabled` | `FEEDBACK_ACKNOWLEDGMENT_ITEM_ENABLED` | `false` | 可选反馈题与成功后分析事件 |

两者通过 `/api/auth/user` 的 `features` 暴露，客户端不自行发明开关状态。staging 先 ON 验证，再 OFF 验证；production 初始均 OFF。

发生 guardrail breach：立即关闭 `icebreakerAcknowledgmentBeatEnabled`。保留安全的测量，不改变已分配体验；恢复必须取得 **PM + Commercial + QA** 一致同意。反馈题可独立关闭。

## 3. 分配与归因

- Experiment id：`acknowledgment-beat-v1`。
- 固定盐：`acknowledgment-beat-v1:2026-11-09`。
- 纯函数：`viewModels/acknowledgmentBeatModel.ts` 对 `salt + icebreakerSessionId` 做稳定 FNV-1a 哈希；最低有效位 0 = `control`，1 = `treatment`。
- 以桌为单位 50/50；同一桌所有座位、所有设备、重进页面均得到同一 variant。
- 仅 flag ON、`icebreakerSessionId` 非空、非 `isTestMode` / `runBots`，且服务端返回 `poolGroupContext` 的 session 参与。`/start` 通过 `eventPoolGroups → eventPools` 确认 `isTestPool=false` 后才写入该上下文；已有 session 在 rejoin 时回填。
- blind-box、legacy event、测试池、未知 session 没有 `poolGroupContext`，不得分配；客户端不得把多态路由 id 自行解释为 pool group。
- `eventPoolGroupId` 与 `poolId` 都只来自服务端确认的 `poolGroupContext`；客户端还会校验 `eventPoolGroupId === icebreakerSessionId`。
- 不重随机、不因结果换盐、不在实验中修改文案。

## 4. 事件合同

### `warmup_acknowledgment_assignment`

- 每个 eligible session 每台设备最多一次；control 与 treatment 均发送。去重键持久化为 `jj_ack_beat_assignment_v1:<session>`，组件 remount / 页面重进不得重复。
- metadata：`experimentId`、`variant`，以及服务端确认的 `eventPoolGroupId`、`poolId`，加现有 analytics 的 `icebreakerSessionId` / `phase='warmup'`。

### `warmup_response_beat_view`

- 仅 treatment；每张可见且已翻开的 topic card 每台设备最多一次。去重键持久化到 WeChat storage（`jj_ack_beat_view_v1:<session>:<revision>:<topic>`），组件 remount / 页面重进不得重复；storage 不可用时以组件 ref 保底且绝不影响流程。
- 只有 `state === 'topic_card' && isFlipped`、页面可见、没有 celebration/ritual/tier 等高优先级遮挡时才记录；翻转后再等待 550ms（reduced-motion 200ms），等待期间被遮挡则取消，未实际出现的提示不算曝光。
- metadata 同 assignment，加当前 topic id/index/revision；不得加入题目正文或用户资料。

### `feedback_acknowledgment_submitted`

- 仅在 feedback flag ON、canonical `POST /api/events/:eventId/feedback` 成功后、且本题分值 > 0 时发送；若选择后 flag 变 OFF，不得发送。
- 409 `FEEDBACK_ALREADY_SUBMITTED` 不重复发送；未答题不发送。
- metadata：`eventId`（pool 路由 id）、`eventPoolGroupId` 与 `poolId`（仅在 matched registration 确认时提供）、`experimentId`、`score`。
- **不发送 variant**；variant 由桌级 assignment 离线连接，禁止在反馈页推断。
- 本题不进入 canonical feedback payload、group outcome、奖励、deep-feedback、XP、匹配、资料或模拟器数据。

所有事件 fail-open；metadata 不含私聊文本、昵称、用户 id、画像字段、原始 innerThought 或模拟分数。server/client 事件枚举必须同步。

## 5. 冻结分析口径

### 样本与分母

- 合格桌：真实、非测试 pool-group table，存在有效 assignment；按桌分析，不把同桌多设备当独立桌。
- 合格反馈：成功 canonical POST 且 `feedback_acknowledgment_submitted` 的 1–5 分回答。
- 主指标分母：每个 variant 的合格反馈回答数；同时报告合格桌数与响应率，避免把响应选择偏差藏起来。
- 未答题、重复设备事件、无法归因事件、测试/bot 场排除；分别计数，不以 0 填补。
- 缺失 assignment 的反馈只能进入「未归因」桶，不得按反馈页猜测分组。
- 同一用户重复提交以 canonical 成功记录为准；分析前去重并固定规则。

### 主结果

- `felt-heard top-box` = 分值 **4 或 5** 的回答占比。
- treatment − control 的 top-box 百分点差，附不确定区间；同时报告 1–5 分布，不只看均值。
- 建议继续门槛（**预先登记，非已观测基线**）：≥30 张真实 pool 桌（每组 ≥15），≥90 份成功反馈回答；top-box 提升 ≥15 个百分点且不确定区间不支持明显伤害。
- 样本不足、归因不足或事件链断裂 = `INSUFFICIENT`，不是成功，也不是「方向向好」。

### 机制指标（子样本）

- 人工观察的 acknowledged-bid rate 提升目标 ≥15 个百分点。
- 若未完成盲评编码，该指标只作探索性结果，不得作为继续依据。

### Guardrails

出现以下任一情况暂停 treatment：

- overall rating 或 atmosphereScore 相对 control 恶化 > 0.3；
- 反馈完成率相对恶化 > 10%；
- 每桌 host 操作中位数增加 > 1；
- 出现可信且与 treatment 相关的信任/安全投诉。

另有强迫发言、被监视感、明显冷场增加或主持负担投诉时，即使未达数值门槛也可暂停。

## 6. 人工 acknowledged-bid 编码规则

观察者在不知道 variant 的情况下编码；至少 20% 双编码，先评估一致性再使用机制指标。

1. **Bid**：一位参与者明确提出问题、兴趣话题或个人经历/想法，且给同桌留下可回应空间。
2. **Acknowledged**：之后两个发言回合内或 60 秒内，另一位参与者作出相关内容回应（追问、共鸣、经验接续或明确回应问题）。
3. **Unacknowledged**：窗口内只有本人继续、他人直接换题、无关插话或无人回应。
4. 无法听清/判断标 `uncodable`，不强行归入未接住；记录原因。
5. 元数据只用座位别名、phase、topic-card id、相对时间、bid 类型、是否 acknowledged、host/peer 回应；默认不采集原始音频或全文。
6. 记录 host 经验、tier/vibe、桌级 energy/depth 带、提示曝光、host 操作数、迟到与场地噪声。
7. 同时记录负面效果：强迫轮答、追问压力、host 打断、停顿变长、被监视感。

## 7. 发布顺序与决策

1. **准备**：自动化测试、类型检查、guardrails、subpackage 样式验证；既有五位首次主持零培训 smoke 仍是生产门槛。
2. **Staging**：两 flag ON 验证 treatment/control、重进一致性、事件和反馈；再 OFF 验证无提示、无题目、无实验事件。
3. **Production 第 1–7 天**：feedback ON、beat OFF，建立基线；签署最终样本量和效应门槛。
4. **第 8–30 天**：两 flag ON，固定 50/50 holdout；不偷看、不改文案、不重随机。
5. **决策**：PASS 只允许继续/复刻 facilitation pilot；INSUFFICIENT 补数据；GUARDRAIL 暂停；无效应则删除提示，不叠加更多 AI 或弹层。
6. 第二晚到场、Connections/Duo、留存和收入必须另起实验，不从本实验外推。

## 8. 实现落点与验证

- Flags：`apps/server/src/lib/featureFlags.ts`、`buildAuthUserResponse.ts`、`packages/shared/src/api/auth.ts`、`packages/shared/src/copy/featureFlags.ts`、`.env.example`。
- 服务端资格：`apps/server/src/lib/socialIcebreakerAccess.ts`（join pool + `isTestPool=false`）与 `apps/server/src/routes/socialIcebreaker.ts`（创建写入、rejoin 回填/移除）。
- Warmup：`viewModels/acknowledgmentBeatModel.ts`、`viewModels/acknowledgmentBeatExposureStore.ts`、`WarmupPhaseView.tsx`、`SessionPhaseViews.tsx`、`components/WarmupCardSlot.tsx`、对应 SCSS 与 page props。
- Feedback：`pages/event-feedback/index.tsx`、`lib/analytics/feedbackAnalytics.ts`。
- Analytics：`lib/analytics/socialIcebreakerAnalytics.ts`、`apps/server/src/routes/domains/analytics.ts`。
- 测试：`acknowledgmentBeatModel.test.ts`、`acknowledgmentBeatExposureStore.test.ts`、`acknowledgmentBeatWiring.test.ts`、`socialIcebreakerPoolGroupContext.test.ts`、`eventFeedbackFlow.test.ts`、flag contract tests、server/client typechecks、guardrails、weapp build + subpackage style gate。

DevTools/真机布局、首次主持零培训 smoke 和真实样本观察仍是手工 release gates；自动化通过不等于这些已完成。
