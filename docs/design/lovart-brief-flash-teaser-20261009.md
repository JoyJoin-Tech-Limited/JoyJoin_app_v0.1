# Lovart Brief — 街头盲盒预告态（Teaser）资产系列 (2026-10-09)

> Status: **assets generated & integrated — CDN upload pending**。两张资产已生成、验收通过、
> 处理入库（`src/assets/alang/flash-teaser-{hero,icon}-v1.webp`，manifest 已登记，dist 已清理）。
> 母版：`assets-source/lovart/flash-teaser/`。剩最后一步：commit + push 后跑
> `gh workflow run "Upload CDN Assets"`，上传成功全链路自动点亮。
> 布局适配（2026-10-09 asset pass）：hero 焦点（悦仔+盒子）居中偏下，预告页文案上移至天空干净区；
> 卡图标用 `aspectFit` 防狼耳裁切。
> 背景：街头盲盒功能上线期保持服务端关闭（`alangEnabled=false`），Discover 入口卡改为「内测中」预告卡 + 静态预告落页。本系列两张资产服务于该预告态。
> 下游交接：资产生成后走 CDN 上传流程 + LQIP 管线，前端落地交 `taro-engineer`。

## 0. 风格锁定（重要）

**使用 2D low-poly painterly 插画风（品牌标准风格锁）——不使用 3D 粘土。** 2026-07-26 landing hero 的 A/B 已决出 2D 低多边形画感胜出（`docs/agent-context/landing-page.md`），3D 粘土例外已随该结论作废。预告页与 landing hero 必须读起来是同一座城市、同一个盒子。

复用 landing 系列的金色发光色谱：hot core `#FDE68A` → main gold `#FBBF24` → outer amber `#F0A030`。

**生成顺序：** 先生成主视觉（Asset 1，风格锚点，出 2 个变体挑强者），再在**同一 Lovart 会话**里生成 Asset 2（"same series as the previous image"），保证光照与材质一致。

## 1. Xiaoyue（悦仔）识别锚点（红线，任何风格转译不得丢失）

1. 彭布罗克威尔士柯基 —— 暖橘棕 + 奶白毛色；鼻梁到额头白色条纹；白口吻、白脸颊、白胸。
2. 超大直立尖耳 —— 外侧棕、内侧柔和粉奶色，前倾竖起。
3. 大而圆的深棕色光泽眼睛，带明亮高光点。
4. 黑色椭圆鼻头；微笑微张、露一点粉色舌尖。
5. 品牌紫 `#8B5CF6` 连帽衫，白色抽绳 —— **衣服上不得有任何文字**。
6. 领口挂一副细框深色圆墨镜 —— 强识别锚点，必须保留。

## 2. Asset 1 — 预告页全屏主视觉（先生成，风格锚点）

**用途：** 点击预告卡后的静态全屏落页主视觉。页面顶部会压真实文字标题，所以构图主体必须沉在下半部。

**要传达的感觉：** 黄昏的城市里有一只还没拆的盒子，盒子缝里有光漏出来，几个"朋友"躲在楼角后面偷看——神秘但温暖，是期待不是诡异。

### Prompt（粘贴进 Lovart）

```
This should feel like a warm invitation to a surprise that hasn't been unboxed
yet — a glowing blind box sitting in a dusk city, light leaking from its lid
seam, and a few shy friends peeking from behind corners. Mysterious but warm,
anticipatory, never spooky or dark-horror.

Scene: a stylized modern city skyline at dusk (generic Chinese tier-1 city,
soft geometric rooftops, a few warm lit windows), seen from a quiet street
corner. Center-lower third of the composition: one closed blind box resting on
the ground — matte Vibrant Purple #8B5CF6 box body with a subtle lid seam,
golden light spilling out from the seam (hot core #FDE68A, main gold #FBBF24,
soft outer amber #F0A030), the glow gently rimming nearby surfaces.

Characters (exactly these, no more):
- Xiaoyue the corgi (Pembroke Welsh Corgi, warm orange-tan + cream-white fur,
  white blaze from nose bridge to forehead, oversized upright pointed ears,
  large round glossy dark-brown eyes with bright catchlights, black oval nose,
  small open smile, wearing a matte Vibrant Purple #8B5CF6 hoodie with white
  drawstrings — NO text on the hoodie — and round dark sunglasses with thin
  frames hanging at the collar) peeking from behind the box, one paw on the
  box edge, curious and excited.
- Three animal friends as PURE BACKLIT SILHOUETTES only — no facial features,
  no interior detail, just dark shapes with golden/lavender rim light from the
  box glow: a grey wolf's pointed ears and snout peeking from behind a
  building corner on the left, a crow's beak and head profile on a rooftop
  edge on the right, a round flat-faced Pallas's cat peeking from behind a
  street lamp base near the box.

Style lock (MANDATORY):
- 2D digital illustration with low-poly / geometric faceted aesthetic
- Painterly, textured rendering with soft brushed feel within each polygonal
  facet — NOT flat vector, NOT 3D render, NOT photorealism
- Minimal or no outlines — facet edges define form
- Soft color variation within individual facets, not global gradients
- Atmospheric dusk background with subtle grain/noise: warm cream #F5F1E8
  near the horizon transitioning to soft dusk lavender above
- Generous negative space in the upper 40% of the canvas (page title will be
  overlaid there in code — keep it calm, low-detail, no focal elements)

Brand colors: Vibrant Purple #8B5CF6 (box + hoodie only), golden glow
#FDE68A / #FBBF24 / #F0A030, dusk lavender ambient, warm cream #F5F1E8,
deep ink #37324D for silhouettes.

Never:
- any text, letters, numbers, logos, watermarks, pseudo-glyphs anywhere
- facial features on the three silhouette animals
- 3D clay render, photorealism, neon colors, harsh contrast, pure black night
- extra characters, crowds, confetti, sparkles, decorative clutter
- anything scary or horror-adjacent — silhouettes must read as shy, not lurking

Composition: full-bleed portrait 750x1200 mindset, box anchored center-lower,
city receding upward, breathing space on top.
Mood: hushed anticipation — the city is keeping a secret for you.

Export: PNG, 1500x2400px (750x1200 @2x), no transparency.
```

**变体协议：** 同 prompt 出 2 个变体，挑"盒子光晕质感 + 剪影可读性"更强的一张作为锚点再继续。

## 3. Asset 2 — 卡面图标：发光盒子 + 狼剪影探头（同一会话生成）

**用途：** Discover 预告卡的 76rpx 方形图标位，替换现有 `street-blind-box-entry.png` 的开放态视觉。小尺寸必须一眼可读。

### Prompt（粘贴进 Lovart，同一会话）

```
Same series as the previous image — identical style lock, palette, and glow.

A single icon-scale composition on a fully transparent background: the closed
Vibrant Purple #8B5CF6 blind box, three-quarter view, golden light (#FDE68A /
#FBBF24 / #F0A030) leaking from the lid seam with a soft halo around the box.
Behind the box's top-right edge, the grey wolf friend peeks out as a pure
backlit silhouette (deep ink #37324D with golden rim light) — pointed ears and
the top of the snout only, no eyes, no facial detail.

Icon-legibility requirements:
- Reads clearly at 38px display size: strong single silhouette, thick shapes,
  no fine detail
- Box occupies ~70% of the frame, wolf peek ~20%, halo bleeds to edges
- Square 1:1 composition, centered, transparent background (alpha)

Never: text, letters, logos, watermarks; wolf facial features; 3D clay;
photorealism; background scenery or ground plane (icon floats on transparency).

Export: PNG with transparency, 512x512px (256 @2x).
```

## 4. 生成后处理与入库

| 步骤 | 命令/位置 |
|------|----------|
| 转 WebP q80+alpha + 48² LQIP | 复用 `npm run build:landing-hero-assets -w mini-program` 同款管线（脚本模式见 landing 资产构建） |
| CDN 上传 | `gh workflow run "Upload CDN Assets"`，注意 `cdn-asset-manifest.json` 的 localPath 必须真实存在 |
| 命名 | `lovart-flash-teaser-hero-20261009-v1.webp` / `lovart-flash-teaser-icon-20261009-v1.webp` |
| 前端落点 | 预告卡图标位 + 预告落页（`taro-engineer` 实现，flag 驱动） |

## 5. 验收清单（反通用测试）

- [ ] 2D 低多边形画感，与 landing hero 同语言（不是 3D 粘土、不是扁平矢量）
- [ ] 三个 NPC 是纯剪影，零面部细节，读作"害羞躲着"而非"潜伏"
- [ ] 悦仔 5 条识别锚点全部存活（毛色条纹/大耳/光泽眼/紫卫衣无字/领口墨镜）
- [ ] 全图零文字、零 logo、零水印
- [ ] Asset 1 顶部 40% 留白干净可压标题
- [ ] Asset 2 在 38px 下盒子+狼剪影仍可辨认
- [ ] 反通用测试："这张图能原样出现在任意约会 App 里吗？"——能 → 重做；不能 → 过
- [ ] 金色发光色谱与 landing 一致（`#FDE68A`/`#FBBF24`/`#F0A030`）
