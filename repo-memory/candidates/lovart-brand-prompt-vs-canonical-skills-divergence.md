---
id: repo.brand.lovart-prompt-canonical-divergence
title: Lovart brand prompt divergence from canonical skill system — analysis and reconciliation path
status: candidate
owner: brand-and-frontend-governance
lastValidatedAt: 2026-04-22
tags:
  - brand
  - lovart
  - typography
  - illustration-style
  - skill-governance
  - frontend
  - design-system
triggerTerms:
  - Lovart brand prompt
  - Alimama FangYuanTi
  - low-poly illustration
  - brand font change
  - mascot roster
  - illustration style lock
relatedPaths:
  - .github/skills/joyjoin-brand-guidelines/SKILL.md
  - .github/skills/lovart-design-workflow/SKILL.md
  - .github/skills/design-system-governance/SKILL.md
  - .github/skills/mini-program-frontend-excellence/SKILL.md
  - .github/skills/wow-elements/SKILL.md
  - .github/skills/frontend-component-architecture/SKILL.md
  - apps/user-client/src/assets/fonts/fonts.css
  - apps/user-client/tailwind.config.ts
sources:
  - Lovart-generated brand prompt (user-submitted, 2026-04-22)
  - .github/skills/joyjoin-brand-guidelines/SKILL.md (canonical)
  - .github/skills/lovart-design-workflow/SKILL.md (canonical)
confidence: high
---

## Summary

A Lovart-generated brand prompt was submitted for analysis. It conflicts with the canonical skill system on **typography**, **color palette scope**, **mascot roster**, and **document purpose**. The prompt is a high-quality **image generation brief**, not a frontend implementation governance document. This note captures every divergence, the reconciliation path, and specific skill-patch recommendations.

## Divergence Matrix

| Dimension | Lovart Prompt | Canonical Skill System | Verdict |
|-----------|--------------|------------------------|---------|
| **Document purpose** | AI image generation template for Lovart ChatCanvas | Frontend implementation governance (tokens, fonts, platforms, a11y) | **Different roles — do not merge** |
| **Chinese font** | Alimama FangYuanTi VF-Thin (阿里妈妈方圆体) | AlibabaPuHuiTi-3 + system fallbacks | **Conflict — product decision required** |
| **English font** | Quicksand | Quicksand | **Aligned** |
| **Color palette** | Purple #8B5CF6 + warm earth tones only | 8-color system with defined roles | **Lovart under-specifies; skill is authoritative** |
| **Mascot roster** | 12 animals (corgi, koala, turtle + fox, owl, elephant, cat, dolphin, hamster, octopus, spider, chick) | 3 core mascots only | **Lovart extends; product confirmation needed** |
| **Illustration style** | "2D low-poly geometric with painterly textures, circular vignettes, grain/noise" | "Rounded, soft-lined, cute but tasteful, emotionally positive" | **Lovart is more specific; enrich `lovart-design-workflow`** |
| **Platform awareness** | None | Web + Taro mini-program, WXSS-safe, bundle size, subpackages | **Skill is strictly superior for implementation** |
| **Accessibility** | None | WCAG 2.1 AA, reduced motion, touch targets ≥44 pt | **Skill is strictly superior** |
| **Anti-generic guardrails** | None (actually encourages purple-gradient-on-white) | Explicit table of patterns to avoid | **Skill is strictly superior** |
| **Typography roles** | Single font per language | Three-role semantic system (UI / cn-display / en-brand) | **Skill is strictly superior** |
| **Reference URLs** | External Lovart CDN URLs | None (self-contained) | **Skill is more durable** |

## Analysis by Dimension

### 1. Typography — CRITICAL CONFLICT

The Lovart prompt specifies **Alimama FangYuanTi VF-Thin** as the Chinese font. The canonical system specifies **AlibabaPuHuiTi-3**.

- **Current implementation:** `apps/user-client/src/assets/fonts/fonts.css` self-hosts AlibabaPuHuiTi-3 via `@font-face`. Tailwind config maps `font-cn-display` to this font.
- **Mini-program reality:** No custom fonts are bundled. System fonts are used.
- **Switching to FangYuanTi would require:**
  1. Font file procurement and licensing verification
  2. CDN hosting for mini-program (cannot bundle variable fonts inline)
  3. Update `@font-face` declarations in `fonts.css`
  4. Update `tailwind.config.ts` font stack
  5. Design team sign-off on visual change
  6. Regression testing across all `font-cn-display` surfaces

**Recommendation:** Treat as a **product-level brand decision**, not a skill update. The skill should document the **currently implemented** font. If product approves a switch, update implementation first, then skills.

### 2. Color Palette — LOVART UNDER-SPECIFIES

The Lovart prompt reduces the palette to "purple + warm natural earth tones." The canonical skill defines 8 exact colors with usage principles.

The Lovart prompt's narrow palette, if used for UI mockups, would produce the exact "generic AI aesthetic" the skill warns against:
- Purple gradient on plain white → **explicitly listed as generic pattern to avoid**
- Uniform card grids with no hierarchy → **no color differentiation guidance**
- Harsh contrast avoidance → **misunderstood as "only use earth tones"**

**Recommendation:** The `lovart-design-workflow` skill already correctly injects all 8 colors. No change needed. If Lovart outputs drift toward purple-washed designs, the brief should explicitly reference secondary colors.

### 3. Mascot Roster — ENRICHMENT OPPORTUNITY

The Lovart prompt introduces 9 additional mascots beyond the canonical 3.

| Mascot | Status in Canonical Skill | Personality (from Lovart) |
|--------|--------------------------|---------------------------|
| Corgi | Core | Warm, social, energetic |
| Koala | Core | Gentle, healing, empathetic |
| Turtle | Core | Steady, thoughtful, reliable |
| Fox | Extended (Lovart only) | Geometric, clever |
| Owl | Extended (Lovart only) | Wise, nocturnal |
| Elephant | Extended (Lovart only) | Strong, gentle giant |
| Cat | Extended (Lovart only) | Independent, curious |
| Dolphin | Extended (Lovart only) | Playful, aquatic |
| Hamster | Extended (Lovart only) | Small, energetic |
| Octopus | Extended (Lovart only) | Multi-tasking, creative |
| Spider | Extended (Lovart only) | Intricate, web-weaving |
| Chick | Extended (Lovart only) | Young, hopeful |

**Recommendation:** The extended roster may be intentional for **event themes, seasonal campaigns, or pool archetype illustrations**. Do NOT add to `joyjoin-brand-guidelines` until product confirms. Instead, enrich `lovart-design-workflow` with an "Extended Mascot Roster" subsection gated by a comment: *"Use only when product has approved extended characters for this campaign."*

### 4. Illustration Style — LOVART-SPECIFIC ENRICHMENT

The "2D low-poly geometric with painterly textures" description is highly specific and valuable for **asset generation**. It should live in `lovart-design-workflow`, not the canonical brand skill.

Style elements to capture:
- Low-poly / faceted construction with triangular polygons
- Soft brushed/painterly textures within facets
- Soft gradients within polygonal facets (not across the whole image)
- Minimal or no outlines
- Atmospheric grain/noise backgrounds
- Circular vignettes for character portraits
- Rounded silhouettes with geometric construction

**Recommendation:** Add a "JoyJoin Illustration Style Vocabulary" section to `lovart-design-workflow` that captures these descriptors as **prompt injection material**.

### 5. Document Purpose — SEPARATION OF CONCERNS

The Lovart prompt includes:
- Generation prompt templates with fill-in brackets
- Quality checklists for generated images
- Application examples (social media post, app UI mockup, avatar, banner)
- Key rules for iteration

These are all **Lovart ChatCanvas input artifacts**.

The canonical brand skill includes:
- Tailwind class names and CSS variable mappings
- Token ownership and variant discipline
- Platform-specific implementation notes (Taro vs Web)
- Accessibility and performance constraints
- Review checklists for code review

These are **frontend implementation governance artifacts**.

**Recommendation:** Maintain strict separation. Lovart prompt content enriches `lovart-design-workflow`. Canonical brand skill remains the implementation authority.

## Recommended Skill Patches

### Patch A: `lovart-design-workflow` — Enrich illustration style vocabulary

Add a new subsection under "JoyJoin Brand Injection":

```markdown
### Illustration style vocabulary (for Lovart prompts)

When requesting character illustrations or mascot artwork, use these descriptors:

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Atmospheric textured washes with subtle grain/noise
- **Characters:** Geometric polygonal bodies, large expressive glossy eyes, simplified features, warm expressions
- **Composition:** Circular vignettes for portraits, centered subjects, generous negative space
- **Color treatment:** Natural warm palette (earth tones, pastels, muted colors); brand purple #8B5CF6 for key elements only

**Note:** This vocabulary is for asset generation only. Frontend implementation follows the canonical color token system and typography roles defined in `joyjoin-brand-guidelines`.
```

### Patch B: `lovart-design-workflow` — Extended mascot roster (gated)

Add after the existing mascot table:

```markdown
### Extended mascot roster (campaign use only)

Use these only when product has explicitly approved extended characters for a campaign, event theme, or seasonal pool.

| Mascot | Personality | Suggested use |
|--------|-------------|---------------|
| Fox | Clever, adaptable | Strategy themes, autumn events |
| Owl | Wise, calm | Evening gatherings, knowledge-sharing pools |
| Elephant | Gentle, strong | Team-building, large-group themes |
| Cat | Independent, curious | Solo-traveler themes, creative pools |
| Dolphin | Playful, aquatic | Summer events, water-themed pools |
| Hamster | Energetic, compact | Speed-dating, quick-match themes |
| Octopus | Creative, multi-faceted | Arts & crafts, multi-activity events |
| Spider | Intricate, connected | Networking, web-of-connections themes |
| Chick | Young, hopeful | New-user onboarding, first-timer events |
```

### Patch C: `joyjoin-brand-guidelines` — NO PATCH (defend current state)

The canonical skill is **stronger** than the Lovart prompt for frontend implementation. Resist pressure to:
- Replace AlibabaPuHuiTi-3 with Alimama FangYuanTi without product approval
- Narrow the 8-color palette
- Add low-poly illustration rules to implementation guidance
- Import Lovart CDN URLs

### Patch D: `design-system-governance` — NO PATCH

Token system is complete and correct. No action.

### Patch E: `mini-program-frontend-excellence` / `wow-elements` / `frontend-component-architecture` — NO PATCH

These skills are correctly scoped and do not need Lovart-specific content.

## Promotion Criteria

Promote this candidate when:
- **Patch A** (illustration style vocabulary) is merged into `lovart-design-workflow`
- **Patch B** (extended mascot roster) is merged into `lovart-design-workflow`
- OR product explicitly approves/rejects the font switch and mascot extension, and the skill system is updated to reflect the decision

## Risk If Ignored

1. **Font drift:** A future agent or contributor sees the Lovart prompt and changes implementation to Alimama FangYuanTi without licensing/hosting checks, breaking the mini-program.
2. **Color narrowing:** Lovart-generated mockups use only purple + beige, leading to purple-washed UI that violates the anti-generic guardrails.
3. **Purpose confusion:** Frontend engineers use the Lovart prompt as implementation guidance, missing platform constraints, accessibility, and token discipline.
4. **Mascot inflation:** Extended mascots appear in product UI without brand approval, diluting the core 3-character identity.
