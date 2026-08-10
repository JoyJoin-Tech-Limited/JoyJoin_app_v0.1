# Lovart Brief — SD 像素形象 · 小太阳鸡（rooster，鸡冠穿帽规则验证）

> 日期：2026-08-07
> 状态：Phase A · 第二张验证图（2026-08-10 起不再用于集结房间；集结房间角色层改复用 V2 纸娃娃 + 装备体系）。验证「头部装备不得完全遮盖招牌物种特征」硬规则（鸡冠必须穿透帽口露出）。
> 绑定规范：`docs/design/sd-pixel-avatar-style-guide.md`（T1–T7 令牌引用该文档）。风格锚点：已验收的 octopus 风格帧（`docs/design/lovart-brief-sd-avatar-octopus.md`）。

## Goal

为 **小太阳鸡（rooster）** 绘制正面朝向的 SD 像素形象。本图除过标准验收外，专门验证风格规范 §2-5/§2-6 的鸡冠规则：**无论戴不戴帽饰，火焰形鸡冠都必须完整可读**——戴帽时鸡冠从帽子的开口中穿出来，而不是被盖住。

## Brand Parameters

- **角色原型色：** 金琥珀 `#C49538`（hsl 38, 71%, 50%，源自 `archetypeColors.ts` 采样色）——体现在尾羽/喙爪等点缀色块；身体主体沿用 V2 的奶白/米色羽毛（见参考图），鸡冠用暖珊瑚系红
- **招牌特征：** 火焰形鸡冠（符号级放大，头顶最高点）
- **次要特征：** 简化彩尾羽 2–3 根扇形（V2 的深色尾羽，向后上方展开）
- **眼睛：** 统一像素眼——大眼 + 1px 高光点
- **人格气质：** 温暖、正能量、小太阳——姿态放松挺拔，像在打招呼，不要好斗
- **Visual tone:** 暖 / 圆润 / 柔和 / 精致

## Asset Specifications

- **Type:** character-sprite (pixel art)
- **Platform:** mini-program（未来紧凑头像/全局图标场景 + 分享物料）
- **Master canvas:** 128 × 128 px，透明背景；角色身高 100–130px（T3），尾羽展开不超出 canvas
- **比例：** 二头身 SD，正面朝向（T5）
- **描边：** 1px 彩色描边，基色同色相明度 30%，禁止纯黑（T2）
- **光影：** 单一暖主光上方打下；1 椭圆地面投影 + 受光侧 1px 高光；无复杂 shading（T4）
- **用色：** ≤32 色（T1）；鸡冠红取暖珊瑚 `#FF9B85` 同色相反方向加深一档（深暖红），不引入高饱和正红
- **Export format:** PNG 透明底，预缩放 4 档 96 / 64 / 48 / 32px，每档单独像素清理（T6）
- **File-size budget:** 每档 ≤ 20 KB

## Style Reference

Upload these reference images to Lovart ChatCanvas before generating:

1. **同一角色锚点（必传）：** `assets-source/profile-pixel-v2/rooster/atlas-source.png` —— V2 高个纸娃娃。保持同一角色读法：奶白身体、暖红鸡冠、深色扇形尾羽、金琥珀点缀。
2. **风格帧（必传）：** 已验收的 `sd-avatar-octopus-master-v1.png` —— 描边规则、眼型、光影、色板克制的基准。

## Prompt Draft (for Lovart ChatCanvas)

```
Create a single pixel-art character sprite on a transparent background: a cute chibi "SD" rooster character, front-facing, 2-heads-tall proportions (head is about half of total height). Canvas 128x128 px, character height 100-130 px.

Species read (most important): recognizable as a rooster in 3 seconds at tiny size. Signature feature: a flame-shaped red comb on top of the head, exaggerated to icon level, always fully visible — it is the tallest point of the character. Secondary feature: 2-3 simplified fan-shaped dark tail feathers sweeping up behind the body. Everything else (wattle detail, claw detail) is dropped.

Body: soft cream / warm off-white feathers (matching the reference's milky body). Comb in a deep warm coral red (deepened sibling of #FF9B85, NOT saturated pure red). Tail feathers dark charcoal-brown. Accent color golden amber #C49538 for beak and feet. Personality: warm, sunny, positive — relaxed upright pose like a friendly greeting, not aggressive.

CRITICAL outline rule: all outlines are exactly 1px and COLORED — outline color is the same hue as each fill color with lightness reduced to 30%. NEVER use pure black outlines anywhere. Lit edges get a 1px highlight in a lighter tint of the base color, never pure white.

Eyes: large cute pixel eyes with a single 1px highlight dot — must match the shared eye style of the reference octopus sprite.

Lighting: one single warm key light from directly above (the room's main lamp). Exactly ONE elliptical soft floor shadow, plus a 1px highlight on the lit (top) side. No complex shading, no gradients, no ambient occlusion.

Palette discipline: at most 32 colors total, muted and warm; no new high-saturation colors.

Style: soft premium doujin pixel art, matching the reference octopus sprite exactly in outline treatment, eye style, lighting and color restraint. Clean pixel clusters, no anti-aliasing, no text, no watermark, transparent background.

SECOND DELIVERABLE — headwear variant: the SAME character wearing a simple small beanie. Hard rule: the beanie must have an opening at the top and the flame comb pokes THROUGH the opening, fully readable. Headwear must never fully cover the comb. Same canvas, same everything else.
```

## Export Requirements

- **File naming:** `sd-avatar-rooster-{96|64|48|32}-v1.png`；帽饰变体 `sd-avatar-rooster-beanie-{96|64|48|32}-v1.png`
- **Save location:** `assets-source/sd-pixel-avatars/rooster/`（master 源文件 `sd-avatar-rooster-master-v1.png` / `sd-avatar-rooster-beanie-master-v1.png`）
- **运行时接入：** 如未来启用 SD 头像，再注册 CDN manifest；本 brief 只交付源资产（集结房间 2026-08-10 已改复用 V2 纸娃娃）。
- **Downscale discipline:** 4 档逐档手工修像素；48/32px 档鸡冠轮廓与眼睛高光必须仍是干净像素簇

## 鸡冠穿帽专项检查（本 brief 特有）

- [ ] 无帽版：鸡冠为全身最高点，48px 下火焰轮廓完整可读
- [ ] 帽饰版：帽子有明确开口，鸡冠**穿透开口**露出，3 秒内仍读出「鸡」
- [ ] 帽饰版：帽子没有压塌/截断鸡冠形状；鸡冠描边无断裂
- [ ] 两版除帽饰外逐像素一致（同一角色，不是两张图）

## Review Checklist

- [ ] 风格与 octopus 风格帧一致（描边、眼型、光影、色板克制）
- [ ] 原型色与 V2 小太阳鸡一致（奶白身体、暖红冠、深色尾羽、金琥珀点缀）
- [ ] 鸡冠红非高饱和正红
- [ ] 48px · 3 秒识别 5/5（「鸡/公鸡」）
- [ ] 「同一角色」测试 ≥4/5（对 V2 atlas）
- [ ] 真机 4 档不糊；色数 ≤32；每档 ≤20 KB
- [ ] 无文字、无水印、透明底

## Downstream handoff

- 鸡冠穿帽规则验证通过后，该规则样例（帽饰版）写入风格规范 §2-6 作为后续所有头饰装备的参照。
- 下一张：cat（易混簇基线，见 `docs/design/lovart-brief-sd-avatar-cat.md`）。
