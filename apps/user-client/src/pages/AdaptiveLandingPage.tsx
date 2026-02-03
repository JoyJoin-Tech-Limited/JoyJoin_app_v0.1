/**
 * Adaptive Landing Page
 * 
 * A beautiful, responsive landing page for JoyJoin with:
 * - 2x2 grid of lifestyle images with tilt effects
 * - Brand logo and gradient heading
 * - Feature badges
 * - Dynamic CTA buttons with routing
 * - Footer links
 * 
 * This page is fully responsive and accessible.
 * 
 * Route: /welcome
 * 
 * Customization Points:
 * - Images: Update /config/landingImages.ts
 * - Brand Section: Edit LandingBrandSection.tsx
 * - CTA Routing: Modify LandingCTASection.tsx
 * - Feature Tags: Update FEATURES in LandingBrandSection.tsx
 * 
 * Responsive Breakpoints:
 * - Mobile: < 640px
 * - Tablet: 640px - 768px
 * - Desktop: > 768px
 * 
 * Accessibility:
 * - Semantic HTML elements
 * - ARIA labels for interactive elements
 * - Respects prefers-reduced-motion
 * - Minimum 44x44pt touch targets
 * - 4.5:1 color contrast ratio
 * 
 * Performance:
 * - Lazy loading for images
 * - Gradient fallbacks
 * - Optimized animations
 */

import { LandingImageGallery } from "@/components/LandingImageGallery";
import { LandingBrandSection } from "@/components/LandingBrandSection";
import { LandingCTASection } from "@/components/LandingCTASection";
import { LandingFooter } from "@/components/LandingFooter";

export default function AdaptiveLandingPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Image Gallery - Top section with safe area for notch */}
      <section className="flex-none">
        <LandingImageGallery />
      </section>

      {/* Spacer */}
      <div className="h-6 sm:h-8" />

      {/* Brand Section - Logo, Heading, Feature Tags */}
      <section className="flex-none">
        <LandingBrandSection />
      </section>

      {/* Spacer */}
      <div className="h-8 sm:h-10" />

      {/* CTA Section - Primary and Secondary Buttons */}
      <section className="flex-none">
        <LandingCTASection />
      </section>

      {/* Spacer - Grows to push footer to bottom */}
      <div className="flex-1 min-h-6" />

      {/* Footer - Legal Links */}
      <LandingFooter />
    </main>
  );
}
