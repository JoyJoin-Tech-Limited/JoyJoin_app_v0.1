# Lovart Brief — 我的连接空状态 Mascot 插画

## 项目背景
JoyJoin 微信小程序的「我的连接」页面空状态需要一张新的 mascot 插画，替换当前的 `xiaoyue-connections-empty.webp`。

当前问题：现有插画带有不透明米色背景，在页面渐变背景上显得像一块方形贴纸，与屏幕不融合。

## 需求概述
生成一张 **透明背景** 的 Xiaoyue（柯基 mascot）空状态插画，用于「我的连接」页面无连接时展示。

## 品牌参数
- **视觉风格**：JoyJoin 标志性的低多边形/几何风格（low-poly），柔和笔触，温暖可爱但不幼稚
- **角色**：Xiaoyue — 穿紫色 hoodie 的柯基，可佩戴小墨镜/手表等品牌元素
- **主色调**：Vibrant Purple `#8B5CF6`，Warm Coral `#FF6B9D` 作为点缀
- **情绪**：好奇、期待、温暖、不沮丧
- **背景**：完全透明（RGBA），让插画能浮在页面渐变背景上

## 具体规格
| 项目 | 要求 |
|---|---|
| 尺寸 | 480×720px（竖版，与现有文件一致） |
| 格式 | WebP，透明背景 |
| 文件命名 | `xiaoyue-connections-empty-v2.webp` |
| 主体 | Xiaoyue 柯基，全身或半身 |
| 姿势 | 坐着或微微歪头站立，眼神向上或向旁边看，像在期待/等待 |
| 元素 | 可有 1–2 个 subtle 的"连接"意象：小星星、虚线、小气泡等，不要过多 |
| 禁止 | 文字、水印、复杂背景、多个 mascot、冷色调主导 |

## 参考
现有文件位置：`apps/mini-program/src/assets/personality/xiaoyue/xiaoyue-connections-empty.webp`

风格参考同目录其他 Xiaoyue 插画（如 `xiaoyue-city-unlock.webp` 是全身透明背景，可作为构图参考）。

## 验收标准
- [ ] 透明背景，无方形/圆形背景色块
- [ ] 主体清晰，在 200×200rpx 展示尺寸下仍能辨认表情
- [ ] 与 JoyJoin 品牌视觉一致（紫色 hoodie、低多边形风格）
- [ ] 情绪温暖、好奇、不焦虑
- [ ] 无文字、无水印

## 下游使用
插画将直接替换 `apps/mini-program/src/assets/personality/xiaoyue/xiaoyue-connections-empty.webp`，配合已实现的 archetype badge 和 halo 效果使用。
