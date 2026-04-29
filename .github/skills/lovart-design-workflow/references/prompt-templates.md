# Asset Type Prompt Templates

## 1. Mascot / Brand Illustration

**Use for:** Character artwork, scene illustrations, emotional moments, empty/loading states.

**Brief template:**
```
Goal: [Single sentence — what feeling or moment this illustration conveys]

Character: [Archetype animal] in [pose/action] expressing [emotion]
Scene: [Setting/context — minimal background or specific location]
Style (插画风):
- 2D digital illustration with low-poly / geometric faceted aesthetic
- Painterly, textured rendering with soft brushed feel within each facet
- Soft gradients within polygonal facets
- Minimal or no outlines — facet edges define form
- Atmospheric textured background with subtle grain/noise
- Circular vignette composition for character portraits
Brand colors: Vibrant Purple #8B5CF6 [as accent/highlight/background], Warm Coral #FF9B85 [as ...], Warm Beige #F5F1E8 [as ...]
Typography feel: [If text included — rounded Chinese display (AlimamaFangYuanTiVF feel), soft geometric English (Quicksand feel)]
Mood: [warm/playful/calm/celebratory/etc.]
Composition: [Centered / left-weighted / full-bleed / with breathing space]
Export: PNG with transparency, [dimensions], [minimum resolution]
```

## 2. UI Mockup / Screen Design

**Use for:** New screen layouts, component visuals, onboarding page mockups, feature preview images.

**Brief template:**
```
Goal: [What this screen does and who uses it]

Platform: [Web (React/Vite) / WeChat Mini Program (Taro) / Both]
Screen type: [Full page / Modal / Card / Bottom sheet]
Layout direction: [Top-down hero + form / Two-column / Centered content / List]
Key components: [Header / Illustration area / Form fields / CTA button / Footer]
Brand colors: Vibrant Purple #8B5CF6 [primary CTA], Warm Beige #F5F1E8 [background], Soft White #FFFFFF [cards], Medium Gray #9CA3AF [borders]
Typography: Chinese display font feel for headlines, clean sans-serif for body.
Illustration: [Include mascot? Which one? Pose?]
Mood: [Functional / Friendly / Premium / Playful]
Export: [PNG / JPG], [aspect ratio], [dimensions], [show mobile frame Y/N]
```

## 3. Marketing / Social Media

**Use for:** Event posters, social media graphics, share cards, promotional banners, App Store screenshots.

**Brief template:**
```
Goal: [Campaign objective — drive registrations, announce event, celebrate milestone]

Format: [Instagram post / Story / WeChat Moment / Banner / Poster / Share card]
Aspect ratio: [1:1 / 9:16 / 16:9 / 4:5 / 1080x1920]
Copy placement: [Headline position / Body text position / CTA placement]
Headline: [Text content if known, or "placeholder for headline"]
Visual focal point: [Mascot / Product UI screenshot / Abstract illustration / Photography]
Brand colors: [Full palette with specific roles]
Mood: [Energetic / Calm / Exclusive / Playful / Surprising]
Export: [PNG / JPG / PDF], [resolution], [color profile if print]
```

## 4. Icon / Icon Set

**Use for:** Tab bar icons, feature icons, action buttons, empty state icons.

**Brief template:**
```
Goal: [Icon purpose — navigation, action, status, feature identification]

Set size: [Single icon / Set of N icons]
Style: [Line icon / Filled icon / Duotone / Gradient]
Stroke weight: [Thin / Regular / Bold]
Corner treatment: [Rounded / Sharp / Mixed]
Color mode: [Monochrome (specify color) / Multi-color (specify palette)]
Size context: [24px toolbar / 48px feature / 96px empty state]
Consistency: All icons in the set must share the same stroke weight, corner radius, and visual weight.
Export: SVG (preferred for web), PNG (for mini-program where SVG support is limited)
```

## Prompt Engineering Best Practices

1. **Conversational, not mechanical.** Lovart's ChatCanvas responds better to design briefs than rigid prompt syntax.
2. **Lead with the feeling, then the details.** Example: *"This should feel like a warm invitation to a surprise party"* before listing hex codes.
3. **Always include exact hex codes.** Do not say "our brand purple" — say "Vibrant Purple #8B5CF6".
4. **Specify aspect ratio and export format.** Prevents rework.
5. **Reference Nano Banana Pro style when useful.** Mention *"professional digital painting style, Nano Banana Pro quality"* for fidelity.
6. **Use ChatCanvas annotations for iteration.** After first generation, annotate specific areas.
7. **Request variations for key decisions.** Ask for 2–3 variations with different compositions or color weights.
