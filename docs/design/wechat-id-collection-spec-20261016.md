# 微信号采集点回补 — 设计与实施 Spec

> **Status**: Approved for implementation (2026-10-16)
> **Surface**: `apps/mini-program` — `pages/event-feedback`（launch-primary 客户端）
> **决策来源**: PM × UIUX 双专家独立规划 + 全旅程触点复检（两轮结论一致）
> **Server touch**: 1 个新端点 + 3 处小改；核心写入路径已就绪且有测试锁定

---

## 1. 问题陈述

互选换微信号链路中，存储/快照/揭示/展示全部就绪，唯独**采集环节缺失**——小程序没有任何地方让用户填写微信号：

| 链路环节 | 状态 | 证据 |
|---|---|---|
| Schema(`users.wechat_contact_id` + `_set_at`;`connections.user_a/b_wechat_id` 快照) | ✅ | `_definitions.ts:260-261, 812-813` |
| 服务端写入(feedback POST body `wechatContactId`,未设置时 backfill) | ✅ 测试锁定 | `social.ts:489-495`;`socialComplianceWriteFreezes.test.ts:53` |
| 互选揭示(快照优先,feedback 响应有 live fallback) | ✅ | `legacyStorageRepo.ts:392-418`,`social.ts:478` |
| 小程序展示(revealed 步复制按钮 + 诚实空态) | ✅ | `event-feedback/index.tsx:606-620`;`connections/index.tsx` |
| **采集 UI** | ❌ **缺失** | payload builder 不含字段;edit-profile/onboarding 无输入;唯一采集 UI 在已归档 web 端(`WechatIdSetupStep.tsx`),从未移植 |

**后果**:互选成功后双方几乎都看到「对方尚未设置微信号」——选人步的承诺「互相选择后,即可看到对方的微信号」(`index.tsx:768`)当前无法兑现,是信任负债。

---

## 2. 全旅程触点检验(锁定前复检,结论:onboarding 否决)

### 2.1 两条支配全局的结构性事实

1. **互选的唯一入口就是反馈流程**:`upsertConnection` 全库唯一调用点在 feedback POST(`social.ts:491` 区域)。任何最终发生互选的用户 100% 经过反馈选人步 → 条件触发的 A 步对目标人群**精确完备覆盖**,onboarding 多覆盖的只是永远不会消费该功能的人(纯 PII 库存)。
2. **快照读的是互选翻转瞬间的 live 值**(backfill 先于 flip 执行,同请求内)→ 更早填写相对 A 步**没有任何快照红利**。

### 2.2 覆盖率数学

互选双端有号率 ≈ p²(双方独立):

| 路径 | 语境 | 估计填写率 | 双端有号率 |
|---|---|---|---|
| onboarding 选填 | 零语境、信任低谷、PII 信任税 | 20–35% | ~9% |
| 反馈 A 步 | 刚亲手勾选具体的人 + 信任峰值 | 60–80% | ~49% |

onboarding 曝光多 5 倍也追不回——**它覆盖的是人,不是时刻**。无语境选填 PII 还诱发敷衍填写(假号/死号),在揭示时刻反噬体验。

### 2.3 触点决策记录(否决登记,防止议题复活)

| 触点 | 结论 | 核心理由 |
|---|---|---|
| Onboarding | ❌ | 漏斗税由 100% 用户承担(含从不参加活动者);PIPL 最小必要原则(目的未发生即收集);脱离「活动通讯录」审核语境;触 `onboarding-state-architecture` 领地实现半径大 |
| 订座 ceremony | ❌ | Active spec 自带否决条款("Data-collection modules get demoted");支付漏斗不可加税 |
| matching-status 已匹配 | ❌(第一候补) | 互选未发生,语境错位;若 A 步 skip 率过高,往这加,**不是**回头动 onboarding |
| 集结房间 | ❌ | flag dark + 场景页无输入形态 + 同意模型错位(桌友 ≠ 互选) |
| **反馈 A 步** | ✅ 主采集 | 动机峰值、信任峰值、税负精准、表单原生语境、实现自包含 |
| **revealed C 卡** | ✅ 补救层 | 互选结果是最强补救动机;服务端 live fallback + COALESCE 使其真实有效 |
| edit-profile 常驻 | ⏸ P2 | 自助底板(查看/改号),不替代场景化触发;需更新语义决策 |

**复活条件**:A 步 set rate 持续 <50% 且 skip 归因支持"时机"解释时,重开 matching-status 候补评估。

---

## 3. 范围

**In scope(v1,单 PR)**:
- shared:`wechatContactId.ts` validator(拒 `wxid_` 前缀)+ `INVALID_WECHAT_CONTACT_ID` 错误码模板
- server:backfill 过 validator(invalid 只跳写 + log,绝不 400 主提交);新端点 `POST /api/user/wechat-contact`(set-once 幂等);`connectionsRepo` peerWechatId 包 `COALESCE(snapshot, users.wechat_contact_id)`;analytics 白名单 +6 事件;DB 旗标 `wechatIdCollectionEnabled`(默认 off)入 auth features
- 小程序:反馈步骤机加条件 `'wechat'` 步(A)+ revealed 补救卡(C),页面内 local component,CSS 同 PR 落页面 `index.scss`

**Out of scope**:edit-profile 常驻入口(P2);改号能力(first-write-only 保持);互选门控("不填不给看"属胁迫,否决);快照模型变更;web 端(已归档)。

**v2 决策预留**:开放改号时需决策"更新是否传播到既有快照"(当前 COALESCE 读 live 值 = 隐式传播;若改号放开需显式决策 freeze-vs-propagate)。

---

## 4. 设计

### 4.1 步骤机(A 步)

```
experience → connections(选人) → [wechat 条件步] → wrapup → revealed
```

- 触发条件:`selectedConnections.length > 0 && !currentUser.wechatContactId && features.wechatIdCollectionEnabled`
- 进度点:动态 `visibleSteps`(3 或 4 点);wrapup 的「上一步」回退目标随条件切换
- 空值收敛:输入为空点「保存并继续」= 视同「暂不填写」,直接前进不报错
- 校验时机:onInput 只清错;onBlur 与保存时校验;错误行 `role='alert' aria-live='polite'`
- 提交:`buildEventFeedbackPayload` 加 `wechatContactId`(仅保存且过校验时带);提交成功后 `setQueryData(AUTH_QUERY_KEY)` 同步本地 auth 缓存
- `useResetOnShow` 纳入新 transient flag;输入值刻意不复位(swipe-back 保留输入)

### 4.2 revealed 补救卡(C)

- 可见条件:`hasMatches && !currentUser?.wechatContactId && !wechatSaved && !remedySaved && features.wechatIdCollectionEnabled`
- 位置:互选成功文案之下、match 卡片列表之上
- 保存走新端点 `POST /api/user/wechat-contact`;成功后卡内 swap 成功行 + `haptics('success')` + 同步 auth 缓存

### 4.3 Validator(双端同源,`packages/shared/src/wechatContactId.ts`)

- 规则:`/^[A-Za-z][A-Za-z0-9_-]{5,19}$/`(字母开头,6-20 位,字母/数字/下划线/减号)
- **拒 `wxid_` 前缀**:系统默认号无法被搜索添加,放过 = 交换死号
- 同文件导出文案常量(格式 hint / wxid 提示),保证双端同源

### 4.4 文案(品牌治理:无 emoji;避开 匹配/社交/撮合;「互选」为已建立词汇)

| 位置 | 文案 |
|---|---|
| A 步标题 | 留个微信号 |
| A 步副标题 | 只有互相选中的伙伴能看到 |
| 格式 hint(常驻) | 字母开头,6-20 位,可含数字、下划线、减号 |
| 格式错误 | 微信号格式不对,检查一下? |
| wxid 错误 | wxid_ 开头的是系统号,别人搜不到;填你自己设置的微信号 |
| 隐私条 | 仅互选成功的伙伴可见,不会公开 |
| 一次性安抚(quiet 行) | 设置一次,之后每局互选都自动生效 |
| 主 CTA | 保存并继续 |
| 跳过 | 暂不填写 + quiet 行「互选成功后,还能在结果页补充」 |
| C 卡标题/说明 | 你还没留微信号 / 互选成功的伙伴看不到你的联系方式,现在补上还来得及 |
| C 成功 swap | 已保存,对方现在就能看到你的微信号 |

**合规债(另记,不在本 PR)**:互选通知文案「🎉 新的双向匹配」(`social.ts` notification)含审核禁用词「匹配」,另开一行修正。

---

## 5. 服务端变更

| 项 | 文件 | 说明 |
|---|---|---|
| 旗标 | `lib/featureFlags.ts` | `wechatIdCollectionEnabled` → env `WECHAT_ID_COLLECTION_ENABLED`,`DEFAULT_FLAG_VALUES` false(ships dark,baseline 后开) |
| auth features | `lib/buildAuthUserResponse.ts` + `packages/shared/src/api/auth.ts` | features 批量解析加一项;AuthUserResponse type 加可选字段 |
| backfill 加固 | `routes/domains/social.ts:489-495` | 过 shared validator;invalid → 跳写 + `logger.warn`,不阻断主提交;保持 `storage.updateUserWechatId(` 调用(freeze 测试锁定) |
| 新端点 | `routes/domains/profile.ts` | `POST /api/user/wechat-contact`,requireAuth + 旗标 gate(503);body `{ wechatContactId }`;validator 复验 → 400 `{ code: 'INVALID_WECHAT_CONTACT_ID', message }`;set-once:已设置 → 200 `{ ok: true, unchanged: true }`;未设置 → 写 `wechatContactId + wechatContactIdSetAt` → 200 `{ ok: true }` |
| COALESCE | `repositories/connectionsRepo.ts:55-60` | peerWechatId CASE 包 `COALESCE(<snapshot>, ${users.wechatContactId})`(peer join 已存在) |
| 埋点白名单 | `routes/domains/analytics.ts` | +`feedback_wechat_step_shown` / `feedback_wechat_saved` / `feedback_wechat_skipped` / `feedback_wechat_invalid` / `feedback_wechat_remedy_saved` / `feedback_wechat_remedy_failed`(metadata 永不携带微信号本体) |

---

## 6. 指标

**北极星(零新埋点,快照列天然是档案)**:

```sql
SELECT COUNT(*) FILTER (WHERE user_a_wechat_id IS NOT NULL AND user_b_wechat_id IS NOT NULL) * 1.0
     / COUNT(*) AS both_set_rate
FROM connections WHERE status = 'mutual';
```

| 指标 | 目标 | 窗口 |
|---|---|---|
| 双端有号率(北极星) | ≈0% → ≥40% | 上线后 4 周 |
| A 步 set rate(`saved/shown`) | ≥50% | 4 周 |
| A 步 skip rate | ≤40%;超出先迭代文案/位置,不迭代胁迫 | 2 周 |
| **护栏:反馈提交完成率** | 相对上线前 baseline 降幅 ≤3pp; breach → 关旗标回滚(无需发版) | 前 2 周持续 |
| invalid rate(`invalid/saved`) | ≤15%;超出说明格式规则与真实号不匹配 | 2 周 |

**上线前 baseline 拉取**(prod read-replica,一次性):① 当前 `wechat_contact_id` 设置率;② 当前双端有号率;③ 近 8 周互选量级。贴进追踪 issue 后再开旗标。

---

## 7. 实施顺序与验收

1. shared validator + 错误码 + 单测 → 2. 服务端五项 → 3. 小程序 A 步 → 4. C 卡 → 5. 埋点接线 → 6. 验证

**验收命令**:`npm run typecheck -w mini-program`、`npm run test -w @joyjoin/server`、`npm run guardrails`、`npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program`(本设计无组件 SCSS 拆分,应天然通过;新 BEM 类同 PR 落页面 index.scss 过 `check-class-coverage`)

**DevTools 实检清单**:A 步(空/输入中/格式错/wxid 错/合法)、C 卡(显隐/保存中/成功/失败)、进度点 3↔4、键盘顶起态、安全区、reduced-motion、swipe-back 后补救按钮不卡「保存中…」

---

## 8. 风险

| 风险 | 缓解 |
|---|---|
| 新增步压低反馈完成率 | 条件触发(仅选人且未设号者见);跳过一等公民;单字段 ~10s;护栏指标 + 旗标回滚 |
| 格式误伤真实号 | 官方规则必过;wxid 拒收是特性(死号);`feedback_wechat_invalid` 带 reason 观察分布 |
| 假号腐烂数据 | charset 白名单结构性挡手机号/中文/「加我V」;不建验证剧场;用复制行为指标旁证 |
| 补救滥用(频繁改号) | set-once 幂等,服务端权威 |
| 隐私 | 埋点 metadata 永不带号本体;快照+COALESCE 只"补可见"不"撤可见"(set-once 下);PII 库存面不新增 |

---

## 9. 证据索引

- Schema:`packages/shared/src/schema/_definitions.ts:260-261, 812-813`
- 写入/快照/揭示:`apps/server/src/routes/domains/social.ts:489-495`(backfill)、`legacyStorageRepo.ts:392-418`(flip 快照)、`:437-445`(updateUserWechatId)、`social.ts:478`(响应 live fallback)
- 连接列表快照-only(本 PR 修):`repositories/connectionsRepo.ts:55-97`
- 客户端展示:`apps/mini-program/src/pages/event-feedback/index.tsx:606-620, 768`;payload:`pages/event-feedback/feedbackPayload.ts:81`
- 合规锁:`apps/server/src/__tests__/socialComplianceWriteFreezes.test.ts:40-57`
- 审核姿态:`docs/runbooks/wechat-review-submission.md` §1/§6;文案法:`docs/copy/brand-copy-strategy.md` 🔴
- 历史 parity(仅逻辑参考,文案不可移植):`archived/workspaces/user-client/src/components/feedback/WechatIdSetupStep.tsx`
