# Wow Elements — Reference Examples

Concrete implementation examples for the patterns described in `../SKILL.md`.

---

## 1. Premium button completion feedback

A primary CTA (e.g. "Join Event", "Confirm Payment") should give the user a brief, satisfying signal that their action was received — not just a spinner.

```tsx
// apps/mini-program/src/components/PremiumCtaButton.tsx
import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface PremiumCtaButtonProps extends React.ComponentProps<typeof Button> {
  isSuccess?: boolean;
}

export function PremiumCtaButton({
  isSuccess,
  children,
  ...props
}: PremiumCtaButtonProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={
        isSuccess && !reduceMotion
          ? { scale: [1, 1.04, 1] }
          : { scale: 1 }
      }
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <Button {...props} variant="default" size="lg">
        {isSuccess ? '✓ Done' : children}
      </Button>
    </motion.div>
  );
}
```

**Why this works:**
- Scale pulse is ≤ 250ms — fast enough to feel responsive, not slow
- `useReducedMotion` disables the pulse for users who need it
- Visual state (`✓ Done`) communicates success even without motion
- Only `transform` is animated — no layout shift

---

## 2. Onboarding first-load staggered entrance

The first authenticated screen a user lands on after completing sign-up. Content should appear as a composed, intentional reveal rather than a hard DOM paint.

```tsx
// apps/mini-program/src/pages/onboarding/OnboardingWelcome.tsx
import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const ITEMS = [
  { key: 'heading', delay: 0 },
  { key: 'subheading', delay: 0.08 },
  { key: 'cta', delay: 0.16 },
];

function FadeUp({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: reduceMotion ? 0 : delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export function OnboardingWelcome() {
  return (
    <div className="flex flex-col items-center gap-6 px-6 pt-12">
      <FadeUp delay={ITEMS[0].delay}>
        <h1 className="text-2xl font-semibold text-gray-800 text-center">
          Welcome to JoyJoin
        </h1>
      </FadeUp>
      <FadeUp delay={ITEMS[1].delay}>
        <p className="text-base text-gray-500 text-center max-w-xs">
          Your first gathering is waiting. Let's find your people.
        </p>
      </FadeUp>
      <FadeUp delay={ITEMS[2].delay}>
        <Button variant="default" size="lg" onClick={/* navigate to first step */}>
          Get started
        </Button>
      </FadeUp>
    </div>
  );
}
```

**Why this works:**
- Stagger is tight (80ms steps) — reads as a single composed reveal, not a slow sequence
- Only 3 elements stagger — adding more would feel heavy
- Each `FadeUp` is self-contained and reusable
- `reduceMotion` skips the initial state entirely, so content is immediately visible

---

## 3. Empty state with hope rather than deadness

An empty state (no matches yet, no events nearby, no connections) should feel like a warm invitation, not a failure.

```tsx
// apps/mini-program/src/components/EmptyState.tsx
import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface EmptyStateProps {
  illustration?: React.ReactNode;
  heading: string;
  body: string;
  action?: React.ReactNode;
}

export function EmptyState({ illustration, heading, body, action }: EmptyStateProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="flex flex-col items-center gap-4 py-16 px-6 text-center"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {illustration && (
        <div className="mb-2 text-5xl" aria-hidden="true">
          {illustration}
        </div>
      )}
      <h2 className="text-lg font-semibold text-gray-700">{heading}</h2>
      <p className="text-sm text-gray-400 max-w-xs">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}
```

**Usage:**
```tsx
import { Button } from '@/components/ui/button';

<EmptyState
  illustration="🐢"  // Turtle mascot — steady, thoughtful, reliable
  heading="No gatherings yet"
  body="Your first match is just around the corner. Check back soon."
  action={<Button onClick={handleRefresh}>Refresh</Button>}
/>
```

**Why this works:**
- Mascot illustration makes the empty state warm, not cold
- Copy is hopeful and human — not "No results found"
- Subtle scale + fade entrance makes the state feel intentional, not abandoned
- Action gives the user a clear next step

---

## 4. Loading state with crafted momentum

A loading skeleton should feel like content arriving, not content absent. A soft shimmer sweep reads as forward momentum rather than waiting.

```tsx
// packages/shared/src/ui/SkeletonCard.tsx
export function SkeletonCard() {
  return (
    <div
      className="rounded-2xl overflow-hidden bg-gray-100 animate-pulse"
      aria-hidden="true"
      role="presentation"
    >
      {/* Thumbnail area */}
      <div className="h-40 bg-gray-200" />

      {/* Content area */}
      <div className="p-4 flex flex-col gap-3">
        {/* Title line */}
        <div className="h-4 bg-gray-200 rounded-full w-3/4" />
        {/* Body lines */}
        <div className="h-3 bg-gray-200 rounded-full w-full" />
        <div className="h-3 bg-gray-200 rounded-full w-5/6" />
        {/* CTA placeholder */}
        <div className="h-9 bg-gray-200 rounded-xl mt-1 w-1/2" />
      </div>
    </div>
  );
}
```

**With a custom shimmer (Tailwind extension):**
```css
/* apps/mini-program/src/app.scss — add as a global utility */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-shimmer {
  background: linear-gradient(
    90deg,
    theme('colors.gray.100') 25%,
    theme('colors.gray.200') 50%,
    theme('colors.gray.100') 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
```

Replace `animate-pulse` with `animate-shimmer` for a more premium loading feel.

**Why this works:**
- Structure matches the real content's layout — no jarring reflow on load
- Shimmer sweep reads as momentum and arrival, not absence
- `aria-hidden` and `role="presentation"` keep it invisible to screen readers
- The actual content replaces the skeleton — no second layout shift
