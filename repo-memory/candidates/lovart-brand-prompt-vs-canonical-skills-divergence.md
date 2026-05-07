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
  - archived/workspaces/user-client/src/assets/fonts/fonts.css
  - archived/workspaces/user-client/tailwind.config.ts
sources:
  - .github/skills/joyjoin-brand-guidelines/SKILL.md
  - .github/skills/lovart-design-workflow/SKILL.md
confidence: high
---

## Summary

A Lovart-generated brand prompt was submitted for analysis. It conflicts with the canonical skill system on **typography**, **color palette scope**, **mascot roster**, and **document purpose**. The prompt is a high-quality **image generation brief**, not a frontend implementation governance document.

**CRITICAL FINDINGS from Product Manager follow-up investigation:**
1. **Live cross-platform font divergence:** The mini-program ALREADY ships `AlimamaFangYuanTiVF-Thin` via `Taro.loadFontFace()`. The web client still uses `AlibabaPuHuiTi-3`. The brand skill's claim that "mini-program uses system fonts only" is **factually incorrect**.
2. **Product already has 12 archetype animals:** The personality system (`packages/shared/src/personality/prototypes.ts`) defines 12 canonical archetypes: 开心柯基, 太阳鸡, 夸夸豚, 机智狐, 淡定海豚, 织网蛛, 暖心熊, 灵感章鱼, 沉思猫头鹰, 定心大象, 稳如龟, 隐身猫. The brand skill's "3 core mascots" is out of sync with product reality.
3. **Internal SCSS inconsistency:** The mini-program's `_variables.scss` archetype colors use `破壳小鸡` (Chick) and `奇趣浣熊` (Raccoon) for the last two slots, while `prototypes.ts` uses `稳如龟` (Turtle) and `隐身猫` (Cat). This is a live codebase drift.

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

### 1. Typography — LIVE CROSS-PLATFORM DIVERGENCE

**Discovery:** The mini-program ALREADY uses `AlimamaFangYuanTiVF-Thin`. The web client still uses `AlibabaPuHuiTi-3`. This is a **live inconsistency**, not a theoretical proposal.

| Platform | Actual Font | Skill Claim | Status |
|----------|------------|-------------|--------|
| Web (user-client) | AlibabaPuHuiTi-3 via `@font-face` | AlibabaPuHuiTi-3 | ✓ Correct |
| Mini-program | AlimamaFangYuanTiVF-Thin via `Taro.loadFontFace()` | "System fonts only" | ✗ **FALSE** |

**Files:**
- Web: `archived/workspaces/user-client/src/assets/fonts/fonts.css` (lines 48–56, 117)
- Mini-program: `apps/mini-program/src/lib/brandFont.ts` (lines 8–48), `apps/mini-program/src/styles/_variables.scss` (lines 33–35)

**Recommendation:** Unify to **AlimamaFangYuanTiVF-Thin everywhere**. Rationale:
- The launch-primary client (mini-program) already uses it.
- The font file is already in the repo.
- Keeping two fonts for the same semantic role is architectural debt.
- **Blocker:** Design sign-off + legibility QA on web at small sizes.

**Skill update:** `joyjoin-brand-guidelines` must correct the false "system fonts only" claim. The skill should document the **actual** state: "Web uses AlibabaPuHuiTi-3; mini-program uses AlimamaFangYuanTiVF-Thin. Unification to FangYuanTi on web is pending design approval."

### 2. Color Palette — LOVART UNDER-SPECIFIES

The Lovart prompt reduces the palette to "purple + warm natural earth tones." The canonical skill defines 8 exact colors with usage principles.

The Lovart prompt's narrow palette, if used for UI mockups, would produce the exact "generic AI aesthetic" the skill warns against:
- Purple gradient on plain white → **explicitly listed as generic pattern to avoid**
- Uniform card grids with no hierarchy → **no color differentiation guidance**
- Harsh contrast avoidance → **misunderstood as "only use earth tones"**

**Recommendation:** The `lovart-design-workflow` skill already correctly injects all 8 colors. No change needed. If Lovart outputs drift toward purple-washed designs, the brief should explicitly reference secondary colors.

### 3. Mascot Roster — SKILL IS OUT OF SYNC WITH PRODUCT REALITY

**Discovery:** The product ALREADY has **12 canonical archetype animals** defined in `packages/shared/src/personality/prototypes.ts`:

| Archetype Name | Animal | English | In Lovart Prompt? |
|---------------|--------|---------|-------------------|
| 开心柯基 | Corgi | Corgi | ✓ |
| 太阳鸡 | Rooster | Sun Chicken | ✗ (has "Chick" instead) |
| 夸夸豚 | Dolphin (Praise) | Praise Dolphin | ✓ (as Dolphin) |
| 机智狐 | Fox | Clever Fox | ✓ |
| 淡定海豚 | Dolphin (Calm) | Calm Dolphin | ✓ (as Dolphin) |
| 织网蛛 | Spider | Web-weaving Spider | ✓ |
| 暖心熊 | Bear | Warm-heart Bear | ✗ (has "Koala" instead) |
| 灵感章鱼 | Octopus | Inspiration Octopus | ✓ |
| 沉思猫头鹰 | Owl | Contemplative Owl | ✓ |
| 定心大象 | Elephant | Steady-heart Elephant | ✓ |
| 稳如龟 | Turtle | Steady Turtle | ✓ |
| 隐身猫 | Cat | Invisible Cat | ✓ |

**Lovart prompt mismatches:**
- **Koala** → Product uses **Bear** (暖心熊), not Koala.
- **Hamster** → Not in any archetype.
- **Chick** → Product uses Rooster (太阳鸡) and Turtle (稳如龟); the SCSS has 破壳小鸡 but prototypes has 稳如龟.
- Two dolphins in archetypes (夸夸豚, 淡定海豚) — Lovart prompt lists only one "Dolphin".

**Internal codebase inconsistency:** The mini-program's `_variables.scss` archetype colors use `破壳小鸡` (Chick) and `奇趣浣熊` (Raccoon) for the last two slots, while `prototypes.ts` uses `稳如龟` (Turtle) and `隐身猫` (Cat). This is live drift between SCSS and the canonical archetype definitions.

**Recommendation:**
1. **Align brand skill to 12 archetypes.** The archetype system is server-driven and user-facing; the brand system should reflect it.
2. **Document Lovart-only animals (Koala, Hamster) as NOT APPROVED** in both skills.
3. **Fix the SCSS vs. prototypes mismatch** — determine whether the canonical names are Turtle+Cat (prototypes) or Chick+Raccoon (SCSS), then align both files.

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

### Patch B: `lovart-design-workflow` — Archetype mascot roster (canonical 12)

Replace the existing 3-mascot table with the canonical 12 archetypes:

```markdown
### Archetype mascot roster (canonical 12)

These 12 animals map to the personality system's archetype prototypes. Use them for all product-facing illustrations, result screens, and empty states.

| Archetype | Animal | Personality | Best used for |
|-----------|--------|-------------|---------------|
| 开心柯基 | Corgi | Playful, energetic, optimistic | Celebration, onboarding welcome, action moments |
| 太阳鸡 | Rooster | Bright, confident, energetic | Morning events, leadership themes |
| 夸夸豚 | Praise Dolphin | Supportive, complimentary, warm | Social bonding, affirmation moments |
| 机智狐 | Fox | Clever, adaptable, strategic | Problem-solving, game nights |
| 淡定海豚 | Calm Dolphin | Steady, peaceful, balanced | Relaxation, mindfulness events |
| 织网蛛 | Spider | Intricate, connected, detailed | Networking, craft workshops |
| 暖心熊 | Bear | Warm, strong, protective | Trust moments, group hugs, winter themes |
| 灵感章鱼 | Octopus | Creative, multi-faceted, curious | Arts, brainstorming, multi-activity |
| 沉思猫头鹰 | Owl | Wise, contemplative, observant | Knowledge sharing, book clubs |
| 定心大象 | Elephant | Steady, reliable, grounding | Team building, reassurance |
| 稳如龟 | Turtle | Patient, persistent, thoughtful | Step-by-step progress, loading states |
| 隐身猫 | Cat | Independent, curious, adaptable | Solo activities, creative exploration |

**Not approved:** Koala and Hamster are NOT part of the canonical archetype system. Do not generate them without explicit Product approval.
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
- **Patch B** (canonical 12-archetype mascot roster) is merged into `lovart-design-workflow`
- `joyjoin-brand-guidelines` is updated to document the **actual** font state (AlibabaPuHuiTi-3 on web, AlimamaFangYuanTiVF-Thin on mini-program) and the **actual** mascot roster (12 archetypes)
- The SCSS vs. prototypes archetype name mismatch (Chick+Raccoon vs. Turtle+Cat) is resolved
- OR product explicitly approves/rejects the font unification and the skill system is updated to reflect the decision

## Risk If Ignored

1. **Font drift:** The web and mini-program already use different fonts for the same semantic role. Every new `font-cn-display` surface increases the unification cost.
2. **Skill lies to agents:** `joyjoin-brand-guidelines` falsely claims "mini-program uses system fonts only." Future agents will make incorrect implementation decisions based on this falsehood.
3. **Color narrowing:** Lovart-generated mockups use only purple + beige, leading to purple-washed UI that violates the anti-generic guardrails.
4. **Purpose confusion:** Frontend engineers use the Lovart prompt as implementation guidance, missing platform constraints, accessibility, and token discipline.
5. **Mascot inconsistency:** The brand skill documents 3 mascots while the product has 12 archetypes. This causes brand assets to mismatch user-facing archetype results.
6. **SCSS/prototypes drift:** The archetype color names in `_variables.scss` do not match `prototypes.ts`. This could cause the wrong colors to appear for archetype results.
