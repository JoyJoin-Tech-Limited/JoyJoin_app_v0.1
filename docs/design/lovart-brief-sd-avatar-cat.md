# Lovart Brief — SD 像素形象 · 小透明猫（cat，易混簇基线）

> 日期：2026-08-07
> 状态：Phase A · 第三张验证图。猫是 12 原型里翻译难度最低的（基线锚点），但它同时承担**易混簇并排验证**：cat / fox / corgi 三者并排必须 3 秒可区分。
> 绑定规范：`docs/design/sd-pixel-avatar-style-guide.md`（T1–T7 令牌引用该文档）。风格锚点：已验收的 octopus 风格帧。

## Goal

为 **小透明猫（cat）** 绘制正面朝向的 SD 像素形象。猫是「最容易」的一张，作用是定基线——验证体系在最顺手的物种上的产出效率与一致性；同时它必须在与 fox、corgi 并排时靠轮廓硬区分（见下「易混簇约束」）。

## Brand Parameters

- **角色原型色：** 暖浅灰 `#D8D6C7`（hsl 52, 17%, 81%，源自 `archetypeColors.ts` 采样色）——身体主色块；tabby 细条纹用同色相加深档（暖灰棕）
- **招牌特征：** 小三角耳 + 圆头短吻（耳朵内侧粉色三角可读）
- **次要特征：** 额头 tabby 细条纹（2–3 道，与 V2 的灰白虎斑一致）
- **眼睛：** 统一像素眼——大眼 + 1px 高光点；瞳色取 V2 的琥珀色
- **人格气质：** 安静、观察型、「小透明」——姿态收敛、微微含胸，不抢戏，但不是丧
- **Visual tone:** 暖 / 圆润 / 柔和 / 精致

## Asset Specifications

- **Type:** character-sprite (pixel art)
- **Platform:** mini-program（集结房间视口 + 分享物料）
- **Master canvas:** 128 × 128 px，透明背景；角色身高 100–130px（T3）
- **比例：** 二头身 SD，正面朝向（T5）
- **描边：** 1px 彩色描边，基色同色相明度 30%，禁止纯黑（T2）
- **光影：** 单一暖主光上方打下；1 椭圆地面投影 + 受光侧 1px 高光；无复杂 shading（T4）
- **用色：** ≤32 色（T1）；整体低饱和暖灰系，不新增高饱和色
- **Export format:** PNG 透明底，预缩放 4 档 96 / 64 / 48 / 32px，每档单独像素清理（T6）
- **File-size budget:** 每档 ≤ 20 KB

## 易混簇约束（cat / fox / corgi）

三者都是「尖耳毛茸茸」，本图必须严守以下轮廓分工（风格规范 §3）：

- **cat（本图）：圆头 + 短吻 + 小三角耳 + tabby 细条纹** —— 头身轮廓最圆、耳最小
- fox：尖长吻 + 大尖耳 + 白吻尖（吻部是三者中唯一外突的）
- corgi：大立耳 + 白色吻部围脖色块 + 短腿矮身

交付时**附带一张 cat / fox / corgi 48px 并排对比图**（fox、corgi 用风格帧阶段占位稿即可），用于验收时直接跑易混簇并排测试。

## Style Reference

Upload these reference images to Lovart ChatCanvas before generating:

1. **同一角色锚点（必传）：** `assets-source/profile-pixel-v2/cat/atlas-source.png` —— V2 高个纸娃娃。保持同一角色读法：暖浅灰虎斑、琥珀色眼睛、安静气质。
2. **风格帧（必传）：** 已验收的 `sd-avatar-octopus-master-v1.png` —— 描边规则、眼型、光影、色板克制的基准。

## Prompt Draft (for Lovart ChatCanvas)

```
Create a single pixel-art character sprite on a transparent background: a cute chibi "SD" cat character, front-facing, 2-heads-tall proportions (head is about half of total height). Canvas 128x128 px, character height 100-130 px.

Species read (most important): recognizable as a cat in 3 seconds at tiny size, and clearly NOT a fox or a corgi. Signature feature: small triangular ears on a ROUND head with a short muzzle — the roundest, smallest-eared silhouette of the set; inner-ear pink triangles readable. Secondary feature: 2-3 thin tabby stripes on the forehead. Everything else (whiskers, tail) is dropped.

Body color: warm light gray #D8D6C7 (hue 52, saturation 17%, lightness 81%), tabby stripes in a darker warm gray-brown of the same hue. Eyes amber (matching the reference). Personality: quiet, observant, low-key — a slightly reserved, withdrawn posture, calm and gentle, not sad.

CRITICAL outline rule: all outlines are exactly 1px and COLORED — outline color is the same hue as each fill color with lightness reduced to 30%. NEVER use pure black outlines anywhere. Lit edges get a 1px highlight in a lighter tint of the base color, never pure white.

Eyes: large cute pixel eyes with a single 1px highlight dot — must match the shared eye style of the reference octopus sprite.

Lighting: one single warm key light from directly above (the room's main lamp). Exactly ONE elliptical soft floor shadow, plus a 1px highlight on the lit (top) side. No complex shading, no gradients, no ambient occlusion.

Palette discipline: at most 32 colors total, muted and warm; the gray is deliberately low-saturation — do not add any high-saturation accent.

Style: soft premium doujin pixel art, matching the reference octopus sprite exactly in outline treatment, eye style, lighting and color restraint. Clean pixel clusters, no anti-aliasing, no text, no watermark, transparent background.
```

## Export Requirements

- **File naming:** `sd-avatar-cat-{96|64|48|32}-v1.png`；并排对比图 `sd-cluster-cat-fox-corgi-48-compare-v1.png`
- **Save location:** `assets-source/sd-pixel-avatars/cat/`
- **运行时接入：** 集结房间实现期再注册 CDN manifest；本 brief 只交付源资产
- **Downscale discipline:** 4 档逐档手工修像素；48/32px 档耳朵三角与额头条纹必须仍可辨（条纹在 32px 档可减到 1 道，不能糊成灰斑）

## Review Checklist

- [ ] 风格与 octopus 风格帧一致（描边、眼型、光影、色板克制）
- [ ] 原型色与 V2 小透明猫一致（暖浅灰虎斑、琥珀眼）
- [ ] 气质是「安静观察」，不是「沮丧」
- [ ] 48px · 3 秒识别 5/5（「猫」）
- [ ] **易混簇并排测试通过：** cat / fox / corgi 48px 并排，5 位非团队成员 3 秒逐一指认全对
- [ ] 「同一角色」测试 ≥4/5（对 V2 atlas）
- [ ] 真机 4 档不糊；色数 ≤32；每档 ≤20 KB
- [ ] 无文字、无水印、透明底

## Downstream handoff

- 三张验证图（octopus / rooster / cat）全部通过后，风格规范进入「批量生产」状态：其余 9 个原型（corgi / fox / koala / owl / spider / turtle / elephant / dolphin_calm / hamster_praise）按规范 §3 特征表批量出 brief，每张沿用本系列模板，只替换特征与配色段。
- 集结房间场景（`docs/design/lovart-brief-gathering-room.md`）与批量角色可并行开工。
