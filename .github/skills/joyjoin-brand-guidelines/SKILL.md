---
name: joyjoin-brand-guidelines
description: >
  Apply JoyJoin brand guidelines across UI, marketing, social, offline, and motion design. Use this
  skill when work must stay consistent with JoyJoin's visual identity, emotional tone, and brand
  system. Trigger phrases: "make this on-brand", "does this fit JoyJoin style?", "which colour
  should I use?", "is this too corporate?", "review this design for brand consistency".
---

Use this skill for any JoyJoin design task that must follow the brand system clearly and consistently.

## Brand Essence

JoyJoin is an AI-powered social mini app for curated 4-6 person offline gatherings.
It should feel: warm, friendly, playful, surprising, premium but approachable.

Core idea: Not awkward chatting. Not random socializing. A carefully planned small-group gathering that feels like opening a surprise box.

## Brand Pillars

- **Authentic Connection** — real human interaction
- **Surprise Experience** — each gathering feels fresh and delightful
- **Warm Socializing** — friendly, safe, emotionally welcoming

## Audience

Urban young adults looking for high-quality social experiences and real connection.

## Visual Tone

Design should feel: warm, cute, rounded, soft, lively, minimal, refined, breathable.
Avoid anything too corporate, cold, flashy, harsh, or overdesigned.

## Logo Guidance

The logo system centers on: a purple gift box, three mascot characters (corgi, koala, turtle), and the idea of surprise + warm gathering.

Rules: keep clear space, do not stretch/rotate/recolor, avoid busy backgrounds, keep readable at small sizes.

## Color System

Use these exact core colors: Vibrant Purple `#8B5CF6`, Warm Coral `#FF9B85`, Sky Blue `#A8C5DD`, Fresh Green `#9ACD32`, Warm Beige `#F5F1E8`, Soft White `#FFFFFF`, Medium Gray `#9CA3AF`, Dark Gray `#374151`.

Principles: purple is the anchor; secondary colours are soft support; use exact HEX values.

## Typography

JoyJoin uses a **three-role semantic typography system**. See [`references/typography.md`](./references/typography.md) for font roles, usage rules, and Taro loading notes.

## Mascots & Illustration

JoyJoin's visual identity is built around **12 archetype animals** that map to the personality system's canonical archetypes. See [`references/mascots-and-illustration.md`](./references/mascots-and-illustration.md) for the full roster and illustration style vocabulary (插画风).

## UI / Layout Guidance

- Use warm beige or soft light backgrounds
- Prefer rounded cards and soft spacing
- Keep layouts clean and breathable
- Use purple for primary actions
- Use mascots or brand graphics sparingly and intentionally
- Keep interfaces premium, light, and welcoming

## Motion Guidance

Motion should feel: gentle, smooth, premium, restrained. Prefer soft easing, calm transitions, and polished reveals. Avoid loud, bouncy, or distracting animation.

## Do / Don't

| Do | Don't |
|---|---|
| Keep the brand warm and human | Make it look corporate or enterprise |
| Use rounded forms and soft spacing | Use harsh contrast or aggressive effects |
| Maintain minimalist but friendly aesthetic | Overuse colours or mascots |
| Let premium quality come from restraint | Make it feel cold, lonely, or overly serious |
| Reinforce surprise, warmth, and connection | Turn playfulness into childish clutter |

## Avoiding generic AI aesthetics

JoyJoin screens should be unmistakably JoyJoin. See [`references/design-tooling-and-frontend.md`](./references/design-tooling-and-frontend.md) for generic patterns to avoid, the design direction test, design tooling pipeline, and frontend excellence notes.

## Output Standard

Every JoyJoin design output should feel: consistent, emotionally warm, visually soft and polished, simple but memorable, premium, playful, and approachable.

## Quick examples

**"Make this button feel more on-brand."** → Use Vibrant Purple (`#8B5CF6`), rounded corners, soft spacing, brand font for label text.

**"Can I add a mascot to this empty-state screen?"** → Choose the mascot whose personality fits the moment. Keep it soft-lined, cute but tasteful, no clutter.

## Troubleshooting

- **Looks too corporate or cold** → Use Warm Beige or `--background` token. Prefer rounded forms over sharp angles.
- **Too many colours or mascots in one view** → Reduce to purple as anchor; demote others to accents. One mascot per screen, intentionally.
- **Inconsistent typography** → `font-cn-display` for short emotional Chinese; `font-en-brand` for English brand moments; `font-ui` for everything else. Never mix display fonts on the same screen.
- **Motion feels loud or distracting** → Remove bouncy keyframes or aggressive fade speeds. Keep transitions gentle and restrained.

## Review checklist

- [ ] Primary action colour is Vibrant Purple; secondary colours are accents only
- [ ] Typography uses correct role: `font-cn-display` / `font-en-brand` / `font-ui`
- [ ] Layout feels breathable — rounded corners, soft spacing, no harsh contrast
- [ ] Mascots or illustrations used intentionally and only once per view
- [ ] Motion is gentle and premium — no loud or bouncy animations
- [ ] Design feels warm and premium, not corporate, cold, or cluttered
