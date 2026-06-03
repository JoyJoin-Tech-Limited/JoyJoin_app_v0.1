---
name: ui-layout-audit
description: Pixel-perfect UI/UX audit skill for JoyJoin screens. Enforces 排版合理性 (layout rationality), clear spacing hierarchy, zero-emojis on primary copy, and reading experience that feels like a treat. Use when a screen feels off, before shipping UI, or when reviewing mini-program/web components for premium fit. Trigger phrases: "audit this screen", "check layout", "spacing review", "pixel perfect check", "polish this UI", "layout feels off", "why does this look cheap", "read like a treat".
---

# UI Layout Audit

Expert UI/UX reviewer with pixel-level eyesight. Read every screen as a user, not a developer. The goal: every line of text and every element should feel like a treat to the eyes.

## When to use this skill

- A screen or component looks "cheap", crowded, or unbalanced
- Before merging UI-heavy PRs (especially onboarding, icebreaker, personality test)
- Question text or primary copy contains emojis that dilute seriousness
- Spacing between sections feels arbitrary or inconsistent
- Typography lacks clear hierarchy (heading vs body vs meta)
- Reading a block of text feels tiring or rushed

## Standard spacing values

Use these defaults for consistency across all JoyJoin screens. Deviations are allowed with documented justification.

| Token | Value | Usage |
|-------|-------|-------|
| `$spacing-xs` | 8rpx | Tight internal padding (chip gutters, icon-text pairs) |
| `$spacing-sm` | 16rpx | Minimal gap (list item internal padding, tight card groups) |
| `$spacing-md` | 24rpx | **Default inter-section gap** — gap between sibling white cards, shell column gap |
| `$spacing-lg` | 40rpx | Generous internal padding (card body padding, hero inset) |
| `$spacing-xl` | 64rpx | Major section breaks (page top padding, footer reserves) |
| `$spacing-2xl` | 96rpx | Page bottom safe-area reserve |

**ResponsiveSpacer defaults:**
- Tight spacing between related elements: `heightRpx={16}`
- **Default spacing between white card sections: `heightRpx={16}`** (was 24rpx — tightened 2026-06-03)
- Generous spacing between major sections: `heightRpx={32}`
- Never use `heightRpx < 12` (feels accidental) or `> 48` without structural purpose

**Card internal padding:**
- Standard white card (`card-premium`): `padding: $spacing-lg` (40rpx)
- Compact card (dense lists, small screens): `padding: $spacing-md` (24rpx)
- Hero card (celebratory, visual-heavy): `padding: $spacing-lg` (40rpx) — never less

**Shell gap hierarchy:**
- `gap: $spacing-md` (24rpx) — default for `page-shell-padding` flex columns
- `gap: $spacing-lg` (40rpx) — only when the page has <4 sections and needs breathing room
- Never mix `gap` and `ResponsiveSpacer` redundantly — pick one per section pair

## Grill-me stress-test

After scoring a screen, run [`references/grill-me-checklist.md`](references/grill-me-checklist.md) — a one-question-per-turn interview that defends every spacing, typography, and visual-coherence decision. Every finding must be tied to a concrete measurement, not a vibe.

## Audit workflow

1. **Layer inventory**: List every visual layer from top to bottom
2. **Spacing map**: Measure vertical gaps between layers. Flag gaps <16rpx (too tight) or >80rpx without structural purpose (too loose). Compare against **Standard spacing values** above.
3. **Typography hierarchy**: Verify heading/body/meta have at least 8rpx size difference and distinct weight/color
4. **Emoji scan**: Primary questions, headings, and CTA labels must be emoji-free. Emojis allowed only in: mascot speech, decorative badges, result celebration states
5. **Alignment check**: Left edges of text blocks must share a 4rpx grid
6. **Safe area & compression**: On 375×667 (iPhone SE), no interactive element should be <88rpx tall or <200rpx from bottom without scroll
7. **Reading experience** (the treat test): Chinese body text line-height ≥1.6, display text ≥1.4. No paragraph >10 lines without visual relief. Text should invite the eye, not exhaust it
8. **Visual coherence (孤字 guard)**: No headline or button text should produce a lone word/character on its own row. Use `word-break: keep-all` for short display text; ensure container width ≥ font-size × 8. English words in Chinese copy must never break mid-word
9. **Emotional craft**: Every element should feel intentional, not assembled. Flag placeholder-like spacing, default-looking borders, or "that'll do" visual decisions. Cross-reference with `docs/reference/emotional-value-rubric.md`: does this layout feel generous (归属感) or cramped (transactional)?

## Reading experience rules

- Chinese body text: line-height ≥1.6, measure (line length) ≤30 Chinese characters
- Display/headline text: line-height ≥1.4. 1.28 or lower feels suffocating
- Paragraph spacing should be ≥0.8× font-size. Tight paragraphs feel like a wall of text
- Two heavy visual elements (large text + large image) back-to-back need breathing room (≥32rpx)

## Visual coherence rules

- Headlines, banners, buttons: `word-break: keep-all` + ensure container ≥ font-size × 8 wide. If the text is longer, the container must be wider — never let a headline break into a 2-character orphan line
- English words inside Chinese copy: wrap in `nowrap` or use `word-break: keep-all` so "Livehouse" never becomes "Liveh-ouse"
- Narrow cards (e.g., 240rpx wide): labels must be ≤6 characters at 32rpx, or the card will force 孤字
- `overflow-wrap: anywhere` is banned on display text — it treats all break points as equal and produces visual chaos

## Quick examples

- **Audit personality test question screen**: Progress bar → mascot header → question banner → answer area → skip button. Check each gap is 24rpx or 32rpx. Ensure scenarioText has no leading emojis. Answer pills need 16rpx internal padding. Question banner at 52rpx needs line-height ≥1.4, not 1.28.
- **Spacing hierarchy fix**: If section A and B both have 24rpx gap, but B is a sub-item of A, B should be 16rpx and A 32rpx to show nesting.
- **Reading experience fix**: A 52rpx headline with 1.28 line-height feels cramped. Bump to 1.4–1.5 so ascenders/descenders breathe.

## Troubleshooting

**Audit feels subjective** — Tie every finding to a number (rpx value, emoji count, line-height, layer depth). "Feels tight" → "gap is 12rpx; standard is 24rpx".

**Too many issues found** — Prioritize: (1) emoji in primary questions, (2) reading comfort (line-height/measure), (3) inconsistent spacing between layers, (4) typography hierarchy, (5) micro-alignment.

## Review checklist

- [ ] Every layer has a documented vertical gap to its neighbor
- [ ] Primary questions, headings, CTAs contain zero emojis
- [ ] Heading/body/meta sizes differ by ≥8rpx and ≥100 font-weight
- [ ] Chinese body text line-height ≥1.6; display text ≥1.4
- [ ] No dense text wall >10 lines without visual relief
- [ ] No headline/button produces a lone character on its own row
- [ ] English words in Chinese copy do not break mid-word
- [ ] No orphan elements <8rpx from screen edge or sibling
- [ ] Interactive hit areas ≥88rpx tall (mini-program) or ≥44px (web)
- [ ] Reduced-motion fallback is considered for animation-heavy layouts
- [ ] Grill-me interview completed for any score < 80% (see `references/grill-me-checklist.md`)
