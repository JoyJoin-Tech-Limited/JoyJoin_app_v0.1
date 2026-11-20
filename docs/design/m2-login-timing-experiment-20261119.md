# M2 登录时机实验 Spec v2

- 状态：待评审
- 日期：2026-11-19
- 范围：JoyJoin 微信小程序 onboarding 登录 handoff
- 本轮：只改文档，不动代码

## 0. v2 相对 v1 的改动

1. 删除 C。C 是结果出现前的登录墙，不做第二轮。
2. 纠正控制组定义：A 已经是 FinalStage 登录，也就是 after-reveal；B 是把登录门提前到首屏结果已渲染、reveal 未完成。
3. 实验主指标改为 `test_complete → login_success`；`results_view → login_success` 降为诊断项。
4. 300/组不再用于判断 ≤2pp 等价；首选 n≈1000/组，流量不足时用 300/组 + >5pp 方向性断路器。
5. Duo 按「对」分配，不按 anonymousId；300/组下不宣称 organic/invite/duo 分层结论。
6. 商业验收改为首个完整周期约 14 天，指标为每场实收、报名→成行率、退款率；7 天只看分流稳定性。
7. 增加三个硬前置：`pendingReferralCode` 入口持久化、取消后结果完整可读、结果页性能用绝对 p75 阈值。

## 1. 背景与问题

当前流程：

匿名测试 → 结果页（slot / reveal / final）→ FinalStage 登录 handoff。

v1 以为在比较「登录放在结果揭晓前 vs 后」。实际控制组 A 已经是 FinalStage 才出登录 CTA，也就是 after-reveal。B 不是 after，而是把登录门从 FinalStage 提前到「首屏结果已经渲染、reveal 尚未完成」。

因此实验真正要回答的是：

> 把登录门提前到「用户刚看到第一眼结果、但还没看完揭晓」时，带来的登录提升，是否值得它造成的打断、完成率损失和信任风险？

H1「after 更好」无法证伪，删除。

## 2. 假设

**H2a（收益）**：B 相比 A，`test_complete → login_success` 提升 ≥8%。

**H2b（代价）**：B 不使 `test_complete → results_view` 下降超过 5pp；取消后用户仍能完整看结果；报名→成行、退款率、邀请归因、Duo 配对不被破坏。

两条同时成立，B 才可转正。

## 3. 变体

| 变体 | 登录时机 | 说明 |
| --- | --- | --- |
| A 控制组 | FinalStage 登录 CTA | 当前线上行为，已是 after-reveal |
| B 实验组 | 首屏结果已渲染、reveal 未完成时出登录 | 必须让用户先看到真实结果，不能是 loading 屏或空白屏 |
| ~~C~~ | ~~结果加载前~~ | 删除。价值出现前的登录墙，不做第二轮 |

**B 的触发定义**：首屏结果（原型名 / 形象 / 第一句结果文案）已实际渲染，且 reveal 动画尚未结束。若首屏只有加载态，不得触发登录。

## 4. 分流与样本

- 个人用户：按 `anonymousId` 50/50，稳定 7 天。
- **Duo：按「对」分配**，两人同臂；无法稳定成对时，整对排除实验，不拆开。
- 仅新用户（首次完成测试）。
- 样本量二选一：
  - **首选：n≈1000/组**，用于判断 8% 相对提升，并避免 300/组 95% CI ≈ ±7.3pp 的伪结论。
  - **流量不足：300/组 + 方向性断路器**：`test_complete → results_view` 降幅 >5pp 立即停；不再声称 ≤2pp 等价。
- 300/组下不宣称 organic/invite/duo 分层结论；source 只做诊断记录。

## 5. 指标

### 实验主指标

**`test_complete → login_success`**：同一 session 内，完成测试后发生登录成功的比例。各臂分母同一事件，可比较。

### 诊断指标

- `results_view → login_success`（仅诊断，不跨臂比较——两臂 results_view 时点不同）
- `results_view → discover_enter`
- `login_cancel`
- handoff 展示 → 登录成功时长

### 商业验收（14 天，不用 7 天）

- **每场实收**（单场票实收 / 局）
- **报名 → 成行率**
- **退款率**

`login_success` 不是钱；报名虚高会转化为退款和场地成本。

## 6. 护栏（任一触发即停）

- `test_complete → results_view` 降幅 **>5pp**
- 取消登录后结果不可完整阅读 / 匿名答案不可恢复
- 邀请归因断裂：邀请人排桌成功后拿不到 ¥50
- Duo 第二人卡在测试前，配对失败或整组顺延
- 退款率上升，或报名→成行率下降超过预登记阈值
- 结果页 p75 超过**绝对阈值**（不用 A/B 臂间差值）

## 7. 取消与信任

B 下 `login_cancel` 不是中性事件——用户在没看到完整报酬前取消。

硬要求：

- 取消后，结果页完整可读；
- 匿名答案可恢复；
- 取消后继续浏览作为护栏，不作为成功指标；
- 不得出现「取消即丢失结果」的死路。

## 8. 归因前置（Blocker）

上线前必须完成：

- [ ] `pendingReferralCode` 在**入口处**持久化（landing / deep link / scene），不再只在登录时写入。
- [ ] 返回、切页、重新进入不丢归因。
- [ ] 邀请码在报名时仍能消费，邀请人 ¥50 奖励不受影响。
- [ ] Duo 绑定与配对不受登录时机影响。
- [ ] 服务端 `nextStep` 仍是唯一权威。

**未完成此项，实验不得上线。**

## 9. 埋点

复用 `onboardingAnalytics`，新增/扩展：

| 事件 | 关键字段 |
| --- | --- |
| `login_handoff_shown` | variant, stage(`first_result_before_reveal` / `after_reveal`), resultStage |
| `login_handoff_dismissed` | variant, stage, reason |
| `login_success` | variant, source, stage |
| `results_reveal_first_screen` | variant, timestamp, resultStage |
| `login_cancel_then_continue` | variant, resultsReadable, continueDelayMs |
| `result_page_performance` | variant, p75ReadyMs |

所有事件带 `experimentVariant`、`anonymousId` / `pairId`、source；无 PII。

## 10. 实现边界

- Flag：`onboardingLoginTimingExperiment`，默认 off，admin toggle + kill switch。
- 只改客户端 handoff 时机；不改 auth / nextStep 契约；不改支付；不新增 runtime LLM。
- 先 5% canary 24 小时，确认无崩溃 / 归因异常，再 50/50。
- A 的 FinalStage 行为保持可回滚。

## 11. 决策规则

- **7 天**：只看分流平衡、事件完整性、护栏；不做上线决定。
- **14 天**：读商业验收（每场实收 / 成行 / 退款）。
- B 转正条件：H2a ≥8% + H2b 全部成立 + 归因 / Duo / 退款护栏无异常。
- 否则回 A。
- 300/组时只做方向判断，不宣布等价。

## 12. 审批项

1. 允许 B 在首屏结果后、reveal 完成前出登录（不是结果前登录墙）。
2. 接受 7 天只看稳定性、14 天看商业结论。
3. 把报名→成行、退款率、邀请归因、Duo 配对列为硬护栏。
4. 样本方案：**1000/组**（本次已确认）。
5. `pendingReferralCode` 入口持久化为上线前置。

## 13. Out of scope

- C 变体（结果前登录墙）。
- auth / nextStep 契约改动。
- 支付、权益、退款逻辑改动。
- runtime LLM / 推荐逻辑改动。
- landing 主视觉与 onboarding 其他步骤的文案重写。

## 14. 指标定义附录

- `test_complete`：测试最后一题提交成功，且结果页进入加载/揭晓流程。
- `login_success`：微信登录完成、session 建立。
- `results_view`：结果页首屏实际渲染（不是 loading）。
- `报名 → 成行率`：完成报名的人数中，最终达到成行条件（≥4 人且场地确认）的比例。
- `每场实收`：单场票实收金额 / 已成行局数。
- `退款率`：退款成功笔数 / 支付成功笔数。
