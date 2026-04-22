# Lovart Design Brief: Corgi Welcome Illustration

## Goal
A warm, celebratory welcome illustration featuring the JoyJoin corgi mascot for the onboarding completion screen — making users feel rewarded, excited, and emotionally connected to the brand.

## Brand Parameters
- **Primary color:** Vibrant Purple `#8B5CF6` — gift box ribbon, confetti accents, small UI sparkles
- **Secondary color(s):**
  - Warm Coral `#FF9B85` — confetti dots, warm highlights on cheeks
  - Warm Beige `#F5F1E8` — soft background wash
  - Soft White `#FFFFFF` — eye highlights, small star accents
- **Background:** Warm Beige `#F5F1E8` with subtle radial gradient toward Vibrant Purple `#8B5CF6` at 10% opacity
- **Mascot:** Corgi (开心柯基) — playful, energetic, optimistic. Mid-jump or sitting proudly with tail wagging, front paws slightly raised as if greeting
- **Typography feel:** No text in the illustration itself — headline and body copy will be overlaid in the UI using the Chinese display font (AlibabaPuHuiTi-3 feel)
- **Visual tone:** warm, cute, rounded, soft, lively, minimal, refined, breathable

## Asset Specifications
- **Type:** mascot-illustration
- **Platform:** web + mini-program (both)
- **Dimensions:** 800 x 800 px (square, flexible cropping)
- **Aspect ratio:** 1:1
- **Export format:** PNG with transparency
- **Minimum resolution:** 2x for retina displays (1600 x 1600 px source)

## Prompt Draft

> Create a warm, celebratory welcome illustration for a social app onboarding screen.
>
> **Character:** A cute, playful corgi dog — round fluffy body, short legs, big expressive eyes, happy open-mouth smile with tongue slightly out. The corgi should feel energetic and optimistic, sitting proudly or in a small joyful bounce pose with its tail wagging. Front paws slightly raised as if happily greeting the user.
>
> **Scene & Composition:** Center the corgi in the frame with generous breathing space on all sides. Behind the corgi, place a small open gift box with a Vibrant Purple `#8B5CF6` ribbon spilling out. Scatter tiny confetti dots in Warm Coral `#FF9B85` and Vibrant Purple `#8B5CF6` around the character — keep it light, not cluttered.
>
> **Style:** Soft-lined illustration with rounded, organic shapes. Warm pastel tones, minimal background detail. The corgi's fur should feel fluffy and textured but not hyper-realistic — think modern app illustration style, cute but tasteful. No sharp edges or harsh shadows.
>
> **Color palette:**
> - Background: soft Warm Beige `#F5F1E8` with a very subtle radial glow
> - Gift box ribbon: Vibrant Purple `#8B5CF6`
> - Confetti accents: Vibrant Purple `#8B5CF6` and Warm Coral `#FF9B85`
> - Corgi fur: natural warm orange/tan with cream belly and chest
> - Cheek blush: soft Warm Coral `#FF9B85` at low opacity
> - Eye highlights: Soft White `#FFFFFF`
>
> **Mood:** Celebratory, welcoming, warm, like receiving a surprise gift from a friend. The user just finished onboarding and this moment should feel rewarding and delightful.
>
> **No text** in the illustration — text will be added in the UI layer above.
>
> **Export:** PNG with transparent background, 1600 x 1600 px (2x retina), clean edges around the corgi silhouette.

## Export Requirements
- **File naming:** `lovart-mascot-corgi-welcome-20260422-v1.png`
- **Save location:**
  - Web: `apps/user-client/src/assets/lovart/`
  - Mini-program: `apps/mini-program/src/assets/lovart/`
- **Lazy loading:** Yes — load after critical UI renders
- **subpackage:** Main bundle (illustration is needed on onboarding completion screen)

## Review Checklist
- [ ] Brand colors match JoyJoin palette exactly (`#8B5CF6`, `#FF9B85`, `#F5F1E8`)
- [ ] Corgi personality is playful, energetic, and optimistic — consistent with 开心柯基 character guide
- [ ] No text embedded in the illustration (legibility handled in UI overlay)
- [ ] Rounded, soft shapes — no sharp edges or cold textures
- [ ] PNG with transparency, 2x resolution for retina
- [ ] Generous breathing space around the character for flexible cropping
- [ ] Confetti is subtle and celebratory, not distracting
- [ ] Warm, cute, premium feel — never corporate or childish
