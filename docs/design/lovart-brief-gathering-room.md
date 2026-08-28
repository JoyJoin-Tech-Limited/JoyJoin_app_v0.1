# Lovart Brief — 集结房间像素场景（gathering room）

> 日期：2026-08-07
> 状态：Phase A · 已交付（2026-08-10）。运行时不再新建 SD 像素形象，角色层直接复用现有 V2 纸娃娃 + 装备体系；场景交付为单张合成 WebP，MVP 不需要分层动画。
> 绑定规范：场景美术仍遵循 `docs/design/sd-pixel-avatar-style-guide.md` 的 T1–T7 视觉令牌（色板、描边、光照、网格）。产品背景：`docs/product/gathering-room-prd.md`。

## Goal

绘制集结房间的场景本体：一间**暖木日式小店（居酒屋气质的小餐馆）**像素场景，45° 俯视，作为 6 人局线上候场空间的舞台。房间是真实线下活动的「线上前厅」——它要读起来像「我们周六要去的那家店」，不是幻想世界。

场景叙事四要素，缺一不可：

1. **一张 6 人桌**（画面中心，一切的焦点；桌面是逐日演化覆盖层的载体）
2. **一扇门**（入场编排的舞台——队友推门走进来）
3. **一扇夜景窗**（时间流逝的指示器——窗外是夜，窗里是灯）
4. **一盏暖主灯**（全场唯一光源，悬挂在桌上方）

## Brand Parameters

- **品牌色必须落位（风格规范 T1）：** 品牌紫 `#8B5CF6` 出现在**灯罩**上；暖珊瑚 `#FF9B85` 出现在**桌布**上；暖米 `#F5F1E8` 出现在**墙面**上
- **去宅化路径 = 配色克制**，不是高饱和堆料：全场暖木棕 + 米白 + 品牌三点缀色，除此之外不新增高饱和色。居酒屋气质靠暖光与木材质感表达，不靠灯笼/日文招牌/动漫道具
- **家具克制，留白慷慨：** 角色（6 个 SD 小人）才是主角，场景大量负空间留给角色站位与走动区域。除四要素外最多 2–3 件环境道具（如墙角矮柜、一株小绿植）
- **无文字：** 场景内不出现任何可读文字、招牌字、菜单字

## Asset Specifications

- **Type:** environment-scene (pixel art, layered)
- **Platform:** mini-program（集结房间视口，宽 750rpx）
- **Canvas:** 512 × 384 px（32 × 24 块 16px 瓦片，对齐风格规范 T3 网格；4:3，运行时以整数倍缩放铺满 750rpx 宽视口）
- **视角：** 45° 俯视（T5）——桌面与地面纵深可读，墙面约占画面上 1/3
- **光影：** 全场只有桌上方那盏暖主灯一个光源（T4）：灯下最亮，向四周渐暗；每件家具 1 个椭圆投影 + 受光侧 1px 高光；禁止复杂 shading。灯光光锥作为**独立图层**交付（见下）
- **描边：** 1px 彩色描边（基色同色相明度 30%），禁止纯黑（T2）
- **用色：** 整体 ≤32 色（T1）
- **Export format:** 单张合成 WebP（不透明背景，750×960 px，≈82 KB）——运行时直接作为背景层，角色（V2 纸娃娃 + 装备）由代码浮层叠加。分层 PNG（门、窗、灯罩）仅在未来需要开门动画/时间状态变体/换肤时才拆分，MVP 不需要。
- **File-size budget:** 单张 ≤ 200 KB

## 演化与换肤的结构约束

- **桌面演化：** `room-table-v1.png` 的桌面区域必须是平整、低细节的色块平面，并在源文件中标注桌面矩形坐标（写进交付说明）——代码将在其上叠加「订位卡 → 餐具」的逐日演化小图层
- **可换肤结构（为 Phase 2 预留，本期不做皮肤）：** 分层必须保证「换肤 = 替换同结构图层」。三档皮肤（破冰局 / 畅聊局 / 狂欢局）Phase 2 才做，但本期的图层拆分、锚点、瓦片网格必须让换肤只改美术不改代码结构。**本期交付物不包含任何皮肤变体。**

## Style Reference

Upload these reference images to Lovart ChatCanvas before generating:

1. **角色风格帧（必传）：** 现有 V2 纸娃娃风格帧（`assets-source/profile-pixel-v2/<archetype>/atlas-source.png`，如 corgi）—— 场景与角色共享描边规则、光影方向、色板克制；场景的像素颗粒度必须与 V2 角色一致。
2. **氛围口述锚点：** 深夜食堂式的暖木小店——但去掉所有文字招牌与日式杂物堆叠，只留暖光、木纹、留白。

> **形象策略变更（2026-08-10）：** 集结房间不再新建 SD 像素形象，直接复用现有 V2 纸娃娃 + 装备体系。场景只需保证「空位留给角色」即可，无需绘制角色。

## Prompt Draft (for Lovart ChatCanvas)

```
Create a pixel-art interior scene on a 512x384 px canvas (a strict 16x16 px tile grid, 32x24 tiles), 45-degree top-down view: a cozy warm-wood Japanese-style small restaurant room — an intimate izakaya-like little eatery, quiet and warm. This is the online waiting room for 6 real people before their offline dinner, so it must read as "the little restaurant we'll go to on Saturday", not a fantasy world.

Composition (four required narrative elements):
1. CENTERPIECE: one six-person dining table at the center of the room, covered with a tablecloth in warm coral #FF9B85. The tabletop surface must be a clean, flat, low-detail plane (overlay cards and tableware will be layered on it later by code).
2. DOOR: one door on the back wall — the stage where arriving friends walk in.
3. WINDOW: one window showing a night view (deep blue night sky, a few tiny distant warm window lights) — the time-passage indicator.
4. MAIN LAMP: one warm hanging lamp above the table with a soft brand-purple #8B5CF6 lampshade — the SINGLE light source of the whole scene.

Walls in warm beige #F5F1E8, floor in warm wood brown. Furniture is restrained: besides the four elements above, at most 2-3 quiet props (e.g. a low wooden cabinet, one small green plant). Generous negative space on the floor around the table — six small chibi characters will stand/sit there later; keep those areas clean and uncluttered.

Lighting: the hanging lamp is the only light source — brightest under the lamp, gently dimming toward the corners; each furniture piece gets exactly ONE elliptical floor shadow and a 1px highlight on its lit side. No complex shading, no ambient occlusion, no gradients beyond the soft falloff of light.

CRITICAL outline rule: all outlines are exactly 1px and COLORED — outline color is the same hue as each fill color with lightness reduced to 30%. NEVER pure black outlines.

Palette discipline: at most 32 colors total. Warm wood browns + warm beige + the three brand accents (purple lampshade, coral tablecloth, beige walls). No other high-saturation colors. De-otaku through palette restraint: NO lanterns, NO Japanese signage, NO anime props, NO text anywhere.

DELIVERY AS SEPARATE LAYERS (transparent-background PNGs, same 512x384 canvas, aligned to the same tile grid):
- Layer 1: far wall + floor (bottom layer)
- Layer 2: table with coral tablecloth (clean flat tabletop)
- Layer 3: door (separate layer for door-open animation)
- Layer 4: night-view window (separate layer for later time-state variants)
- Layer 5: warm lamp light cone (top layer, semi-transparent warm glow)
Also deliver one flattened composite preview of all layers combined.

Style: soft premium doujin pixel art, matching the reference character sprite's outline treatment and pixel granularity. Clean pixel clusters, no anti-aliasing, no text, no watermark.
```

## Export Requirements

- **Source file naming:** `room-composite-v1.png` (original), repair output is `room-composite-v2.webp`
- **Runtime asset:** `room-composite-v2.webp`（750×960 px，≤100 KB；2026-08-27 窗框错位修复，registered in `cdn-asset-manifest.json` and bundled locally under `src/assets/gathering-room/`；v1 保留作回滚）
- **Save location:** `assets-source/gathering-room/`
- **交付说明（随资产附 README 或在交付消息中写明）：** 桌面矩形坐标（像素）、6 个座位锚点坐标、灯中心点坐标（供代码对齐角色站位）
- **运行时接入：** 集结房间实现期注册 CDN manifest + 单张背景图；本 brief 已随 2026-08-10 实现落地，后续皮肤/动画变体另行立项

## Review Checklist

- [ ] 四要素齐全：6 人桌居中 / 门 / 夜景窗 / 暖主灯
- [ ] 品牌三色落位正确：灯罩 `#8B5CF6`、桌布 `#FF9B85`、墙面 `#F5F1E8`
- [ ] 单一光源成立：全场光影方向一致，只有一个灯
- [ ] 描边全彩无纯黑；与角色风格帧颗粒度一致
- [ ] 留白充足：桌周地面可站 6 个 100–130px 角色不拥挤
- [ ] 桌面平整低细节，可承载覆盖层；桌面坐标已标注
- [ ] 无文字、无招牌、无高饱和杂色、无宅化道具
- [ ] 5 层独立 PNG 对齐同一网格，合成预览与分层一致
- [ ] 单层 ≤60 KB，合计 ≤250 KB
- [ ] 真机视口（750rpx 宽）整数倍缩放显示不糊（T6）

## Downstream handoff

- **集结房间前端：** 座位锚点交给房间实现；MVP 使用单张合成背景 + 角色浮层，如需未来开门/换肤动画再回退到分层合成。
- **Phase 2 皮肤：** 换肤时沿用本图层结构与锚点，仅替换美术；皮肤 brief 另行立项（破冰局 / 畅聊局 / 狂欢局三档）。
