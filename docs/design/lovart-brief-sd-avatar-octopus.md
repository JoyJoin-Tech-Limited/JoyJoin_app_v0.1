# Lovart Brief — SD 像素形象 · 脑洞章鱼（octopus，风格验证 pilot）

> 日期：2026-08-07
> 状态：Phase A · 风格帧验证 pilot。这是 SD 像素形象体系的**第一张图**，风格帧验收通过后其余原型才开工。
> 绑定规范：`docs/design/sd-pixel-avatar-style-guide.md`（下称「风格规范」，T1–T7 令牌编号引用该文档）。本 brief 与风格规范冲突时，以风格规范为准。

## Goal

为 12 原型中的**脑洞章鱼（octopus）**绘制一张正面朝向的 SD 像素形象（sprite），用于集结房间内入座/在场展示。章鱼是全体系最难的一张（触手符号化 + 二头身比例 + 彩色描边三重承压），作为风格验证 pilot：它过验收，体系成立。

## Brand Parameters

- **角色原型色：** 粉鲑色 `#CB8783`（hsl 3, 40%, 65%，源自 `packages/shared/src/archetypeColors.ts` 采样色）——身体主色块必须落在这个色相上，与 V2 高个纸娃娃（`assets-source/profile-pixel-v2/octopus/atlas-source.png`）的鲑粉色身体一致
- **招牌特征：** 4 条符号化触手，身体两侧挥舞、末端内卷（符号级，不是写实 8 腕）
- **次要特征：** 圆顶头上的深色斑点
- **眼睛：** 统一像素眼——大眼 + 1px 高光点（风格规范 §2-7）
- **人格气质：** 好奇、脑洞大、热情但不闹——触手姿态可以「正在比划一个想法」，不要张牙舞爪
- **Visual tone:** 暖 / 圆润 / 柔和 / 精致，禁硬核游戏素材感

## Asset Specifications

- **Type:** character-sprite (pixel art)
- **Platform:** mini-program（集结房间视口 + 分享物料）
- **Master canvas:** 128 × 128 px，透明背景；角色身高 **~130px 顶格**（风格规范 T3 上限；触手展开宽度不超过 canvas）
- **比例：** 二头身 SD，头部约占身高 1/2；正面朝向（T5）
- **描边：** 全部 1px 彩色描边，描边色 = 基色同色相、明度 30%（粉鲑色 → 描边 ≈ `hsl(3, 40%, 30%)`），**禁止纯黑**（T2）
- **光影：** 单一暖主光从上方打下；1 个椭圆地面投影 + 受光侧 1px 高光；无复杂 shading（T4）
- **用色：** ≤32 色（T1）；除原型色延伸外禁止新增高饱和色
- **Export format:** PNG 透明底，**预缩放 4 档：96 / 64 / 48 / 32px**，每档单独像素清理（T6）
- **File-size budget:** 每档 ≤ 20 KB

## Style Reference

Upload these reference images to Lovart ChatCanvas before generating:

1. **同一角色锚点（必传）：** `assets-source/profile-pixel-v2/octopus/atlas-source.png` —— V2 高个纸娃娃。SD 版必须与其保持同一配色（鲑粉身体、深色斑点）与同一物种读法，验收时两图并排做「是同一个角色吗」测试。
2. **风格反例（口头描述即可）：** 硬核同人像素风常用的纯黑粗描边 + 高饱和配色 = 本项目明确不要的方向。

## Prompt Draft (for Lovart ChatCanvas)

```
Create a single pixel-art character sprite on a transparent background: a cute chibi "SD" octopus character, front-facing, 2-heads-tall proportions (head is about half of total height). Canvas 128x128 px, character height about 130 px touching top and bottom.

Species read (most important): the octopus must be recognizable in 3 seconds at tiny size. Signature feature: exactly FOUR symbolic tentacles, two waving out on each side with inward-curling tips — simplified to icon level, NOT realistic eight arms. Secondary feature: darker spots on the round dome head. Everything else is dropped.

Body color: soft salmon pink #CB8783 (hue 3, saturation 40%, lightness 65%). Personality: curious, idea-sparking, warmly enthusiastic — the tentacle pose can look like it is mid-gesture explaining an idea, not aggressive.

CRITICAL outline rule: all outlines are exactly 1px and COLORED — outline color is the same hue as each fill color with lightness reduced to 30% (e.g. salmon fill gets a dark desaturated salmon outline). NEVER use pure black outlines anywhere. Lit edges get a 1px highlight in a lighter tint of the base color, never pure white.

Eyes: large cute pixel eyes with a single 1px highlight dot — this exact eye style will be shared across a 12-character set.

Lighting: one single warm key light from directly above (the room's main lamp). Exactly ONE elliptical soft floor shadow under the character, plus a 1px highlight on the lit (top) side. No complex shading, no gradients, no ambient occlusion.

Palette discipline: at most 32 colors total, muted and warm; no new high-saturation colors beyond the salmon family, soft cream accent, and eye colors.

Style: soft premium doujin pixel art — cozy and refined, NOT hardcore game-asset pixel style. Clean pixel clusters, no stray single pixels, no anti-aliasing, no text, no watermark, transparent background.
```

## Export Requirements

- **File naming:** `sd-avatar-octopus-{96|64|48|32}-v1.png`（4 档各一）
- **Save location:** `assets-source/sd-pixel-avatars/octopus/`（master 128px 源文件同目录留存，命名 `sd-avatar-octopus-master-v1.png`）
- **运行时接入：** 集结房间实现期再注册进 CDN manifest；本 brief 只交付源资产，不改任何运行时代码
- **Downscale discipline:** 4 档由 master 逐档降采样后**手工修像素**（重点：48/32px 档的眼睛高光点与触手末端必须仍是干净像素簇），禁止直接交付机器缩放稿

## 风格帧验收标准（Style-frame Acceptance）

本图须通过风格规范 §4 全部四关，且作为 pilot 追加以下风格帧专项检查：

- [ ] **T2 描边抽查：** 全图任意放大区域无纯黑像素描边；描边色相与相邻色块一致
- [ ] **T4 光影抽查：** 全图只有 1 个地面椭圆投影；无第二层阴影、无渐变体积
- [ ] **触手符号化：** 正好 4 条，48px 档下仍可数清、末端内卷可读
- [ ] **48px · 3 秒识别：** 5 位非团队成员 3 秒内说出「章鱼」，5/5 通过
- [ ] **「同一角色」测试：** 与 V2 atlas 并排，5 位看过 V2 的用户 ≥4 人认为是同一角色（鲑粉配色 + 斑点一致）
- [ ] **真机不糊：** 4 档尺寸在微信开发者工具 + 真机逐档锐利，无糊边
- [ ] **色板审计：** 导出色数 ≤32，无高饱和杂色
- [ ] **二头身比例：** 头约占身高 1/2；与规范中其余 11 原型的身高基准线兼容（100–130px）

## Review Checklist

- [ ] 原型色 `#CB8783` 色相准确，与 V2 章鱼一致
- [ ] 气质是「好奇脑洞」，不是「张牙舞爪」
- [ ] 无文字、无水印、透明底
- [ ] 4 档导出每档都经过手工像素清理
- [ ] 每档文件 ≤ 20 KB

## Downstream handoff

- **验收通过后：** 本图冻结为**风格帧（style frame）**，其余 11 个原型的 Lovart brief 引用本图作为风格锚点；随后开工 rooster（鸡冠穿帽规则验证）与 cat（易混簇基线）。
- **验收不通过：** 优先放大招牌特征、检查描边色，不追加细节；连续两轮不过则回到风格规范修订，不硬产。
