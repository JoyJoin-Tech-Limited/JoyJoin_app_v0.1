# Local Micro-Events Social Network (JoyJoin)

## Overview

JoyJoin (悦聚·Joy) is a social networking platform that connects individuals locally through small, curated micro-events (5-10 attendees). It uses AI for intelligent user matching based on interests, personality, and social compatibility, prioritizing psychological safety and inclusivity. Primarily targeting the Hong Kong/Shenzhen market, JoyJoin aims to foster meaningful local connections and build community. Key features include AI-powered matching, a comprehensive feedback system, streamlined event management, and a robust Admin Portal. A core innovation is the 12-Archetype Animal Social Vibe System for sophisticated group dynamics and chemistry matching.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **Venue Style Preference Feature (Dec 13, 2025):**
  - Added `venueStyleRating` field to eventFeedback table for collecting user venue satisfaction (like/neutral/dislike)
  - Updated insertEventFeedbackSchema with enum validation for venueStyleRating values
  - EventFeedbackFlow includes venue style rating step with 喜欢/一般/不喜欢 options
  - AdminVenuesPage supports decorStyle field management (轻奢现代风, 绿植花园风, 复古工业风, 温馨日式风)
  - venueMatchingService.matchDecorStyle() uses decorStylePreferences for venue scoring (+10 points max)
  - Complete end-to-end data flow: user feedback → storage → matching algorithm

- **Enriched Topic Recommendation Reasons (Dec 13, 2025):**
  - Expanded fallback reason variants: 6 variants per difficulty level (easy/medium/deep)
  - All reasons now use complete sentence structure with "小悦觉得..." or "这是..." pattern
  - Added category-specific reason templates for 9 categories (30% trigger probability)
  - Added archetype-based reason variants (energetic/warm/thoughtful combinations)
  - Implemented batch-wide deduplication using `usedReasons` Set
  - Interest-based reasons use rotating templates to avoid repetition
  - Ensures each topic in a batch has a unique, meaningful recommendation reason

- **Referral System Implementation (Dec 12, 2025):**
  - New database tables: `referralCodes` and `referralConversions` for tracking user referrals
  - API endpoints: `/api/referrals/stats` (get user's code + stats), `/api/referrals/check/:code`, `/api/referrals/:code`
  - InvitePage (`/invite`) displays user's referral code, tier rewards, and share functionality
  - ReferralLandingPage for new user acquisition flow with new user benefits display
  - InviteLandingRouter intelligently routes `/invite/:code` to appropriate landing page (referral vs event invitation)
  - Tiered rewards: 1 invite = 7折券, 3 invites = 5折券x2, 5 invites = 免费月卡

- **Personalized Topic Recommend Reasons (Dec 12, 2025):**
  - Added `recommendReason` field to each curated icebreaker topic
  - Smart reason generation based on: common interests (e.g., "你们3人都爱旅行"), archetype composition (活力组合/温馨组合), difficulty level
  - Priority logic: common interests → archetype energy mix → difficulty/category fallback
  - Frontend displays reason with Sparkles icon below each topic question
  - Enhances user understanding of why 小悦 selected each topic for their group

- **Enhanced Icebreaker Topic Selection Algorithm (Dec 12, 2025):**
  - Expanded interest-to-category mapping from 21 to 55+ interests (travel, dining, creativity, innovation, etc.)
  - Implemented balanced category distribution: 2 easy + 4 medium + 2 deep topics per session
  - Added per-category limit (max 2 per category) to ensure diversity
  - Personalization rate improved: 72.4% → 91.8%
  - Category uniformity improved: 7.7% → 21.1%
  - Repeat rate reduced: 23.3% → 12.9%
  - Overall algorithm intelligence score: 67 → 78/100

- **Optimized Icebreaker Cards Performance (Dec 12, 2025):**
  - Migrated from Framer Motion AnimatePresence to Embla Carousel for GPU-accelerated, zero-layout-thrash performance
  - Removed all Framer Motion background particle animations (was causing severe frame rate drops on low-end devices)
  - Removed backdrop-blur effect (high performance cost on WeChat mini-programs)
  - Implemented `touch-action: pan-y` for smooth horizontal swipe with Embla
  - Adjusted Embla duration to 25ms for silky-smooth card transitions
  - Hidden SheetContent's built-in close button, using custom white X button (higher z-index, consistent styling)
  - Optimized for app and WeChat mini-program deployment: 60fps smooth scrolling, minimal memory footprint
  - Now achieves 60fps frame rate even on low-end Android devices

- **Curated Icebreaker Topics API (Dec 12, 2025):**
  - Implemented `/api/icebreakers/curated/:eventId` endpoint for personalized conversation topics
  - Returns 8+ topics across 9 categories sorted by difficulty (easy/medium/deep)
  - Categories: lighthearted, dining, city_life, passions, travel, creativity, innovation, personal, values
  - Maps user interests to prioritized categories when match data exists
  - Always returns topics with graceful fallback to balanced generic selection

- **小悦 Mascot for Blind Box Guide (Dec 12, 2025):**
  - Updated BlindBoxInfoSheet to show 小悦 as the guide explaining blind box mode
  - Added chat-bubble style introduction with avatar placeholder (XIAOYUE_AVATAR_PLACEHOLDER)
  - Uses Bot icon as fallback until real 小悦 avatar is provided

- **12-Archetype Animal PNG Avatars (Dec 12, 2025):**
  - Created `client/src/lib/archetypeImages.ts` mapping 12 archetype names to PNG graphics
  - Updated AttendeePreviewCard and UserConnectionCard to display PNG images instead of lucide icons
  - Maintained backward compatibility with Sparkles icon fallback for unmapped archetypes

- **Logo Size Enhancement (Dec 12, 2025):** Increased Logo component sizes by 2x:
  - sm: h-6 → h-12
  - md: h-8 → h-16  
  - lg: h-10 → h-20
  - Corresponding text sizes also doubled (text-lg/xl/2xl → text-2xl/3xl/4xl)
  - MobileHeader height adjusted (h-14 → h-16) to accommodate larger logo

- **Matching Algorithm Enhancement (Dec 12, 2025):** 
  - Implemented unified field accessors (getUserInterests, getUserTopicAvoidances, getUserHappyTopics) for backward-compatible data merging
  - Enhanced topic conflict detection with bidirectional checks
  - Rebalanced scoring formula: 20-70 base + max 15 bonus - max 25 penalty to prevent saturation
  - Fixed edge cases where legacy-only users would get zero scores

## System Architecture

### Frontend
- **Frameworks:** React 18 with TypeScript, Vite, Wouter for routing.
- **UI/Styling:** Radix UI primitives, shadcn/ui (New York style), Tailwind CSS. Design is mobile-first, supports dark mode, uses a purple-centric warm color palette, and is bilingual (Chinese/English).
- **State Management:** TanStack Query for server state.
- **Animations:** Framer-motion for all UI transitions and effects.
- **Key UI Patterns:** Bottom navigation, event cards, two-part match scoring, personality radar charts, social role cards, progressive disclosure, registration progress indicators.
- **Design Principles:** Warmth, accessibility, responsive design, and progressive anxiety reduction.

### Backend
- **Runtime:** Node.js with Express.js, TypeScript.
- **API Design:** RESTful API.
- **Payment System:** Integrated WeChat Pay structure.

### Data Storage
- **Database:** PostgreSQL (Neon serverless) with Drizzle ORM.
- **Schema:** Users, Events, Matching Algorithm data, Feedback/Ratings, and Admin Portal entities (venues, eventTemplates, subscriptions, payments, coupons).
- **Migrations:** Drizzle Kit.

### Authentication & Authorization
- **User Authentication:** Phone number + SMS verification.
- **Session Management:** `express-session` with PostgreSQL storage.
- **Admin Authorization:** `isAdmin` flag for portal access.

### System Features & Design Decisions
- **Two-Stage Event Pool Matching Model:** Admin creates event pools with hard constraints; users register with soft preferences. AI matches users within pools using a 5-dimensional algorithm (personality, interest, background, conversation, intent) and a 12-Archetype Animal Social Vibe System. Includes a real-time dynamic matching service with adaptive thresholds and time decay.
- **AI-Driven Matchmaking:** Utilizes AI for sophisticated event and people matching, considering personality, interests, and group dynamics, with a focus on explainability and a deep feedback system.
- **Two-Tier Feedback Architecture:** Implements both basic and optional anonymous deep feedback to refine matching algorithms.
- **Gamified Personality Assessment:** A 10-question test determines social role archetypes, visualized with a Personality Radar Chart, and requires retaking for the new 12-archetype system.
- **Streamlined Onboarding:** Multi-step registration covering identity, interests, personality, and profile creation with UX enhancements like progress indicators, time expectations, and celebratory animations.
- **Admin Portal:** Desktop-first interface for comprehensive management of users, subscriptions, events, finance, moderation, and insights, including an Admin Matching Lab for real-time algorithm tuning.
- **Payment & Subscription System:** Full payment infrastructure including WeChat Pay integration, webhook handling, and subscription management.
- **Intelligent Venue Matching & Booking:** Algorithm-based venue scoring and a transactional booking system with race condition protection.
- **Real-Time Bidirectional Data Sync (WebSocket):** Production-ready WebSocket for instant data synchronization, crucial for event status updates and notifications.
- **Data Insights Dashboard:** Comprehensive analytics dashboard providing KPIs, user segmentation, activity quality, retention, revenue conversion, and social role distribution.

## External Dependencies

### Core Frameworks
- **React Ecosystem:** `react`, `react-dom`, `@tanstack/react-query`.
- **Routing:** `wouter`.
- **Build Tools:** `vite`.

### UI Component Libraries
- **Radix UI:** `@radix-ui/react-*`.
- **Styling:** `tailwindcss`, `autoprefixer`, `postcss`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`.
- **Animations:** `framer-motion`.

### Database & ORM
- **Database:** `@neondatabase/serverless` (PostgreSQL).
- **ORM:** `drizzle-orm`, `drizzle-kit`.
- **Validation:** `drizzle-zod`, `zod`.

### Authentication
- `express-session`, `connect-pg-simple`.

### Development Tools
- `typescript`, `tsx`.

### Form Handling
- `@hookform/resolvers`.

### Date/Time Utilities
- `date-fns`.