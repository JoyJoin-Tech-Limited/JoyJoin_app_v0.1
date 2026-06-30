# Lovart Design Brief: Event Ticket Full-Bleed Footer Vignette

## 项目背景
我们正在重做 JoyJoin 活动报名确认页（event-ticket-payment）的票尾插画。上一版是一个居中、240rpx 宽的小图，用户反馈它「太特意」——像贴在票面上的贴纸，没有和卡片融为一体。需要你把它改成一个**铺满票卡底部、和白色卡面自然过渡**的全宽 footer vignette。

## 平台与用途
- 平台：微信小程序（Taro）
- 用途：event-ticket-payment 页面中白色票卡底部的装饰性 footer
- 渲染尺寸：750 × 280 px（全宽 × 约 37% 卡片高度）
- 文件格式：WebP，每张 ≤ 40 KB
- 命名：
  - `lovart-event-ticket-tail-dining-20260630-v2.webp`
  - `lovart-event-ticket-tail-drinks-20260630-v2.webp`
- 交付位置：`apps/mini-program/src/assets/lovart/`

## 必须解决的体验问题
1. **不要像贴图**：插画顶部需要和白色卡片背景自然消融，没有硬边框。
2. **不要抢戏**：票卡顶部已经有一张 corgi 主视觉 banner，票尾的 corgi 只需要小小客串。
3. **事件类型优先**：第一眼应读出「饭局」或「酒局」，corgi 是氛围点缀。
4. **姐妹图感**：两张图的光影、笔触、色温必须一致，像同一套印刷品。

## JoyJoin 品牌参数
- 主色 Vibrant Purple: #8B5CF6（仅作极小点缀）
- 辅色 Warm Coral: #FF9B85
- 背景：纯白色 #FFFFFF 卡片，插画顶部需自然融入白色
- 视觉调性：warm, cute, rounded, soft, lively, minimal, refined, breathable
- 风格：低多边形/几何切面画风（low-poly / faceted），带 painterly 笔触感，facet 内 soft gradients，极少描边

## 饭局 / dining 变体
场景：一张温暖、圆润的餐桌小景。
- 元素：几个可爱的小菜、一双筷子、一小碗米饭、温暖烛光、 tiny 餐巾或装饰香草
- Corgi 客串：趴在桌边偷看、举着一张 tiny 话题卡、或坐在桌角的小凳子上，表情好奇又欢迎
- Corgi 占比：约占画面 15–20%，不要成为唯一焦点
- 氛围：像刚入座、期待破冰的饭局

## 酒局 / drinks 变体
场景：轻松的小酒吧/饮品角。
- 元素：几只优雅的酒杯、一小瓶酒或杯垫、细微气泡或光斑、温暖酒吧灯光
- Corgi 客串：坐在 tiny 高脚凳上、举着小酒杯、从酒瓶后探头、或拿着搅拌棒
- Corgi 占比：约占画面 15–20%
- 氛围：微醺、放松、准备畅聊

## 关键构图要求
1. **全宽 footer**：画面水平方向 750 px 必须有内容，左右边缘不能留空。
2. **顶部消融**：画面上方约 80–100 px 区域要做成透明或白色渐变消融，让插画无缝融入白色卡面。建议直接输出带透明顶部的 PNG/WebP，或在画面中保留足够 white-safe 渐变。
3. **底部接地**：视觉重心在画面下 2/3，让场景「坐」在票卡底部。
4. **无文字、无水印、无照片写实、无硬边描边**
5. **无主角 corgi 重复**：票卡顶部已有 corgi hero，这里的 corgi 只是 tiny cameo。

## 反平庸检查
- 这两张图如果去掉 corgi，会不会像某个通用 app 的插画？如果是，请加更多 JoyJoin 特有的温暖细节。
- 画面是否有清晰的事件类型语义（饭局 vs 酒局）？
- 顶部和白色卡面的过渡是否自然，没有明显矩形边界？

## 技术交付
- 尺寸：750 × 280 px
- 格式：WebP
- 压缩：q=75–85，目标每张 ≤ 40 KB
- 命名：
  - `lovart-event-ticket-tail-dining-20260630-v2.webp`
  - `lovart-event-ticket-tail-drinks-20260630-v2.webp`

请先输出两张草图供我们确认构图，确认后再输出最终 WebP。
