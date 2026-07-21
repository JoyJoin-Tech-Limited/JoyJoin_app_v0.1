# Lovart Brief — HD-2D Identity Stage backgrounds

**Sprint:** `sprint_20260720_hd2d_identity_stage`  
**Runtime manifest:** `apps/mini-program/src/assets/profile-pixel/v2/stage-assets-v1.json`  
**Target platform:** WeChat Mini-Program, CDN-hosted WebP  
**Source output path:** `assets-source/profile-pixel-v2/stage/`

## What we need

Two environment background images for the **Profile identity-stage hero card** (the HD-2D stage). The avatar in front is a 512×768 pixel-art paper-doll (`PixelAvatarComposite`), currently rendered at top-right of the card. The stage renders layers in this order:

1. **Far background** (`far-bg-v1.webp`) — distant city plane, pre-baked soft blur/depth-of-field.
2. **Mid background** (`mid-bg-v1.webp`) — closer ambient plane behind the avatar, warm light sources.
3. Avatar (existing; not part of this brief).
4. Rim-light + particles + warm grade overlay (code-only; not part of this brief).

No characters, no text, no UI. These are environmental scenes only.

## Dimensions & format

The stage fills the full-width identity-stage hero card. The card is a **landscape banner/card shape** (~5:4 aspect ratio), not a portrait or a small square avatar box.

- **Canvas:** 960 × 768 px (5:4). This gives ~8% overshoot on all sides so the 12s camera drift (scale up to 1.08) and subtle translation never bleed edges.
- **Safe live area:** 840 × 672 px centered, matching the visible card bounds. Keep important lighting/placement inside this safe area.
- **Avatar occlusion zone:** **lower-right quadrant** (~right 40%, bottom 55%). The avatar will stand on the street/plaza ground in this zone, so the mid-bg must provide a clean, readable ground plane here. The far-bg skyline sits behind and above the avatar.
- **UI reserved zones:** the bottom-left ~55% of the card is reserved for a left-bottom UI panel (text labels + small icons). Keep that area relatively clean and high-contrast readable.
- **Format:** WebP, opaque (no transparency needed).
- **File-size budget:** each ≤ 200 KB; combined ≤ 800 KB.
- **Delivery filenames:**
  - `far-bg-v1.webp`
  - `mid-bg-v1.webp`

## Brand & art direction

**Concept:** 霓虹未眠，但灯是暖的 — keep the cyber-city depth, but the light is warm.

- **Mood & city identity:** Cozy neon **Shenzhen**. The scene should read as a warm, young, tech-meets-bay-city night — recognizable as Shenzhen at a glance, but not a tourist postcard. Depth comes from a modern skyline silhouette, bay-side reflections, and warm-lit street-level storefronts. The emotional temperature is warm, inviting, and slightly magical — not cold, crypto, or dystopian.
- **Light sources:** Warm gold / sunset pink (`#FFD27F` landed-gold family, `#FF9B85` Warm Coral as accent). Think sunset-afterglow store signs, warm street lamps, golden window glow.
- **Cold purple (`#8B5CF6` Vibrant Purple):** allowed **only** in the far-background plane, and only as distant accents (neon signs far away, sky gradients). It must read as "background atmosphere," not as the dominant light.
- **Shenzhen landmarks:** Use **silhouette / atmospheric** treatment only — e.g. Ping An Finance Centre needle, Shenzhen Bay skyline cluster, mangrove/waterline hint, tech-campus grid lights. Landmarks must be subtle background flavor, not focal points, and must sit inside the safe live area.
- **No text** in the artwork (no neon sign copy, no unreadable glyphs).
- **No characters** other than the avatar that will be layered on top.
- **Style recommendation:** Pixel-art environmental illustration to match the existing pixel avatar. If Lovart cannot lock pixel-art reliably, fall back to the brand low-poly / geometric-faceted painterly style — but a visual clash with the pixel avatar is a rejection risk.

## Reference

- The neon-city corgi reference shared in the sprint thread (cyberpunk city street, corgi in JoyJoin hoodie holding phone) is the **vibe reference** — but the final background must be the **warm-toned, Shenzhen-specific variant** described above, not the original cold purple/cyan version.
- `apps/mini-program/src/components/profile/IdentityStageScene.scss` defines the CSS color grade; the art should harmonize with warm gold/sunset-pink overlays.

## Lovart prompts

### Far background (`far-bg-v1.webp`)

```
Create a 960x768 pixel-art environmental background for a mobile app profile hero card. Aspect ratio 5:4 landscape. Scene: a soft-focus distant Shenzhen skyline at dusk/night, viewed from a low bay-side street angle. Reco<SECRET_KEY>hint of the Ping An Finance Centre needle and the Shenzhen Bay skyline cluster in soft silhouette on the left/center, plus a subtle waterline/mangrove reflection at the bottom. Pre-baked depth-of-field blur: edges and distant lights are soft, no sharp detail. Palette: deep twilight blues and purples in the far sky, with cold neon purple #8B5CF6 used ONLY for tiny distant signs and far-building edge accents on the left/center. The dominant light sources are warm gold #FFD27F and sunset-pink #FF9B85 glowing from windows, street lamps, and signage in the mid-distance. The **lower-right quadrant** should remain darker and less detailed because a full-body pixel avatar will stand there on the mid-ground street. Mood: cozy neon Shenzhen, warm and inviting, not dystopian. No characters, no text, no UI, no brand logos. Pixel-art style, soft grain, 2D illustration. Safe live area 840x672 centered; keep important detail inside it.
```

### Mid background (`mid-bg-v1.webp`)

```
Create a 960x768 pixel-art environmental mid-ground for a mobile app profile hero card. Aspect ratio 5:4 landscape. Scene: a warm Shenzhen street / plaza plane where a full-body pixel avatar will stand at the **lower-right**. The ground plane (pavement, plaza tiles, or street) must extend clearly into the lower-right quadrant so the avatar looks like it is standing on the surface, not floating. Suggest a young tech-city neighborhood: glass storefronts, warm-lit café awnings, bike-lane bokeh, maybe a subtle tech-campus grid of windows. Strong warm light sources in warm gold #FFD27F and sunset-pink #FF9B85 — store awnings, soft bokeh lamps, warm window glow — concentrated toward the center-left to frame the right-side avatar zone. Some cooler shadow tones for contrast, but NO cold purple or blue neon dominance. Shallow depth: slightly softer than foreground, sharper than far-bg. Atmospheric haze and soft grain. No characters, no text, no UI, no brand logos. Pixel-art style matching a cute mascot avatar. Safe live area 840x672 centered.
```

## Review checklist (from `joyjoin-brand-guidelines` / `lovart-design-workflow`)

- [ ] Warm, not cold or clinical
- [ ] Cute but tasteful
- [ ] No harsh crypto/cyberpunk coldness
- [ ] Cold purple (`#8B5CF6`) only in far-bg and only as distant accent
- [ ] Shenzhen identity reads clearly but landmarks stay atmospheric/silhouette, not focal
- [ ] Warm gold / sunset-pink light sources dominant in mid-bg
- [ ] No text, characters, or brand logos
- [ ] File sizes ≤ 200 KB each
- [ ] Pixel-art style consistent with the avatar, or intentionally switched to brand low-poly with design approval
- [ ] 5:4 landscape canvas with safe 840×672 live area
- [ ] Lower-right quadrant provides a clear ground plane for the standing avatar
- [ ] Bottom-left ~55% stays clean enough for a UI text panel
- [ ] Right-side avatar zone is not visually noisy

## Brand sign-off gate

Do not upload these to the runtime CDN path `/assets/profile-pixel/v2/stage/` and do not enable `profileIdentityStageEnabled` until this brief has been reviewed and approved by the brand reviewer. The runtime code is live but the flag is `false` by default; missing art falls back to the existing static identity card.

## Post-approval steps

1. Export final `far-bg-v1.webp` and `mid-bg-v1.webp` meeting size budgets.
2. Upload to `https://<cdn>/assets/profile-pixel/v2/stage/`.
3. Update `apps/mini-program/src/assets/profile-pixel/v2/stage-assets-v1.json` `artStatus` from `awaiting-approved-art` to `approved` and record the approval date + reviewer in the contract Negotiation Log.
4. Only then may `profileIdentityStageEnabled` be enabled in a controlled rollout.
