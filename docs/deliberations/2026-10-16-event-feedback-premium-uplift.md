# Event-Feedback 全流程 精致度/高级感/简洁大气 uplift 20 条

> 2026-10-16 · 三专家合议收敛（商业化 C / UIUX U / PM P 三路并行审计，素材 = 8 张设备级截图 + `pages/event-feedback/index.tsx` + `index.scss` 全文）
> 范围：experience → connections → wechat（新）→ wrapup → revealed（含 C 补救卡）
> 硬约束：完成率降 >3pp 回滚 · 零 emoji on primary copy · 禁词（匹配/社交/撮合/灵魂/AI）· 实心 `#8B5CF6` CTA · 8rpx 节奏 · RM-gated 动效 · System UI tone（PII 信任面）
> **用户锁定方向：mascot 图形不得在流程内重复出现**（item 1 即其落地方案；三方一致判定 ArchetypeHead/RatingFace 属「身份语法/输入控件」，非 mascot，保留）

## 20 条清单

| # | 屏 | 条目 | 关键改法 | 工作量 | 来源 |
|---|---|---|---|---|---|
| 1 | 全局 | **吉祥物归一** | revealed 删 `__success-hero`（360rpx 场景图）留单 mascot 徽章 240rpx + 迁入场动画；loading gate 加 `hideMascot` 换 BrandLogo + >800ms 骨架淡入；`CEREMONY_HEROES.eventFeedbackThanks` registry key 退役（全仓仅此一处引用） | M | U-1+C-1+P-8+C-9 |
| 2 | 全局 | **进度点契约修复** | 分母挂在访问内稳定资格（`wechatCollectionEnabled && !wechatContactId`），不再随选人中途 3→4 突变；拆 `--done`（16rpx 实心）与 `--active`（32rpx 胶囊），修末步「当前位置」失明 | S | U-2+U-3 |
| 3 | experience | **温度计灯格骑轨** | 轨道 absolute 后置穿过点心（top:38rpx），未选点改 surface 底+2rpx 描边做「站点」；选中刻度词转品牌紫加粗 | M | U-4+C-8 |
| 4 | experience | **连接雷达可读性** | label/hint 改上下堆叠消沟；未点亮 dot 提到 border 色阶；选中才显示刻度文案 | S | C-7+P-2 |
| 5 | experience | **渐进披露展开器** | 雷达/场地印象/散场状态收进「再多说两句」（默认收起，展开触发现有 `feedback_deep_engaged`）；首屏只留表情+温度计 | M | P-1 |
| 6 | connections+wechat | **死中区垂直居中** | ScrollView 内包 `__scroll-inner`（min-height:100% + 卡 margin auto），消灭两屏各 37–38% 视口空谷；overflow 自动回落顶对齐 | S | U-5 |
| 7 | connections | **互选钩子上移 + CTA 去「跳过」** | 标题下加权益说明条（锁 icon + 现有承诺文案升级）；空选 CTA「跳过，下一步」→ 中性「下一步」 | S | C-2①+P-3 |
| 8 | connections | **选中态仪式感** | 选中卡 2rpx 紫描边 + 轻微上浮（transform-only，RM-gated）；复用 wrapup attended ring 语言；CTA 上方「已选 N 位」计数 chip | S | C-2②+P-5 |
| 9 | connections | **记忆锚点 + 2 列布局** | 卡内补 socialTag + meta（年龄段·性别·行业，同数据源零新接口）；6 人局 3 列→2 列，头像放大 | S–M | P-4 |
| 10 | wechat | **PII 隐私契约块** | 锁 icon + 承诺正文升一档字号/提色阶，set-once 行并入同块两行排版；加 `feedback_wechat_input_focus` telemetry | S | C-3 |
| 11 | wechat | **安抚文案四重奏→一处** | 删 header purpose-hint（与卡内隐私条同义复读）；hint/error 同槽互换（无布局跳动）；💬 图标去 `#C0A17B` tint 偏航 | S | U-6 |
| 12 | wechat | **footer 四层→三层** | skip-hint 并入 skip 条：「暂不填写，结果页还能补」单行，删独立 hint 行；footer 高 250→210px | S | U-7 |
| 13 | wechat | **选人回顾条** | 输入框上方加选中者头像叠放 +「你选了 N 位伙伴，互选成功后 TA 们能看到」——把表单税接续为情感弧 | S | P-6 |
| 14 | wrapup | **改进建议 pill 化** | 7 条全宽长行→紧凑 chip 流（与印象标签同语法）；右侧圆形勾选框（未选空圈/选中紫底白✓）；hint 去口吃（「最多选 3 个」/「还能选 N 个」/满员文案三分支）；省 ~400rpx 滚动 | S | U-8+C-4+P-7+U-9 |
| 15 | revealed | **补救卡文案收口** | 修孤字「及」：「补上后，互选成功的伙伴就能看到你的微信号」（19 字单行因果句）；成功带补 ✓ icon + haptics | S | U-10+C-5③ |
| 16 | revealed | **左缘缝线对齐** | 删 `__matches`/`__success-actions` 的 `padding: 0 $spacing-md`——remedy 卡/match 卡/CTA 统一 40rpx 左缘 | S | U-11 |
| 17 | revealed | **状态诚实三分支 + 死胡同转期待** | 有互选/选了未互中（「你选的人，如果也选了你，连接里第一时间见」）/未选人 三分支文案；「对方尚未设置微信号」→「TA 设置后，连接里就能看到」（可选：接订阅消息授权，复用 recap push 通道） | S（+M 可选授权） | P-9+C-5② |
| 18 | 跨屏 | **印象标签回流连接 tab** | 互选成功后对方所给 Top 1–2 标签聚合展示在连接 tab：「同桌觉得你：温暖·会聊天」——回访钩子 + 反馈完成率正贡献 | M–L（需连接 tab 数据链路） | C-6 |
| 19 | revealed | **互选纪念卡** | 双 CTA 下三级文字入口「存下这一刻」→ canvas 1080×1560（双方原型头+化名+日期+推荐码二维码）；PII 结构性排除（永不烘焙微信号）；零诱导文案 | L（复用 InsightShareEntry 管线 + 隐私评审 + 白名单 +1 事件） | C-10+P-10 |
| 20 | experience | **rating-3-neutral 资产白带** | 第 3 张表情脸近白方底（亮度 242–252 vs 其余 160–230）→ 重导真透明底 + CDN upload；**verify-first**：先设备复核是否 H5 夸大 | S | U-12 |

## 三方共识与分歧

- **全票第一：item 1（吉祥物归一）**——用户锁定方向，且是 revealed 屏其他改动的前置；稀缺曝光 = 情绪溢价（峰终定律），revealed 是唯一 mascot 主场。
- **其余 Top 票**：item 10（PII 契约块，C 选）、item 7（互选钩子，C 选）、item 6（死中区，U 选）、item 3（温度计，U 选）、item 13（选人回顾条，P 选——「旗标一开首读就是最优形态」）。
- **PM 砍单建议**：若范围砍半，第一刀砍 item 4 的刻度瘦身部分（item 5 上线后雷达默认收起，问题被结构性覆盖），第二刀 item 19。

## 落地波次（对齐旗标节奏）

- **Wave 1（旗标开启前，全 client-only，直接服务北极星首读）**：1、13、7、17、10、11、12、15、16、2 —— 全部围绕 wechat 步与 revealed 屏，暗发期改好，开旗即最优形态。
- **Wave 2（旗标开启 2 周、护栏读数干净后）**：6、8、9、3、4、5、14、20 —— 互选屏与体验屏改造，避免与 Wave 1 混淆选择率归因；item 5 会压低 `feedback_deep_engaged`，须在完成率护栏确认无回归后才动。
- **Wave 3（需服务端/新计量/评审）**：18（连接 tab 数据链路）、19（canvas + 白名单事件 + 隐私评审）、17 的可选订阅授权部分。

## 度量锚点（全部现有事件/SQL 可验证，零新埋点除非标注）

- 北极星：互选双端有号率（connections 快照 SQL，spec §8 目标 ≥40%）
- `feedback_wechat_saved / step_shown` ≥50%、skip ≤40%（item 10/11/12/13 的直接读数）
- 选择率 = 提交 payload `connections.length ≥ 1` 占比（item 7/8/9）
- 互选命中率 = mutual / selections（item 9）
- 护栏：反馈完成率降 >3pp → 关旗标回滚（全程）
- item 19 需白名单 +1 事件；item 10 的 input_focus telemetry 为新增埋点（已标注）

## 实施状态（2026-10-16，用户指令「do all」）

按 Batch A→D 顺序由 taro-engineer 实施，全部批次过 typecheck + 页面测试（103/103）+ class-coverage + design:audit；页面测试同步新增契约锁定每条 item。

- **Batch A（item 1, 2, 15, 16, 17）✅ 完成**：mascot 归一（`JoyJoinLoadingScreen` 新增 `hideMascot`/`skeletonDelayMs` props，`CEREMONY_HEROES.eventFeedbackThanks` 退役）；进度点 `dotSteps` 稳定分母 + `--done`/`--active` 拆分；remedy-text 19 字 + `__remedy-success-row`（✓ icon + `haptics('light')`）；revealed 40rpx 左缘；状态诚实三分支 +「TA 设置后，连接里就能看到」（订阅授权部分未做，留 Wave 3）。
- **Batch B（item 6w, 10, 11, 12, 13）✅ 完成**：wechat 步 `__scroll-inner` 垂直居中（recap+card 一组）；隐私契约块（🛡️ `icon-lock` + 双行，`__wechat-setonce` 删除）+ `feedback_wechat_input_focus`（client union + server 白名单双端）；purpose-hint 删除 + hint/error 同槽互斥 + 💬→🔗 `icon-link`（`chem-chat` 的 #C0A17B 为资产烘焙，JoyJoinIcon 无 per-usage override）；footer 三层（「暂不填写，结果页还能补」单行）；选人回顾条（`ParticipantAvatar` 新 `mini` prop，叠放 cap 4 +N）。
- **Batch C（item 3, 4, 5, 6c, 7, 8, 9, 14）✅ 完成**：先强制抽取 `steps/ParticipantAvatar.tsx` / `ConnectionsStep.tsx` / `WrapupStep.tsx`（无 SCSS side-effect），`index.tsx` 1750→1476（gate 1800）。item 4 判断性决策：雷达无独立维度锚点词，复用共享 `ATMOSPHERE_LABELS` + ScaleDots 新 `selectedOnlyLabels`（选中才显刻度词）；item 9 网格无条件 2 列（池上限 6，SCSS 注释锁定）；item 14 勾选为 `__improve-ring` 空圈 ↔ ✅ JoyJoinIcon（`__improve-check` 已删）。
- **item 18（印象标签回流连接 tab）🔄 进行中**：先查 per-attendee 数据链是否存在；不存在则文档化 descope。
- **item 19（互选纪念卡）🔄 进行中**：复用 InsightShareEntry canvas 管线，PII 结构性排除，白名单 +1 事件；推荐码二维码仅在先例管线干净支持时纳入。
- **item 20（rating-3-neutral 白带）✅ 完成**：根因=5 张脸全无 alpha，#3 烘焙底 #F6F6F6 浅灰（其余纯白隐形）；PIL 四角洪水填充改为纯白（本地资产已替换，3568→4536 bytes）；CDN 为固定路径引用，随下次 Upload CDN Assets 工作流覆盖；immutable 缓存下旧设备自然滚动更新（不换名）。

截图验证：`scripts/screenshot/generators-event-feedback.mjs` 已随 A+B+C 更新（删 `setonce`/`skip-hint` 断言、hint/error 互斥断言、large 头像 shim 58px、expander 折叠/展开双捕获、connections-selected 新捕获、remedy 文案断言），待 item 19 落地后重建 H5 全量重截 9 状态。
