# Lovart → Seedance 双阶段管线

分镜场景先由 Lovart 生成静态关键帧，再作为参考素材喂给 Seedance / 即梦生成视频。
纯文本提示词也能用，但角色与场景一致性会明显变弱。

---

## 阶段一：Lovart 生成分镜场景图

### 什么时候必须先生成场景图

| 场景 | 需要 Lovart 素材 |
|------|----------------|
| 视频主体是 mascot（社牛柯基等） | **必须** — 角色参考图否则形象漂移 |
| 品牌片、宣传片 | 强烈建议 — 场景/色调一致性 |
| 产品实拍类 | 不需要 — 用真实素材 |
| 纯氛围/粒子特效片 | 不需要 |

### 关键帧选择规则

- 一个视频通常只需要 **2-4 张** 关键帧：角色参考图 + 主要场景参考 + （可选）首帧。
- 每张图对应分镜表中一个或多个镜头的"视觉锚点"。
- 角色参考图用 `lovart-design-workflow` 的 mascot 模板，必须锁定：
  动物/物种、配色、体型、五官风格（大而亮的眼睛）、插画风（2D low-poly 几何）。
- 场景参考图锁定：地点、色调、光线方向、道具。

### Lovart 简写模板（每张关键帧）

```
画面主体：社牛柯基（corgi），2D low-poly 插画风，暖色几何身体，大而亮眼睛
场景：黄昏咖啡馆外街道，Warm Beige 主色调，紫色#8B5CF6 门牌点缀
构图：远景，主体居中偏右，留白充足
情绪：期待、雀跃
输出：PNG 透明底（角色）/ PNG 不透明（场景），16:9
```

> 详细品牌参数与 Lovart 语法走 `lovart-design-workflow`，此处只给分镜视角的简写。

### 写实层增强（DSLR 质感）——现实层人像/场景必加

真人角色与写实场景的关键帧，在 prompt **结尾**追加以下 DSLR 质感块，显著降低
"AI 感"（AI 生成写实人像最常死于磨皮与过度渲染）：

```
Photographed with a Canon SL3 with 17-85mm lens. No text overlays.
Maintain consistency and fine pores so the image appears more like
traditional DSLR photography and photorealistic. Avoid Airbrushed look
and CGI Retouch.
```

中文等效（Lovart 中文对话时使用）：

```
佳能SL3相机配17-85mm镜头拍摄，无文字叠加，保持细节一致与细腻毛孔，
呈现传统单反摄影的真实质感，避免磨皮感和CGI修图感
```

**使用规则：**
- 仅用于**现实层**（真人角色、城市实拍、产品道具）——mascot 插画/3D clay 层**不加**
  （会破坏手办质感，悦仔等 clay 角色反而需要保留指纹纹理感）
- 放在 prompt 结尾，与 Never 红线不冲突（它替换"过度磨皮"类负面词）
- 写实人像关键帧（如主角启哲）**必须带**，场景类可带可不带（视氛围需求）

### 角色参考图模板（多视图转面图）——角色一致性核心

当角色贯穿全片、一致性要求最高时，**先出单视图锚定版并验收**，然后把该图上传给
Lovart，粘贴以下转面图 prompt，生成 7 面板角色表（上排 4 个全身：正面/左侧面/右
侧面/背面；下排 3 个特写：正面/左/右肖像）：

```
Create a professional character reference sheet based strictly on the uploaded
reference image. Use a clean, neutral plain background and present the sheet as
a technical model turnaround while matching the exact visual style of the
reference (same realism level, rendering approach, texture, color treatment,
and overall aesthetic). Arrange the composition into two horizontal rows.
Top row: four full-body standing views placed side-by-side in this order:
front view, left profile view (facing left), right profile view (facing right),
back view. Bottom row: three highly detailed close-up portraits aligned beneath
the full-body row in this order: front portrait, left profile portrait (facing
left), right profile portrait (facing right). Maintain perfect identity
consistency across every panel. Keep the subject in a relaxed A-pose and with
consistent scale and alignment between views, accurate anatomy, and clear
silhouette; ensure even spacing and clean panel separation, with uniform framing
and consistent head height across the full-body lineup and consistent facial
scale across the portraits. Lighting should be consistent across all panels
(same direction, intensity, and softness), with natural, controlled shadows
that preserve detail without dramatic mood shifts. Output a crisp,
print-ready reference sheet look, sharp details.
```

**使用规则：**
- **使用前提**：先有已验收的单视图锚定版（如启哲 3 变体选中的那张），上传后再发本 prompt
- **适用角色**：贯穿全片的真人主角（启哲）与 mascot（悦仔）；只出现 3 秒的客串角色不必
- **产物用途**：转面图表成为 Seedance 参考位的核心锚（`@图片X 作为角色形象参考`），
  一致性锁定最强、有效期最长
- 现实层角色在 prompt 结尾追加 DSLR 质感块；3D clay 层（悦仔）不加

---

## 阶段二：Seedance 提示词生成

### 素材引用语法

用 `@素材名` 指定用途：

```
@图片1 作为首帧/角色形象参考/场景风格参考
@视频1 参考运镜/动作/节奏
@音频1 用于配乐/对白参考
```

### 一致性控制（解决前后不一致）

```
@图片1 作为角色形象参考
@图片2 作为场景风格参考
@图片3 作为首帧画面
```

### 提示词标准结构

```
【整体描述】风格 + 时长 + 画面比例 + 整体氛围

【分镜描述】
0-X秒：[镜头运动]，[画面内容]，[主体动作]，[光影/特效]
X-Y秒：[镜头运动]，[画面内容]，[主体动作]，[光影/特效]
...

【声音说明】配乐风格 / 音效 / 对白

【参考素材说明】
@图片1 作为角色形象参考
@图片2 作为首帧
```

### 提示词书写原则

1. 时间轴清晰，每段标注秒数范围，整段连续无重叠
2. 镜头语言明确（景别 + 运镜 + 转场），禁止"优美""好看"等模糊词
3. 动作描述具体：主体做什么、怎么动、光影如何变化
4. 多模态引用一律 `@素材名 + 用途`
5. 视频延长：写明"将@视频1 延长 Xs"，生成长度选"新增部分"时长

### 电影机质感块（IMAX/大画幅）——视频生成必加

视频 prompt 的【整体】段追加以下电影机质感块，把输出从"AI 视频感"拉向
"影院级"（与静态层的 DSLR 块对应：DSLR=关键帧，IMAX=成片）：

```
Cinematic IMAX 65mm large-format look, 2.39:1 widescreen framing,
shallow depth of field with natural bokeh, subtle film grain, high
dynamic range, natural light priority, steady gimbal camera work,
photorealistic skin texture with fine pores, no CGI gloss.
```

中文等效（即梦/中文提示词时使用）：

```
IMAX 65mm 大画幅电影质感，2.39:1 宽银幕构图，浅景深自然虚化，
轻微胶片颗粒，高动态范围光比，自然光优先，稳定器级运镜，
写实皮肤纹理细腻毛孔，无 CGI 光泽感
```

**使用规则：**
- 放进【整体描述】段，与分镜段（运镜/动作）分工：质感块定"画质气质"，分镜段定"镜头行为"
- 仅用于**现实层/写实段**——插画风、3D clay、mascot 动画段不加（会破坏风格层）
- **比例适配**：2.39:1 宽银幕仅用于横屏品牌片（16:9 平台）；竖屏 9:16 改用
  "大画幅竖构图质感"（IMAX 质感的垂直构图版，不写 2.39:1）
- 大场面/城市空镜/上帝视角段必须带；室内喜剧段可降为"电影级写实"不带 IMAX（防止压过台词节奏）

---

## Seedance 2.5(2026-06 发布;能力源:seedance.tv 官方页)

| 能力 | 2.0 | **2.5** | 创作影响 |
|------|-----|---------|---------|
| 单段时长 | 2-15s | **30s 连续** | 一镜到底段落直接生成 |
| 分辨率 | 最高 2K | **原生 4K / 10-bit** | 大屏投放不降质 |
| 参考数量 | ≤12 文件 | **≤50 个多模态参考** | 全片角色/道具/品牌一致性锁定 |
| 音频 | 联合生成 | **节奏 + 口型指导原生音频** | 卡点与音乐梗模型内生成 |
| 预可视化 | — | **运动参考 + 3D 白模 previs** | 先预演走位再渲染,省迭代 |

**2.5 使用建议:**
- 复杂多镜场景、品牌叙事、需要全片一致性的镜头 → 优先 2.5
- 快速草稿/低成本变体 → 仍用 2.0 / 2 Mini
- 测试流程:先 5-15s 短段验证控制力(移轴/光瀑/长镜),确认后再投 30s 长段
- ⚠️ 写实真人脸部拦截是否解除未确认 — 生成前必须实测;mascot/插画不受影响
- ⚠️ 奇观镜头按"生成 10 选 2"备量,签名镜头值得迭代 20 轮以上

---

## Seedance 2.0 平台能力与限制

### 输入规格

| 输入 | 要求 | 上限 |
|------|------|------|
| 图片 | jpeg/png/webp/bmp/tiff/gif | ≤ 9 张，每张 < 30 MB |
| 视频 | mp4/mov | ≤ 3 个，总时长 2-15s，< 50 MB |
| 音频 | mp3/wav | ≤ 3 个，总时长 ≤ 15s，< 15 MB |
| 文本 | 自然语言 | — |

**混合输入总上限 12 个文件。**

### 核心功能

- **参考图像** — 精准还原构图、角色细节、服装样式
- **参考视频** — 复刻镜头语言、动作节奏、创意特效
- **视频延长** — 平滑续拍（"接着拍"）
- **视频编辑** — 角色替换、剧情颠覆、片段调整
- **多模态组合** — 图 + 视频 + 音频 + 文本自由组合

### 平台限制（必须校验）

- ⚠️ **写实真人脸部素材会被拦截**（图片和视频均不可用）— mascot/插画不受限
- ⚠️ 视频参考消耗更多生成额度 — 优先上传影响最大的素材
- ⚠️ 视频总像素数范围：[409600 (640×640), 927408 (834×1112)]
- 入口：即梦 (jimeng.jianying.com) → Seedance 2.0 → 全能参考 / 首尾帧

### 视频延长用法

- 明确写"将@视频1 延长 Xs"
- 生成长度选择"新增部分"的时长（不是总时长）

---

## 校验清单（提示词写完后）

- [ ] 时间轴覆盖 0 → 总时长，连续无缝隙
- [ ] 每个分镜段有明确镜头动词（推/拉/摇/移/跟/环绕/升降）
- [ ] 素材引用不超过平台上限（图 ≤9 / 视频 ≤3 / 音频 ≤3 / 总 ≤12）
- [ ] 真人脸部素材已排除
- [ ] Lovart 素材的角色/场景与提示词描述一致
