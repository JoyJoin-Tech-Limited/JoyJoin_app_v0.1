# Design Guidelines: Local Micro-Events Social Network

## Design Approach: Reference-Based (Social Community + Experience Platforms)

**Primary References:** Bumble BFF (warmth & belonging), Airbnb Experiences (curated local experiences), Meetup (event discovery), with elements of LinkedIn Events (professionalism)

**Core Principles:**
- Warmth over sterility: Foster psychological safety through soft, inviting aesthetics
- Clarity over cleverness: Transparent matching reasons and event details
- Belonging over transactions: Community-first visual language
- Accessibility as foundation: Mobile-first, inclusive, screen-reader friendly

---

## Color Palette

**Light Mode:**
- Primary: 280 45% 55% (Warm purple - trust, community, belonging)
- Primary Dark: 280 50% 45%
- Background: 0 0% 99%
- Surface: 0 0% 100%
- Text Primary: 220 15% 20%
- Text Secondary: 220 10% 45%
- Border: 220 10% 88%
- Success: 145 60% 45% (confirmations, matches)
- Warning: 35 85% 60% (safety alerts)

**Dark Mode:**
- Primary: 280 50% 65%
- Primary Dark: 280 55% 55%
- Background: 220 15% 10%
- Surface: 220 12% 14%
- Text Primary: 0 0% 95%
- Text Secondary: 220 8% 65%
- Border: 220 10% 22%
- Success: 145 55% 55%
- Warning: 35 80% 65%

**Accent Colors (used sparingly):**
- Compatibility indicators: 160 45% 50% (teal), 45 75% 60% (coral), 200 50% 55% (sky blue)

---

## Typography

**Font Stack:**
- Primary: 'Inter', -apple-system, system-ui (UI elements, body text)
- Display: 'Outfit', sans-serif (headings, hero text)

**Scale:**
- Hero: text-5xl md:text-6xl font-bold (display font)
- H1: text-4xl md:text-5xl font-bold
- H2: text-3xl md:text-4xl font-semibold
- H3: text-2xl md:text-3xl font-semibold
- H4: text-xl md:text-2xl font-medium
- Body Large: text-lg font-normal
- Body: text-base font-normal
- Small: text-sm font-normal
- Caption: text-xs font-medium

---

## Layout System

**Spacing Primitives:** Tailwind units 2, 4, 6, 8, 12, 16, 24
- Micro spacing (cards, buttons): p-4, p-6
- Section padding: py-12, py-16, py-24
- Container gaps: gap-6, gap-8, gap-12

**Grid System:**
- Mobile: grid-cols-1
- Tablet: grid-cols-2 (event cards, features)
- Desktop: grid-cols-3 (event discovery), grid-cols-4 (category filters)

**Container Widths:**
- Full-width sections: w-full with max-w-7xl mx-auto
- Content sections: max-w-6xl mx-auto
- Forms/questionnaires: max-w-2xl mx-auto
- Reading content: max-w-prose

---

## Component Library

### Core Navigation
- **Sticky Header:** bg-surface/90 backdrop-blur-md, shadow-sm, logo left, nav center, user avatar/CTA right
- **Mobile Nav:** Bottom tab bar with icons (Home, Events, Profile, Matches), safe-area padding
- **Breadcrumbs:** For event detail flows, text-sm with > separators

### Event Cards
- **Compact Card:** Rounded-2xl, overflow-hidden, image aspect-video, gradient overlay on image, attendee count badge, match % indicator
- **Detailed Card:** Adds host info, venue details, accessibility icons, "Why this match?" expandable section
- **Grid Layout:** grid gap-6, 1 col mobile, 2 cols tablet, 3 cols desktop

### Profile Components
- **Compatibility Bar:** Horizontal progress bar with gradient, percentage label, animated fill
- **Personality Radar:** SVG chart showing 5-6 dimensions (personality traits from Big Five model)
- **Social Role Cards:** Display user's primary and secondary social role archetypes

### Forms & Questionnaires
- **Progress Indicator:** Stepped circles with connecting lines, current step highlighted
- **Question Cards:** Large rounded cards with single question, radio/checkbox styled as rounded buttons with icons
- **Slider Inputs:** Custom styled range inputs with labels at ends (Introvert ← → Extrovert)
- **Multi-select Tags:** Pill buttons that fill on select, allow multiple selections

### Event Detail Page
- **Hero Section:** Full-width image h-64 md:h-96, gradient overlay, title + quick info overlay at bottom
- **Info Grid:** 2-column on desktop (left: details, right: attendees preview + booking card)
- **Sticky Booking Card:** Fixed on desktop, bottom sheet on mobile, contains CTA, price, attendee faces

### Feedback & Ratings
- **Star Rating:** Large interactive stars (text-3xl), with hover states
- **Match Quality Slider:** 0-10 scale with emoji indicators at key points
- **Quick Reactions:** Emoji-based buttons for speed (😊 Great atmosphere, 🤝 Made connections, etc.)

### Admin Panel
- **Data Tables:** Striped rows, sortable headers, search/filter bar, action buttons right-aligned
- **Event Creator:** Multi-step form (Details → Attendees → Schedule → Review)
- **Dashboard Cards:** Stats with icons, trend indicators, charts using recharts library

### Trust & Safety
- **Verification Badges:** Small icons next to usernames (✓ ID verified), tooltip on hover
- **Safety Banner:** Top of event pages, soft background, icon + concise text + "Read guidelines" link
- **Report Button:** Subtle flag icon, opens modal with categories and description field

---

## Interaction Patterns

**Micro-interactions:**
- Card hover: translate-y-[-4px] + shadow-lg transition
- Button press: scale-95 active state
- Loading states: Skeleton screens with pulse animation for cards
- Success feedback: Checkmark animation + brief confetti on RSVP

**Page Transitions:**
- Slide-in modals for forms (transform + opacity)
- Fade transitions for page changes
- Stagger animation for event card lists (delay-[100ms] increments)

**Empty States:**
- Centered illustrations (use placeholder comments), large text, friendly CTA

---

## Images

**Hero Image:** 
- Landing page hero: Warm, diverse group of 6-8 people laughing at a casual event (coffee shop/outdoor setting), aspect ratio 16:9, full-width, h-screen on desktop, h-[70vh] mobile

**Supporting Images:**
- Event cards: Venue/activity photos, aspect-video, object-cover
- Attendee avatars: Circular, w-10 h-10, stacked with -ml-2 for groups
- Empty states: Friendly illustrations (calendar, people connecting, stars aligning)
- Features section: 3 images showing app screens or event moments in rounded devices

**Image Treatment:**
- Subtle border-radius (rounded-xl to rounded-2xl)
- Gentle gradient overlays for text readability
- Lazy loading with blur placeholders

---

## Accessibility & Responsive Behavior

- Touch targets min 44x44px
- Focus rings: ring-2 ring-primary ring-offset-2
- Form labels always visible (no placeholder-only inputs)
- Dark mode toggle in header, persistent preference
- Reduced motion support: prefers-reduced-motion query for animations
- Screen reader: aria-labels on icon buttons, landmark regions
- Mobile: Bottom sheet modals, sticky CTAs, collapsible sections

---

## Key Page Layouts

**Landing Page:** Hero with image + centered value prop → 3-column feature grid → testimonial carousel → "How it works" stepped cards → Final CTA

**Event Discovery Feed:** Filter bar (sticky) → Personalized recommendations section → Grid of event cards → "More events" infinite scroll

**Onboarding Flow:** Full-screen cards with progress bar → Single question per screen → Summary page with profile preview → "Find your first event" CTA

**Event Detail:** Image hero → Sticky booking sidebar (desktop) / bottom CTA (mobile) → Info tabs (Details, Attendees, Host, Venue) → Similar events carousel

**User Profile:** Cover gradient + avatar → Stats row (events attended, matches made) → Social role cards → Personality profile → Activity timeline