# 场地专属优惠 · 设计稿 v2 / 同桌凭证 v2.3

> 仅设计稿，未改动任何产品代码。稿内店名、日期、价格均为示意，非真实合作条款。
> **设计评审：v2 主体 APPROVE；同桌凭证（到店出示页）v2.2 APPROVE → v2.3 简洁高级稿 APPROVE。** 评审方：`uiux-design-reviewer`。
> **实现方案：`implementation-plan.md`**（数据模型 + 后台录入 + S0–S6 切片顺序，Tier 2，动手前先过 Sprint Contract）。

## 文件

- `index.html` — 自包含设计说明 + 规范（7 节）
- `shots/*.png` — 9 张渲染图（375 逻辑宽，DSF2）
- `venue-deal-design.pdf` — A4 打印版
- `redeem-ceremony.html` — **到店出示页「同桌凭证」v2.3 简洁高级稿**（5 节，含动效分镜与评审记录）
- `archive/redeem-ceremony-v2.2-approved.html` — 已批准的 v2.2 存档，仅供对照
- `shots-ceremony/*.png` — 4 张渲染图：暗号凭证 / 套餐凭证 / 已复制 / 动效分镜
- `redeem-ceremony.pdf` — A4 打印版
- `implementation-plan.md` — 实现方案（本目录唯一工程入口）

重新渲染（仓库根目录，playwright 只装在根 node_modules）：

```bash
node render-venue-deal-design-tmp.mjs      # 9 图 + venue-deal-design.pdf
node render-venue-deal-ceremony-tmp.mjs    # 4 图 + redeem-ceremony.pdf
```

脚本遍历 HTML 中所有 `.shot[data-shot]`，输出 PNG 并生成 PDF。

## 同桌凭证（出示页）的仪式感和边界

深紫舞台（**全产品唯一例外页**）+ 单色纸面凭证 + 单环印章；暗号 92rpx 是第一焦点，折扣退为凭证上的权益行。仪式感只来自真实数据：店名、活动时间、6 人桌、同桌 6/6 已确认、暗号、印章。

**v2.3 减法（产品方向：精美、简洁、大气、高级）**：删内层描边、虚线牌匾盒、印章旋转与英文行、eyebrow 与副标题、底部珊瑚光；纸面单色，暗号区只留上下两根细线。全页四层信息：店名与时间 → 暗号 → 权益 → 一条规则。

- 不用「会员 / VIP」措辞，身份来自「这一桌」而不是付费等级。
- 印章只记录真实动作：复制后 =「暗号已复制」，**不写已出示 / 已使用 / 已核销**（本期无核销端）。
- 套餐版没有按钮：页面本身就是出示动作，只放静态说明。
- 不展示序列号与桌号（无门店核验动作，避免伪正式感）。
- 动效 ≤240ms、仅 transform/opacity、落章一次轻触觉、reduce-motion 直接终帧；进入提亮 + 常亮，退出恢复，失败静默。

## v2 的核心决策

**两种权益，一条规则。**

| 形态 | 用户看到 | 门店动作 |
|---|---|---|
| 统一折扣 | 悦聚同桌 8 折 · 无门槛 · 全单通用 | 结账直接打折 |
| 定制套餐 | 悦聚专属 6 人餐 ¥598（划线原价 ¥758）· 内容一句 | 按套餐出餐 |

唯一规则：**仅限本场活动 · 本桌使用**（客户端固定文案）。

从用户面删除：`min_spend`、`max_discount`、`per_person_limit`、`valid_from/until`、`excluded_dates`、`terms` 折叠层、`qr_code`、`fixed` 立减。后台字段保留兼容，录入端隐藏。一场只给一个权益，不堆叠。

## 两个触点

1. **报名页「费用包含」第 5 格**（`pool-registration` Step 0）：3+2 栅格，优惠格横跨两列；格子讲价值，teaser 讲兑现，价格下一行「订座费不含餐费，餐费到店与门店另结」。
2. **场地分配后「本场专属」卡**（`pool-group-detail` 地点信息卡正下方，复用到 `event-detail` / 集结房间）：左值右文票券，点整卡进入出示页；出示页采用 `redeem-ceremony.html` 的「同桌凭证」，暗号是第一焦点，折扣退为权益行。

## 上线前置（不阻塞视觉定稿）

- 池级保底权益（如 `event_pools.guaranteed_deal_id`），否则触点 1 不上；`hasVenueDealPotential` 不足以托底。
- `venue_deals` 需新增 `discountType='set_menu'` + 套餐价/原价（分），录入端用卡面实时预览，折扣限 1–90 整数（20 = 8 折），详见 `implementation-plan.md` §1.1 / §2.1。
- 「独家」仅在真实独家合作时由后台字段切换，默认「专属优惠」。
- 含酒套餐不得分配给无酒精池（准入条件，不是后台提醒）。
- 权益被停用/换场时的替代与补偿口径，需商业条款定义。

## 评审记录

- v1：`uiux-design-reviewer` 判 fix-then-ship，3 项 P0 + 3 组 P1。
- v2 首评：剩 3 项色彩/状态语义（划线原价对比度、B0 锁定态暖灰 token、E2 失败卡绿色成功点），已全部修复，处置见 `index.html` §7。
- **v2 复审：APPROVE。**
- 同桌凭证 v2.1 首评：fix-then-ship（虚假出示状态、C2 无动作按钮、低对比小字与冗余编号）。
- **同桌凭证 v2.2 复审：APPROVE**，处置见 `redeem-ceremony.html` §5。
- **同桌凭证 v2.3（简洁高级稿）复审：APPROVE**，无稿面阻塞项；单色纸面上 `#6B6357` ≈5.46:1、`#7A5A44` ≈5.74:1；C2 留白继续保持，不补回装饰。

## 实现期 ship gate（设计批准不替代这些）

- A1 需在真实 Step 0 壳内（普通屏 + 短屏）重渲：现有 `PoolRegistrationInclusions` 是固定单排四格且短屏整段隐藏，优惠格 / teaser / 费用边界不得随之消失，订座 CTA 不得被挤压。
- E2 重试与出示页关闭按钮命中区域 ≥88rpx；pressed / copied / failed 真实状态集。
- 优惠面值 76rpx、出示页 92rpx/152rpx 属组件级 display token，须登记且不扩散为全局字阶。
- 票券图标需正式 Lovart WebP + 本地/CDN 资产登记；同桌凭证页本身纯 CSS，无新增图片。
- 深色页店内照明真机可读性；iOS/Android 微信提亮、常亮与退出恢复；低端 Android 掉帧即关动画。
- 长店名 / 长套餐名 / 暗号缺失时不伪造内容；含酒套餐不分配给无酒精池。
