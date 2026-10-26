# 「我的」满分冲刺 — 统一执行收敛 (2026-10-23)

> 统一 📋 PM 满分计划 与 🏦 商业化计划 的可执行收敛。两份原始文档不变：
> - 📋 `docs/deliberations/2026-10-23-profile-full-marks-pm-plan.md`
> - 🏦 `docs/deliberations/2026-10-23-profile-full-marks-commercialization-plan.md`
>
> 本文档只回答一件事：**接下来做什么、被什么门卡住、谁签字。**

## 1. 当前状态

| 波次 | 内容 | 状态 |
|---|---|---|
| (a) 词汇一致化 | 氛围 vocab + greeting 池 3→5 | ✅ `afa554c70` |
| Wave A | 11 个纯客户端密度动作 | ✅ `48bc68e2e`（306 测试 ✓ 全门禁 ✓） |
| Wave B | A5-4 每周经验值小结（服务端） | ⛔ D-2 数据门 |
| Wave C | A4-1 徽章艺术（Lovart Batch-D2）+ A6-3 海报 v2 | ⛔ D-4 数据门 + 外部资产 |
| Wave D | A3-1 F3 真机渲染矩阵 | ⛔ 人工门 |
| 🏦 续费轨道 | 复活 pill + 价值回执 + 经济链 | ⛔ 3 个暗旗 + PM §1c 签字 |

重审计（第三次）在 Wave A 后运行中；基线 19/24。

## 2. 决策登记簿

| # | 决策 | 推荐 | 门 | 签字方 |
|---|---|---|---|---|
| D-1 | Greeting 池 5→7（84 行总量） | YES | 品牌审查（语气一致 + 无违禁词） | 品牌 |
| D-2 | A5-4 每周 XP 小结 | 先做 p50 查询 | 若每周 XP p50 < 50，则信息无意义 → 砍掉 | 数据（一条 SQL） |
| D-4 | 徽章艺术阈值 | 先查 live `eventsJoined` p95 | p95 < 12 ⇒ 第 5 档 20场→15场 再约稿（艺术不可逆） | 数据 + PM |
| 🏦-1 | 死代码删除：`checkExpiredSubscriptions` 扫描器（`subscriptionService.ts:33`，零调用点） | 删除 | 无 — 删除候选已确认 | 工程 |
| 🏦-2 | 复活 pill（过期后 7 天内 「悦聚卡已到期 · 点击续上」） | 做，暗旗 | **从未付费用户结构上看不到**（PM §1c 修订） | PM |
| 🏦-3 | 价值回执（「已为你省下 ¥430」锚定 ¥88 单场） | 做，暗旗 | 文案 🔴 规则（非诱导、非促销语） | 品牌 |
| 🏦-4 | 季卡 ¥294 = 3× ¥98 零折扣 | 单独 Tier-3 定价审议 | 唯一合规框架 = 「更省心」徽章，不碰价格话术 | 🏦 专项 |
| 🏦-5 | `renewal_30d_rate` 基线 | 先埋点 4 周 | 无基线不谈 uplift（Adapty 2026 首续 30.3–58.1% 作参照带） | 数据 |

## 3. 执行序列（解锁顺序）

```
现在          D-2 SQL (p50)          D-4 SQL (p95)            品牌审查 D-1
  │               │                      │                       │
  ▼               ▼                      ▼                       ▼
Wave B ◀── p50≥50?          Lovart 约稿 ◀── 定档 15/20     greeting 5→7
(服务端 XP 小结)              (Batch-D2)                       (内容扩展)
  │                                │
  ▼                                ▼
🏦 复活 pill + 价值回执        Wave C 接入艺术
(3 暗旗, PM §1c 签字后)              │
                              A6-3 海报 v2
                                   │
                                   ▼
                          Wave D F3 人工渲染矩阵
                                   │
                                   ▼
                          终审计 → 目标 24/24 持续
```

## 4. 硬约束（所有后续工作继承）

- 文案 🔴：无 匹配/社交/灵魂/AI/会员/VIP；悦聚卡 family 名固定；续费文案非诱导
- WXSS：无 min/max/clamp/hsla；动效仅 transform+opacity；RM + 降级档静态
- 进场预算 ≤600ms（Wave A 已锁在 600）；一幕一问（quest 在则无 bio nudge）
- 所有 🏦 面：3 个暗旗上线，默认 OFF，逐一开
- 徽章艺术：p95 查询结果决定第 5 档阈值后才可约稿

## 5. 已接受的偏差（Wave A 实施期）

- A5-1 文案从 PM 的 15 字「本周再参加 1 场，连击续到 N+1 周」缩为 12 字「本周再 1 场，连击续到 N 周」——胶囊 ~232rpx 装不下 15 字；语义不变
- A5-2 行无进出场动画——它随迟到的报名数据出现，动画即闪烁；P2-1 的 600ms 预算不破
- 海报 glow 在降级档只去动画（静态金边保留），非整体移除

*收敛人：主会话。下一步建议：先跑 D-2/D-4 两条 SQL（一条命令的事），它们同时解锁 Wave B 与 Wave C。*

---

## Addendum 2026-10-23 — D-2/D-4 dev-DB gate run

- **D-2:** dev `xp_transactions` empty (0/128 users) → undecidable locally; ledger writes confirmed live (gamificationService ×4). Awaiting staging/prod read-only run. A5-4 stays quarantined per PM plan §181.
- **D-4:** dev p95 = 1 (both variants), max 12–16; if prod p95 < 12 → tier-5 = 15场 (pre-agreed rule). Sub-finding: shell eventsJoined formula (pending|matched only) may under-count post-completion-sweep when no attendance row exists — semantics decision deferred to PM, prod data first.

---

## Addendum 2026-10-26 — gates resolved, advisors converged, Waves B–D closed (Wave D = human only)

**Gate runs (read-only, ops-gate-query.yml):** staging 40292189004 ✓ / production 40292322386 ✓. Prod = 9 users, zero event history; `xp_transactions` EMPTY. Staging = 117 users, 1 XP row ever, D-4 p95=2. **Advisor inputs (user-mandated):** PM + UIUX + 🏦 memos at `2026-10-26-profile-waves-bcd-{pm,uiux,commercialization}-inputs.md`. Two PM memos were produced (restart relaunch); adjudication below is final.

1. **Wave B (A5-4 weekly-XP pulse): CLOSED — DELETED, NO-BUILD.** D-2 p50≈0 → PM quarantine fires. No +0/placeholder/substitute/backfill. Reopen only as a NEW requirement after economy fix + 4 consecutive ISO weeks real accrual + eligible-active p50 ≥ 50. A6-4 weekly-recap sharing also NOT BUILT (dependency gone). This supersedes A5-4 in the execution sequence/critical path above.
2. **Tier-5 城市传说 = 15场 — FINAL (commit f6db9b15c).** Advisor vote 3:1 (UIUX + relaunch-PM + 🏦 for 15; original PM keep-20 dissent = empty-cohort non-informativeness). Deciding factor: 🏦's never-raise commitment removes the asymmetric-ownership objection. **15 is permanent — never raise 15→20; later cohort evidence may only ADD a new higher honour.** `legend20` key/label/asset kept (seen-badge ledger safety); proximity now 12/13/14 → 再3/2/1场, 15+ → 5/5. D-4 classified NOT EVALUABLE — EMPTY COHORT (not a data pass).
3. **A6-3 poster v2: NO-GO this cycle.** Reopen only on named post-launch evidence that poster *content* blocks sharing; if reopened, smallest scope = one factual 「已点亮 N 枚徽章」 line (N>0) + UIUX craft bar (hero 420–440px, achievement signature, anchored QR white plate, measured name). NO new art/animation/private fields.
4. **Wave D = the only remaining full-marks gate (human).** Authoritative checklist = original PM memo R1–R10 (D320/D375/D414/iOS/Android on one frozen PR #649 head SHA; R8 native poster real devices + 2nd-phone QR scan; R9 RM; R10 degradation; evidence `<sha>_<device>_<row>` attached to PR; any overlap/clipping/wrong route/privacy/QR/banned-copy = blocking). Relaunch-PM 1–2h timebox = guidance. UIUX additions: badge-count 12/14/15 fixtures, long-displayName poster case, native font cold-load (Alimama/Quicksand), light/dark parity.
5. **D-1 greeting 5→7: CLOSED — DEFERRED for PR #649** (24/24 re-audit already rates it optional).
6. **XP-economy truth = separate launch-truth workstream (NOT this plan, NOT a PR #649 blocker).** 🏦 P0 commercial diagnostic, ≤0.5 person-day read-only (backend-engineer + PM): reconcile the 9 prod users' eligible actions vs XP ledger/balances + logs; source facts: no master XP env flag; registration route logs "Awarded" without checking AwardResult.success; `updateActivityStreak` has no callers. Escalate to engineering P0 write-incident if any qualifying action lacks a ledger row; no auto-backfill. Unverified at public launch → separate suppress/copy decision on earning promises.
7. **Renewal/value-receipt track: no build now.** 🏦 NO-GO visibility; dark implementation requires PM §1c sign-off (never-paid structurally hidden; 14-day default vs 7-day conflict PM resolves) + flags `profileRenewalStatesEnabled`/`subscriptionRenewalRemindersEnabled`/`profileValueReceiptEnabled` all default OFF. eventsJoined pending+matched must never be shown as 已用.
8. **UIUX residual craft fixes shipped (commit 100741c96):** R1 no-QR poster copy honesty, R2 measured code-point-safe displayName ellipsis, R4 degradation static gold rim restored, R5 opacity-only glow + RM static pose. 160/160 tests, typecheck, guardrails green.
9. **eventsJoined formula note (carried from 10-23):** shell formula (pending|matched) vs completed-inclusive semantics stays UNCHANGED; the D-4 re-check, when run on a mature cohort, must use the formula that actually drives badge progress and reconcile A/B divergence first.
