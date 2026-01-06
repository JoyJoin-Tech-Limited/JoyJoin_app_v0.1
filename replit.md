# Local Micro-Events Social Network (JoyJoin)

## Overview
JoyJoin is a social networking platform designed for the Hong Kong/Shenzhen market, connecting users through curated local micro-events (5-10 attendees). It leverages AI for intelligent user matching based on interests, personality, and social compatibility, ensuring psychological safety and inclusivity. The platform features AI-powered matching, comprehensive feedback mechanisms, streamlined event management, and a robust Admin Portal. A unique element is the 12-Archetype Animal Social Vibe System, aimed at enhancing group dynamics.

## User Preferences
Preferred communication style: Simple, everyday language.
Dialect support: Platform serves both Cantonese speakers and other 方言人群 (regional dialect groups) equally - do not over-emphasize any single dialect.

## System Architecture

### Monorepo Structure
The project utilizes a monorepo (`joyjoin-monorepo`) encompassing user client, admin client, API server, and a shared package for common schemas and types.

### Frontend
- **Frameworks:** React 18 with TypeScript, Vite, Wouter.
- **UI/Styling:** Mobile-first design using Radix UI, shadcn/ui, and Tailwind CSS. Features include dark mode, a purple-centric warm color palette, bilingual support (Chinese/English), and design principles emphasizing warmth, accessibility, responsiveness, and progressive anxiety reduction.
- **Anti-Orphan Typography Rule:** For Chinese text on mobile, prevent lone characters (orphans) on last lines using: (1) wrap final 4-6 characters in `<span className="whitespace-nowrap">` or (2) apply `.no-orphan` utility class (combines `text-wrap: balance` + `word-break: keep-all`).
- **State Management:** TanStack Query for server state.
- **Animations:** Framer-motion, with accessibility support.

### Backend
- **Runtime:** Node.js with Express.js, TypeScript.
- **API Design:** RESTful API.

### Data Storage
- **Database:** PostgreSQL (Neon serverless) managed with Drizzle ORM.
- **Key Entities:** Users, Events, Matching Algorithm data, Feedback/Ratings, and Admin Portal entities.

### Authentication & Authorization
- **User Authentication:** Phone number + SMS verification.
- **Session Management:** `express-session` with PostgreSQL storage.
- **Admin Authorization:** `isAdmin` flag.

### System Features & Design Decisions
- **AI-Driven Event Pool Matching:** A two-stage model combining admin-defined event pools and a 7-dimensional AI algorithm (Chemistry, Interest, Language, Preferences, Hometown, Background, Emotional). Integrates a 12-Archetype Animal Social Vibe System with event-type-specific preference scoring (e.g., 饭局 vs 酒局).
- **Two-Tier Feedback Architecture:** Collects basic and anonymous deep feedback for continuous algorithm refinement.
- **Gamified Personality Assessment (V4 Adaptive):** An adaptive 130-question bank (including 6 forced-choice tradeoff questions + 16 targeted differentiation questions Q90-Q97, Q119-Q130) dynamically selecting 8-16 questions based on real-time confidence. Features adaptive engine with 3-level difficulty, real-time archetype predictions. Current accuracy: 44.5% exact match, 69.2% similar match (simulated 10k users). Q127-Q130 added targeting top confusion pairs: 开心柯基↔机智狐, 隐身猫↔淡定海豚, 太阳鸡↔暖心熊.
- **MatcherV2 Algorithm (v2.2-calibrated):** Empirically calibrated VETO thresholds based on actual 55-80 score distributions from 10k simulation. Three archetypes exceed 70% target (机智狐 82.3%, 暖心熊 75.9%, 灵感章鱼 70.7%). Satisfaction 87.5/100, NPS 83.
- **风格谱系 (Style Spectrum) System:** Consolidated presentation model showing primary archetype + adjacent styles. `getStyleSpectrum()` API returns primary/adjacentStyles/spectrumPosition. StyleSpectrum component features: trait-based narrative explanations (referencing top 2 traits with scores), unique traits section, orbital visualization for adjacent styles (100px orbit with floating animations), transparent PNG avatars with drop shadows, theme-safe fallbacks (bg-muted/text-foreground) for missing avatars, and "次要风格" text display for decisive archetypes.
- **HexResonanceBoard (六边形雷达图):** Interactive radar chart visualization of ACOEXP 6-trait model with: 20% opacity translucent fill, 12px labels positioned outside hexagon, hexagonal grid lines at 30/50/70/100 levels, glow animations on high scores (>=70), interactive trait selection with detail expansion, neutral 50-point defaults for missing scores with calibration message.
- **Duolingo-Style Onboarding (新版引导流程):** A template-based 9-screen onboarding flow replacing initial AI chat, featuring a mascot component, smooth progress transitions, and localStorage persistence.
- **AI-Generated Match Explanations (桌友分析):** DeepSeek-powered service providing personalized explanations for matched users, including group dynamics analysis and chemistry temperature levels.
- **Personalized Ice-Breaker Generation:** AI-generated conversation starters customized for group composition, interests, and event type.
- **Admin Portal:** Desktop-first interface with comprehensive management tools and a real-time Admin Matching Lab.
- **Payment & Subscription System:** Full payment infrastructure including WeChat Pay integration.
- **Intelligent Venue Matching & Booking:** Algorithm-based venue scoring and transactional booking system.
- **KPI Tracking System:** Comprehensive metrics collection for CSAT, NPS, user engagement, and churn analysis.
- **小悦进化系统 (AI Evolution System V2.0):** Enables Xiaoyue chatbot learning and improvement through user feedback and multi-armed bandit optimization.
- **偷偷碎嘴系统 V3.0 (Gossip Engine V3.0):** Upgraded personality inference system with semantic deduplication, synonym variation, and expanded template pools to reduce repetition.
- **小悦品牌组件系统 (Xiaoyue Branding System):** Unified visual identity for AI-generated content with `XiaoyueInsightCard` component, featuring multiple avatar poses and tone styles.
- **Profile Gamification System:** Gamification across profile editing and personality test flows to increase engagement, featuring tiered matching, dynamic Xiaoyue avatars, quest-style quick-fill buttons, star-based progress, and counter-intuitive insights.
- **Location Structure:** Simplified to two main clusters (南山区, 福田区) with distinct districts and a card-based selection UI.
- **Event Type Preferences:** Dual-track preference system for Dining (饭局) and Bar (酒局) events, with conditional UI for specific options like cuisine, taste intensity, bar themes, and alcohol comfort levels.
- **Timezone Handling:** All timestamps stored as China timezone (UTC+8); frontend utilities parse without conversion, using Chinese period-based time formatting.
- **Electronic Invitation System:** Golden ticket design with envelope reveal animation, InvitePreviewSheet full-screen display, and iOS Safari-compatible image export using canvas.toBlob with Web Share API fallback.
- **Profile Spotlight Drawer:** Half-screen sliding drawer for viewing tablemate profiles with privacy-respecting age ranges (5-year buckets when ageVisibility='show_age_range') and work visibility controls.
- **JoyRadar Pulse Indicator:** Real-time seat availability visualization with animated pulse effect on event cards.
- **JoyOrbit Orbital Visualization:** Full-screen immersive group member display with drag-to-rotate gesture interaction.
- **AI Conversation Topics (DeepSeek):** Rate-limited, auth-gated endpoint for generating personalized icebreaker topics based on participant profiles, with participant validation to prevent data exfiltration.

## External Dependencies

- **React Ecosystem:** `react`, `react-dom`, `@tanstack/react-query`.
- **Routing:** `wouter`.
- **Build Tools:** `vite`.
- **UI Component Libraries:** Radix UI, `shadcn/ui`, `tailwindcss`, `lucide-react`.
- **Animations:** `framer-motion`.
- **Database:** `@neondatabase/serverless` (PostgreSQL).
- **ORM:** `drizzle-orm`, `drizzle-kit`.
- **Validation:** `zod`.
- **Authentication:** `express-session`, `connect-pg-simple`.
- **AI Services:** DeepSeek API.