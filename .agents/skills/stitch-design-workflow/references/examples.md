# Stitch Design Workflow — Examples

## Example 1: Onboarding welcome screen

**User says:** "Explore a warm onboarding welcome screen for new users after personality test completion."

**Apply this skill by:**
1. Selecting the archetype mascot (Corgi — 开心柯基 — for celebration)
2. Injecting brand colors and illustration style
3. Using the onboarding prompt template

**Generated prompt:**
```
Generate a warm mobile onboarding welcome screen for a social gathering app.

Layout:
- Top half: A joyful corgi mascot (开心柯基) in circular vignette, sitting with a small open gift box, tail wagging. Low-poly geometric illustration style with painterly textures.
- Middle: Large headline "欢迎加入悦聚" in thin rounded geometric Chinese display font. Subheadline: "你的专属社交旅程即将开始" in clean legible sans-serif.
- Bottom: Primary CTA button "去发现活动" with rounded corners (24px radius), Vibrant Purple #8B5CF6 background, white text.

Brand colors:
- Page background: Warm Beige #F5F1E8
- CTA button: Vibrant Purple #8B5CF6
- Headline: Dark Gray #374151
- Mascot accent: Warm Coral #FF9B85 for confetti dots

Style (插画风):
- 2D low-poly geometric illustration
- Painterly textured rendering within polygonal facets
- Soft gradients within facets
- Atmospheric textured background with subtle grain
- Circular vignette for character

Typography feel:
- Chinese display: thin rounded geometric sans-serif
- Body: clean legible sans-serif
- English accent: soft geometric sans-serif (Quicksand feel)

Mood: Celebratory, welcoming, warm, premium.
Platform: Mobile web, 375×667px.
```

**Result:** Stitch generates 2–4 screen variations. Pick the best, export to Figma for refinement, then implement in `apps/user-client/src/features/onboarding/...`.

---

## Example 2: Event pool discovery card

**User says:** "Design a discovery card for event pools that feels exclusive but approachable."

**Apply this skill by:**
1. Using the event pool card template
2. Injecting brand colors with specific roles
3. Specifying the card structure

**Generated prompt:**
```
Generate a mobile event discovery card for a curated social gathering app.

Card structure:
- Rounded corners (20px radius), soft shadow
- Warm Beige #F5F1E8 card background
- Top: Small image area with soft gradient overlay
- Middle: Pool title "周末盲盒饭局" in Chinese display font, single line
- Meta row: "周六 18:00 · 静安寺 · 4-6人" in secondary gray
- Bottom: Price tag "¥128" in Vibrant Purple #8B5CF6, "立即加入" CTA button

Brand colors:
- Card background: Warm Beige #F5F1E8
- CTA / price: Vibrant Purple #8B5CF6
- Hot indicator badge: Warm Coral #FF9B85
- Meta text: Medium Gray #9CA3AF
- Primary text: Dark Gray #374151

Layout:
- Generous padding (20px)
- Breathing space between elements
- Single card centered on screen for focus

Mood: Exclusive, surprising, premium but friendly.
Platform: Mobile web, 375×667px.
```

**Result:** Stitch generates card variations. Figma refine → implement as shared `PoolCard` component.

---

## Example 3: Empty state for no events

**User says:** "Create an empty state when a user has no upcoming events."

**Apply this skill by:**
1. Selecting the Koala replacement — Bear (暖心熊) for warm/empty feeling
2. Using the empty-state template
3. Injecting illustration style vocabulary

**Generated prompt:**
```
Generate a warm empty state screen for a social events app.

Layout:
- Center: A calm bear mascot (暖心熊) in circular vignette, holding a small empty calendar or tea cup. Low-poly geometric illustration with painterly textures.
- Below illustration: Headline "还没有活动安排" in thin rounded Chinese display font
- Sub-copy: "去发现有趣的聚会吧" in clean legible sans-serif, Medium Gray #9CA3AF
- Bottom: CTA button "去发现活动" with Vibrant Purple #8B5CF6 background, rounded corners

Brand colors:
- Background: Warm Beige #F5F1E8
- Illustration: natural warm palette, soft atmospheric background
- Headline: Dark Gray #374151
- Sub-copy: Medium Gray #9CA3AF
- CTA: Vibrant Purple #8B5CF6

Style (插画风):
- 2D low-poly geometric faceted construction
- Painterly textures within facets
- Soft gradients within individual facets
- Atmospheric grain background
- Circular vignette composition
- Minimal outlines

Mood: Calm, hopeful, inviting — not lonely or clinical.
Platform: Mobile web and WeChat Mini Program, 375×667px.
```

**Result:** Empty state concept for `apps/mini-program` and `apps/user-client` shared empty-state component.

---

## Example 4: Multi-screen onboarding flow (Stitch prototype)

**User says:** "Prototype a 3-step onboarding flow: setup → extended profile → review."

**Apply this skill by:**
1. Using Stitch's prototype linking feature
2. Generating each step with consistent brand injection
3. Connecting screens in Stitch canvas

**Step 1 prompt:**
```
Generate screen 1 of 3 for a mobile onboarding flow.

Screen: "基本信息" — User enters display name, selects gender, and sets current city.

Layout:
- Top: Progress indicator (step 1 of 3) with Vibrant Purple #8B5CF6 active dot
- Middle: Form fields — rounded input fields with Warm Beige #F5F1E8 background
- Bottom: Primary CTA "下一步" in Vibrant Purple #8B5CF6

Brand colors:
- Background: Warm Beige #F5F1E8
- Inputs: Soft White #FFFFFF with Medium Gray #9CA3AF border
- CTA: Vibrant Purple #8B5CF6
- Progress: Vibrant Purple #8B5CF6 active, Medium Gray #9CA3AF inactive

Typography: Chinese display for step title, system UI for labels and inputs.
Mood: Friendly, straightforward, welcoming.
```

**Step 2 and 3:** Follow the same brand injection pattern.

**Result:** Clickable 3-screen prototype in Stitch for stakeholder review before engineering.

---

## Example 5: Correcting off-brand output

**User says:** "Stitch gave me a screen with a neon purple gradient on white — fix it."

**Apply this skill by:**
1. Identifying the generic AI aesthetic violation
2. Re-prompting with explicit background and gradient rules

**Corrected prompt:**
```
Regenerate the previous screen with these corrections:

- Background MUST be Warm Beige #F5F1E8 — not white or gradient
- Purple (#8B5CF6) is ONLY for the primary CTA button and small accent badges
- NO full-screen purple gradients
- NO neon or harsh contrast
- Keep the warm, soft, premium feel
```

**Reference:** See `joyjoin-brand-guidelines` "Avoiding generic AI aesthetics" table for the full guardrail list.
