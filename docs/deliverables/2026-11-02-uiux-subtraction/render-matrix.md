# P1 渲染基线与改动对照（render matrix）

状态口径：`未测` = 尚未采集；`已采集` = 文件存在于 `screenshots/` 且命名含视口。
视口：390×844 / 375×667 / 320×568（沿用 `scripts/screenshot/generators-event-detail.mjs` 先例）。

## P1-1 等待叙事

### 增量 1（BEFORE/AFTER、视觉扫描与三项审计已采集；真机仍未测）
改动：`PoolRegistrationAlreadyJoined` 删除与 `EventSummaryCard status='registered'` 重复的等待长句。
事实归属：标题 = 已加入；卡片 = 报名成功，等待排桌；双人成行行保留。

| 页面 / 状态 | 改动前 390 | 改动前 375 | 改动前 320 | 改动后 390 | 改动后 375 | 改动后 320 |
|---|---|---|---|---|---|---|
| pool-registration / 已加入（无双人） | [BEFORE](screenshots/before/subtraction-pool-reg-joined-solo-390x844.png) | [BEFORE](screenshots/before/subtraction-pool-reg-joined-solo-375x667.png) | [BEFORE](screenshots/before/subtraction-pool-reg-joined-solo-320x568.png) | [AFTER](screenshots/after/subtraction-pool-reg-joined-solo-390x844.png) | [AFTER](screenshots/after/subtraction-pool-reg-joined-solo-375x667.png) | [AFTER](screenshots/after/subtraction-pool-reg-joined-solo-320x568.png) |
| pool-registration / 已加入（含双人成行） | [BEFORE](screenshots/before/subtraction-pool-reg-joined-duo-390x844.png) | [BEFORE](screenshots/before/subtraction-pool-reg-joined-duo-375x667.png) | [BEFORE](screenshots/before/subtraction-pool-reg-joined-duo-320x568.png) | [AFTER](screenshots/after/subtraction-pool-reg-joined-duo-390x844.png) | [AFTER](screenshots/after/subtraction-pool-reg-joined-duo-375x667.png) | [AFTER](screenshots/after/subtraction-pool-reg-joined-duo-320x568.png) |

生成器：`scripts/screenshot/generators-subtraction-pool-registration.mjs`；AFTER 命令：`npm run screenshot:subtraction-pool-reg-joined -- --once`。BEFORE 在 HEAD `3401aefdc` 的独立 clean worktree 构建 H5，并用同一生成器的 `SUBTRACTION_BEFORE=1` 模式采集；未回改当前工作树。
12 张 BEFORE/AFTER 均由硬断言通过后落盘：各版本的长句存在性符合预期；标题与「报名成功，等待排桌」保留；主 CTA「查看我的局」无需滚动完整可见；duo 行存在且无横向/纵向裁切；solo 不出现 duo 行。像素 diff 在 `screenshots/diff/`，大面积差异来自删除段落后的正常垂直重排与倒计时数字变化，不能单独作为回归判定。

人工与 `multimodal-looker` 对照 solo/duo 的多视口截图：**无新增 Class A 缺陷**。mascot 半圆裁切、320 下活动标题换行、倒计时区域密度在 BEFORE 已存在，不归因于本改动，本增量不顺便改样式。

自动视觉扫描：solo BEFORE/AFTER × 三视口均为 `PASS`、0 blocking（`visual-scan/before-solo-*`、`visual-scan/pool-reg-joined-after-*`、`visual-scan/after-solo-*`）。AFTER 390 有一条品牌紫 CTA 白字 4.23:1 advisory；BEFORE 同一样式扫描未报该 advisory，且本次未改颜色/按钮，因此只记录为扫描采样差异，不归因、不改样式。duo 由生成器硬断言与人工对照覆盖，未声称独立 scanner 覆盖。

### 增量 2（满分目标迭代；静态扫描已清零，真机仍未测）

在保留增量 1 删除结果的前提下，终态进一步收敛为：完整 mascot + 暖标题「这一局，有你的位置了」、单个纯白事实卡、无重复成功 pill、无装饰倒计时、扁平 CTA；长双人名内联省略，活动标题仅在地区后缀与 meta 完全重复时去除后缀。未改共享 `EventSummaryCard`，未新增页面/组件/flag/API/分享流程。

- 生成器扩为 8 张：solo / duo × 三视口 + 长标题 320 + 长双人名 320，全部硬断言通过。
- 最终 solo 三视口视觉扫描：`visual-scan/fullmarks-after-solo-*.json` 全部 **PASS，0 blocking、0 advisory**。
- 独立复测：ui-layout **100/100**；frontend-design **19/20**（Motion 3/4 待动态/真机）；user-satisfaction **21/24**（私密回执的情绪与分享边界，不能靠加功能凑分）。
- 因此静态 Class A 与可见布局缺陷已清零，但满分合同尚未全部满足，真机/动态验收仍开放。

### 尚未执行的等待面（P1-1 未完）
| 表面 | 处理 | 原因 |
|---|---|---|
| event-ticket-payment 支付成功副标题（matching / 非 matching 两变体） | 保留 | 语义变体，且属支付面 |
| payment-verification「权益确认中」 | 保留 | 支付禁区 |
| `PoolRegistrationSuccessCeremony` 订阅消息授权文案 | 保留 | 通知/合规 |
| tab-bar「排桌中…」、`VacatedSeatCard`、profile 任务提示、gathering-room（暗置） | 保留 | 各自是不同事实 |

## P1-2 成员三层
未开始。

## P1-3 报名 9→6
未开始。
