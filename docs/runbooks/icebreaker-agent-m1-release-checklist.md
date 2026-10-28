# 悦仔破冰 Agent M1 发布检查单

> 范围：`icebreakerAgentCopilotEnabled` 默认 ON 的 bounded warmup copilot。本文是发布操作清单，不是内容质量证明。

## 0. 当前本地状态（2026-10-26）

- [x] M1 闭环代码与测试完成，flag 默认 ON。
- [x] `apps/server/migrations/0099_social_agent_events.sql` 已在本地 dev DB **连续执行两次**，`to_regclass('public.social_agent_events')` 返回 `social_agent_events`。
- [ ] staging / production 未由本清单代为执行；必须按部署流程单独应用并记录。
- [ ] 真机、微信备案/提审、Stage A、DQS 真人盲评尚未形成发布证据。

## 1. 数据库与配置

- [ ] staging 执行 `0099_social_agent_events.sql` 两次并确认表、部分唯一索引、CHECK 约束存在。
- [ ] production 在部署前手动执行同一 SQL；CI/CD 不会自动跑 DDL。
- [ ] 核对生产 `feature_flags`：`icebreakerAgentCopilotEnabled` 与「默认 ON」发布决定一致；DB 行优先于代码默认值。
- [ ] 明确 kill switch 操作人：异常时将 DB flag 置 false；确认 participant 无 `xiaoyueAgent`、host 回到旧手动建议路径。
- [ ] 确认 retention scheduler 已启动，90 天删除任务有日志；无跨 session episode 读取路由。

## 2. 真机矩阵（必须实际设备/开发者工具证据）

至少 iOS + Android 微信真机各一台，加一台小屏 Android：

- [ ] host 首次 warmup、pending Ask、采纳、忽略、连续两次忽略、关闭与 `⋯` 重开。
- [ ] 0/4/6s：成功、明确失败、未知、弱网、离线恢复；重复点击/重试不重复 deck。
- [ ] rejoin、后台回前台、host 转移、phase 切换、410：Ask 不复活、不重复 shown、不重复 haptic。
- [ ] participant 无 Ask/成本字段/触感，只见 360ms 静默 crossfade；整组换题仍 index 0 也能识别。
- [ ] reduced-motion、低性能档、无动画降级；无布局推挤、无页滚动、CTA 不遮挡。
- [ ] AIGC：Ask 为策展文案无角标；实际 AI deck 按 per-item meta 显示；fallback 不显示。
- [ ] `npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program` 通过；无页面不可见 `sub-common.wxss`。

## 3. 微信与合规

- [ ] 生成式 AI 备案与协议更新完成；当前提审姿态与真实 Agent 能力一致。
- [ ] 提审构建若需关闭生成式能力，使用明确的环境/DB 配置并记录，不以「代码默认 ON」替代审核判断。
- [ ] 公众文案不含「首个/行业第一/读情绪/匹配/社交/灵魂/撮合」；投资者口径另行法务审核。
- [ ] 无个人社交表现档案、无对话原文/语音采集、无 participant 监控展示。

## 4. 证据门（按顺序）

1. **Gate A — M1 timing**：桌级 agent on/off，同 generator/prompt；A/A 或 shadow 先校验分配与曝光日志。有效性采用 power-aware 桌数/曝光预算（α=.05、power=.80、ICC/设计效应），不使用固定 100 Ask 门槛。
2. **离线 DQS**：`docs/design/icebreaker-content-quality-evaluation-20261026.md` 全部硬门槛、preregistration、≥3 raters、α/ICC≥.60、DQS/偏好 CI 与工程护栏同时通过；否则 FAIL 或 INCONCLUSIVE。
3. **Gate B — 离线内容消融**：current N=1 → context-enriched N=1 → same-context N=2；后一级必须打败前一级，才允许 live。
4. **Gate C — 桌级 content-only 实验**：冻结初始 deck/policy/Ask/UI/价格，仅首次 accepted rotation 变体，ITT 含全部 fallback。

## 5. 指标与停止线

- 主指标：参与者级 **30 天再次付费到场**（D1–D30，含权益/credit，排除 staff/bots/test/refunded/unattended）。
- 辅助：host 认可有效介入率、Ask 采纳、host 关闭、执行失败、fallback、成本与延迟。
- Guardrail：尴尬反馈增幅 ≤2pp、phase completion 降幅 ≤2pp、投诉 <2%、P0 事故 0、AIGC 漏标 0。
- 任一 P0 或成本/延迟越界：立即 kill switch，回退手动建议；不得用内容实验数据为继续发布辩护。

## 6. 回滚后核查

- [ ] flag OFF 后无新 Ask、无候选写入、无恢复快照写入；旧 session 正常 poll。
- [ ] participant 与 host 均回到既有体验；既有 committed deck 不回滚、不丢 ready。
- [ ] episode 仅作 90 天事实留存，不用于 runtime 跨场记忆；事故与回滚写入运营日志。
