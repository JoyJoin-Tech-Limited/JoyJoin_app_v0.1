---
name: joyjoin-brand-guidelines
description: >
  Apply JoyJoin brand guidelines across UI, marketing, social, offline, and motion design. Use this
  skill when work must stay consistent with JoyJoin's visual identity, emotional tone, and brand
  system. Trigger phrases: "make this on-brand", "does this fit JoyJoin style?", "which colour
  should I use?", "is this too corporate?", "review this design for brand consistency".
---

# JoyJoin Brand Guidelines

## When to use this skill

- Choosing colors, typography, or mascots for a new screen or marketing asset
- Reviewing a design or PR for brand consistency and emotional tone
- Writing copy or selecting illustration style for user-facing surfaces
- Deciding whether a UI element feels "too corporate" or "off-brand"
- Creating motion, animation, or micro-interaction specs

## Brand Essence

JoyJoin is an AI-powered social mini app for curated 4-6 person offline gatherings.
It should feel: warm, friendly, playful, surprising, premium but approachable.

**Core idea:** Not awkward chatting. Not random socializing. A carefully planned
small-group gathering that feels like opening a surprise box.

## Brand Pillars

- **Authentic Connection** — real human interaction
- **Surprise Experience** — each gathering feels fresh and delightful
- **Warm Socializing** — friendly, safe, emotionally welcoming

## Audience

Urban young adults looking for high-quality social experiences and real connection.

## Visual Tone

Warm, cute, rounded, soft, lively, minimal, refined, breathable. Avoid corporate,
cold, flashy, harsh, or overdesigned.

## Color Palette Summary

| Role | HEX |
|------|-----|
| Primary (Vibrant Purple) | `#8B5CF6` |
| Warm Coral | `#FF9B85` |
| Sky Blue | `#A8C5DD` |
| Fresh Green | `#9ACD32` |
| Background (Warm Beige) | `#F5F1E8` |
| Soft White | `#FFFFFF` |
| Medium Gray | `#9CA3AF` |
| Dark Gray | `#374151` |

Purple is the anchor; secondary colours are soft support. Use exact HEX values.

For detailed logo rules, motion principles, voice/tone guide, offline materials,
and social-media rules, see [`references/brand-details.md`](./references/brand-details.md).

For typography roles and loading notes, see [`references/typography.md`](./references/typography.md).
For mascot roster and illustration style, see [`references/mascots-and-illustration.md`](./references/mascots-and-illustration.md).
For design-tooling pipeline and generic-aesthetic avoidance, see [`references/design-tooling-and-frontend.md`](./references/design-tooling-and-frontend.md).

## Quick examples

**"Make this button feel more on-brand."**
→ Vibrant Purple (`#8B5CF6`), rounded corners, soft spacing, brand font for label.

**"Can I add a mascot to this empty-state screen?"**
→ Choose the mascot whose personality fits the moment. Keep it soft-lined, cute
  but tasteful, no clutter.

## Troubleshooting

**Looks too corporate or cold**
→ Use Warm Beige or `--background`. Prefer rounded forms over sharp angles.

**Too many colours or mascots in one view**
→ Reduce to purple as anchor; demote others to accents. One mascot per screen.

**Inconsistent typography**
→ `font-cn-display` for short emotional Chinese; `font-en-brand` for English brand
  moments; `font-ui` for everything else. Never mix display fonts on the same screen.

**Motion feels loud or distracting**
→ Remove bouncy keyframes or aggressive fade speeds. Keep transitions gentle.

## Review checklist

- [ ] Primary action colour is Vibrant Purple; secondary colours are accents only
- [ ] Typography uses correct role: `font-cn-display` / `font-en-brand` / `font-ui`
- [ ] Layout feels breathable — rounded corners, soft spacing, no harsh contrast
- [ ] Mascots or illustrations used intentionally and only once per view
- [ ] Motion is gentle and premium — no loud or bouncy animations
- [ ] Design feels warm and premium, not corporate, cold, or cluttered
