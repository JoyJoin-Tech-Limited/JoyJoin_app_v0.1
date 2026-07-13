# 阿浪 NPC Prototype — 素材需求文档

> 版本：v0.1
> 状态：占位符已就绪，等待最终素材替换

---

## 1. 素材原则

- **不阻塞功能开发**：所有素材位置已用清晰命名的 placeholder 占位，功能可完整运行
- **风格一致性**：与现有 JoyJoin UI 和角色体系协调
- **无廉价 AI 感**：不使用明显 AI 生成的低质量人物图作为最终素材
- **优先复用**：检查现有仓库素材是否可复用

---

## 2. 必需素材清单

### 2.1 事件卡横图（Event Card Hero）

- **用途**：Discover 入口卡片、事件列表卡片、事件详情页头图
- **尺寸**：750 × 420 px（16:9 比例，适配小程序卡片）
- **格式**：WebP（主）+ PNG  fallback
- **透明背景**：否
- **安全区**：底部 120px 为文字/渐变遮罩区域，避免重要视觉元素
- **命名**：`alang-event-card-hero.webp`
- **生成提示**：
  - 风格：现代插画，与 JoyJoin 品牌色调协调（紫色 #8B5CF6、粉色 #FF6B9D）
  - 场景：城市街角或公园，黄昏/傍晚氛围
  - 人物：一个年轻男性角色（阿浪）坐在长椅上或站在路灯下，姿态放松但略带孤独感
  - 氛围：温暖、轻微忧郁、有故事感
  - 避免：卡通化、过度渲染、与现有 mascot 风格冲突

### 2.2 找到阿浪场景插画（Found Scene）

- **用途**：用户进入 5 米范围后展示的角色场景插画
- **尺寸**：750 × 900 px（竖版，适配全屏展示）
- **格式**：WebP + PNG fallback
- **透明背景**：否
- **安全区**：底部 200px 为旁白文字区域
- **命名**：`alang-found-scene.webp`
- **生成提示**：
  - 风格：与事件卡一致
  - 场景：近距离视角，阿浪抬头看向镜头/用户方向
  - 表情：略带惊讶但友善，嘴角微微上扬
  - 背景：虚化城市夜景或公园，突出人物
  - 光线：暖色路灯或手机屏幕光打在脸部

### 2.3 结果卡背景/人物局部（Result Card）

- **用途**：故事结果卡顶部视觉
- **尺寸**：750 × 400 px
- **格式**：WebP + PNG fallback
- **透明背景**：否
- **命名**：`alang-result-hero.webp`
- **生成提示**：
  - 风格：与主插画一致
  - 内容：阿浪的侧影或局部（背影、手部、鞋等），暗示"陪伴结束"
  - 氛围：平静、温暖、略带感伤
  - 色调：与品牌色协调的暖紫/暖粉渐变

### 2.4 陪伴移动氛围背景（Companion Atmosphere）

- **用途**：陪伴移动页面的氛围背景
- **尺寸**：750 × 1334 px（全屏背景）
- **格式**：WebP
- **透明背景**：否
- **命名**：`alang-companion-bg.webp`
- **生成提示**：
  - 风格：抽象氛围图，非具象场景
  - 内容：城市夜景的抽象光斑、路灯拖影、地面反光
  - 色调：深紫到暖粉的渐变，低饱和度
  - 用途：作为页面背景，上方覆盖 UI 文字和距离显示

---

## 3. 可选素材（增强体验）

### 3.1 对话头像（Dialogue Avatar）

- **用途**：对话页面中阿浪的发言头像
- **尺寸**：128 × 128 px
- **格式**：WebP
- **透明背景**：是（圆形裁切）
- **命名**：`alang-avatar.webp`
- **内容**：阿浪正面头像，友善表情

### 3.2 地图标记图标

- **用途**：配置页面和地图上的标记
- **尺寸**：64 × 64 px
- **格式**：PNG（需要透明）
- **命名**：`alang-marker-target.png`, `alang-marker-end.png`
- **内容**：简洁的定位标记，品牌色填充

---

## 4. 现有素材复用检查

| 素材 | 现有文件 | 可复用？ | 备注 |
|------|---------|---------|------|
| 品牌 Logo | `/assets/joyjoin-logo.webp` | 是 | 作为 fallback |
| Mascot 表情 | `xiaoyue-*.webp` | 否 | 风格不匹配，阿浪是独立角色 |
| Lovart 插画 | `lovart-*.webp` | 否 | 风格不匹配，需要新角色 |
| 空状态插画 | `lovart-generic-empty.webp` | 是 | 可作为临时 fallback |

---

## 5. 占位符现状

当前代码中使用的占位符：

- `/assets/lovart/alang-event-card-placeholder.webp` — 事件卡
- `/assets/lovart/alang-found-scene-placeholder.webp` — 找到场景
- `/assets/lovart/alang-result-placeholder.webp` — 结果卡

这 3 个 WebP 占位文件已随 Prototype 放入
`apps/mini-program/src/assets/lovart/`，可用于完整走通测试流程。上线前需要：
1. 用最终素材原路径替换当前 placeholder
2. 或配置 CDN 路径并通过 `cdnAsset()` 加载

---

## 6. CDN 配置建议

推荐将最终素材上传至 CDN：

```
https://joyjoinapp.com/static/assets/alang/
  - alang-event-card-hero.webp
  - alang-found-scene.webp
  - alang-result-hero.webp
  - alang-companion-bg.webp
```

前端代码中通过 `cdnAsset('/assets/alang/alang-event-card-hero.webp')` 加载。

---

## 7. 素材验收标准

- [ ] 所有素材在真机上加载正常，无白屏或撕裂
- [ ] WebP 格式在 iOS 和 Android 微信端均可正常解码
- [ ] 图片尺寸不超过 200KB（事件卡）、300KB（全屏插画）
- [ ] 风格与现有 JoyJoin UI 协调，无突兀感
- [ ] 人物角色一致：阿浪在不同素材中的发型、服装、气质一致
- [ ] 无文字水印或 AI 生成痕迹（如畸形手指、不自然光影）

---

## 8. 素材生成责任

- **设计团队**：提供角色设定稿（阿浪外观、服装、气质）
- **插画团队**：基于设定稿生成场景插画
- **开发团队**：负责素材压缩、格式转换、CDN 上传、代码接入

---

*文档创建时间：2026-07-11*
*对应代码版本：alang-prototype v0.1*
