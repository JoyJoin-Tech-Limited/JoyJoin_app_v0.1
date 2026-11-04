# 审计评分基线（score baseline）

规则：没有落盘基线的"分数不下降"一律视为未验收（审计报告 §8.1-E）。
评分必须同口径复测：同一评审人/同一 skill 版本/同一批页面/改动前后各一次。

## P1-1 增量 1（pool-registration 已加入终态）

评审口径：`multimodal-looker` 独立查看 BEFORE/AFTER 的 solo-390、solo-320、duo-375、duo-320，主代理复核全部六组与扫描 JSON；日期 2026-11-02。同一批静态 H5 证据、同一 rubric，前后各评一次。

| 审计 | 改动前分数 | 改动后分数 | 评审人 | 日期 | 证据链接 |
|---|---|---|---|---|---|
| ui-layout-audit | **78/100** | **82/100** | multimodal-looker + 主代理 | 2026-11-02 | [390 BEFORE](screenshots/before/subtraction-pool-reg-joined-solo-390x844.png) / [390 AFTER](screenshots/after/subtraction-pool-reg-joined-solo-390x844.png)；[320 BEFORE](screenshots/before/subtraction-pool-reg-joined-solo-320x568.png) / [320 AFTER](screenshots/after/subtraction-pool-reg-joined-solo-320x568.png) |
| frontend-design-audit | **13/20** | **13/20** | 同上 | 2026-11-02 | 同上 + [duo 375 BEFORE](screenshots/before/subtraction-pool-reg-joined-duo-375x667.png) / [duo 375 AFTER](screenshots/after/subtraction-pool-reg-joined-duo-375x667.png) |
| user-satisfaction-audit | **18/24** | **20/24** | 同上，Persona C 被邀请的客人 | 2026-11-02 | 同上 |

分明细：

| 审计维度 | BEFORE → AFTER | 证据 |
|---|---|---|
| ui-layout 总体 | 78 → 82 | 删除在 320 下占三行的重复灰字后，标题 → 卡片 → CTA 的阅读路径更短；mascot 裁切与 320 标题换行仍限制上限 |
| frontend：Brand / State / Tokens / Responsive / Motion | 3→3 / 4→4 / 3→3 / 2→2 / 1→1 | 品牌元素与 duo 变体不变；无新增渲染 token 问题；小屏既有问题不变；Motion 只有 reduced-motion 静态图 |
| user：秒懂 / 顺滑 / 干净 / 心动 / 想念 / 炫耀 | 3→4 / 4→4 / 3→4 / 3→3 / 3→3 / 2→2 | 单一 CTA 更突出；不再重复阅读同一等待事实；通用长句不构成个性化情绪价值；分享与付费动因未改变 |

Grill-me 摘要：BEFORE 的 ui-layout <80 是因为重复段落在小屏形成三行灰字墙；AFTER 的「秒懂/干净」4 分只指**单一主张与信息降噪**，不是给既有 mascot 裁切或倒计时密度打满分。Responsive 2、Motion 1 是既有/证据限制，不是本次新增回归。

口径限制：frontend 的 State 仅指当前 terminal 成功态与 duo 变体，不代表全页八态验收；Motion=1 表示**没有动态/真机证据**，不是已测得 jank。评分不能替代 WeChat DevTools 与真机。

结论：**静态 H5 口径无新增 Class A、无分数下降；本增量仍未通过真机验收。** 已通过的工程门：vitest 16 文件 / 108 用例、tsc、guardrails、build + subpackage styles。

用户 verdict（AFTER）：不主动分享（私密报名确认）；会回来（待办局 + 倒计时 + 查看我的局）；不会仅凭此屏推荐；不会因此屏付费。

## P1-1 增量 2（已加入终态的满分目标迭代）

评审口径：最终复测由同一 `multimodal-looker` 会话连续审阅当前代码、五个代表渲染与三视口扫描 JSON；Persona B 回流用户。静态 H5 证据，日期 2026-11-02。

| 审计 | 最初基线 | 最终静态复测 | 结论 |
|---|---:|---:|---|
| ui-layout-audit | 78/100 | **100/100** | 静态布局目标达成；三视口扫描均 0 findings |
| frontend-design-audit | 13/20 | **19/20** | Brand / State / Tokens / Responsive 均 4/4；Motion 3/4 待动态与真机 |
| user-satisfaction-audit | 18/24 | **21/24** | 秒懂/顺滑/干净/回访均 4/4；情绪 3/4、分享 2/4 是私密回执的合理边界 |

最终复测证据：`screenshots/after/subtraction-pool-reg-joined-*.png` 与 `visual-scan/fullmarks-after-solo-*.json`（390×844 / 375×667 / 320×568 全部 PASS，blocking 0、advisory 0）。

不能诚实宣称满分的原因：Frontend Motion 需要真机/动态证据；当前屏是私密、克制的报名回执，不应为凑 Satisfaction 24/24 而新增分享流程或庆祝功能。真机清单见 `device-matrix.md`。

## P1-2 / P1-3
未开始，无基线。
