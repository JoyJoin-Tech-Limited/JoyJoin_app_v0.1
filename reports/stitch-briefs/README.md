# Stitch Briefs — Execution Guide

> **Generated:** 2026-04-22  
> **Source:** Mini-Program UI Aesthetic Audit  
> **Total Briefs:** 7 screens

---

## How to Use These Briefs

Each brief is a self-contained Stitch prompt. To execute:

1. Open [Stitch](https://stitch.withgoogle.com) or use the Stitch MCP
2. Copy the "Stitch Prompt" section from the brief
3. Paste into Stitch
4. Review generated HTML/CSS
5. Export to Figma (optional) for handoff
6. Implement in Taro/WeChat Mini Program

---

## Brief Index

| # | Screen | Priority | Current | Target | File |
|---|--------|----------|---------|--------|------|
| 1 | LandingPage | P0 | C (30) | B+ (38) | [01-landing-page.md](01-landing-page.md) |
| 2 | Discover | P0 | C (29) | B (35) | [02-discover.md](02-discover.md) |
| 3 | EventDetail | P1 | C (27) | B (33) | [03-event-detail.md](03-event-detail.md) |
| 4 | Profile | P1 | C (30) | B (36) | [04-profile.md](04-profile.md) |
| 5 | Connections | P1 | C (28) | B (34) | [05-connections.md](05-connections.md) |
| 6 | EditProfile | P2 | C (26) | B (33) | [06-edit-profile.md](06-edit-profile.md) |
| 7 | InvitePage | P2 | C (28) | B (35) | [07-invite-page.md](07-invite-page.md) |

---

## Execution Order (Recommended)

### Phase 1: High Impact (Week 1)
1. **LandingPage** — First impression, biggest emotional lift
2. **Discover** — Most visited screen, core product

### Phase 2: Core Product (Week 2)
3. **EventDetail** — High conversion intent
4. **Profile** — Identity celebration, frequent visits

### Phase 3: Social & Growth (Week 3)
5. **Connections** — Social core
6. **EditProfile** — Profile completeness
7. **InvitePage** — Viral growth

---

## Asset Dependencies

Some briefs need illustration assets from **Lovart** before Stitch layout:

| Asset | For Brief | Tool | Priority |
|-------|-----------|------|----------|
| 3 hero card illustrations (饭局/酒局/户外) | #1 LandingPage | Lovart | P0 |
| Xiaoyue "gift" pose | #7 InvitePage | Lovart | P1 |
| Xiaoyue "coaching" pose | #4 Profile | Lovart | P1 |
| Event card hero gradients | #2 Discover | Stitch can generate |
| Connection empty state | #5 Connections | Lovart | P2 |

---

## Quick Wins Already Completed

Before running Stitch, the following fixes were already applied:

- ✅ Gradient backgrounds fixed in 20 files (brand token `$color-bg-gradient`)
- ✅ XiaoyueChatBubble added to Profile, Rewards, EditProfile
- ✅ Connections avatars now use archetype colors
- ✅ LandingPage card borders now use brand tokens
- ✅ ArchetypeGlyph added to Profile header
- ✅ Discover loading text color fixed to use token

These changes are in `main` and improve the baseline for all Stitch redesigns.

---

## Expected Overall Impact

| Metric | Before | After (Quick Wins + Stitch) |
|--------|--------|----------------------------|
| Grade A screens | 0 | 0 |
| Grade B screens | 6 | 13 (+7) |
| Grade C screens | 22 | 15 (-7) |
| Avg score | 31.2 | ~35.5 |

---

## Notes

- All briefs include **brand injection** (colors, font, mascot, illustration style)
- All briefs specify **WXSS-safe constraints** (no backdrop-filter, Flexbox, transform/opacity animations)
- All briefs are **mobile-first** (375px viewport)
- Stitch output is HTML/CSS only — engineering handoff requires Taro conversion
