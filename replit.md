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
- **Gamified Personality Assessment (V4 Adaptive):** An adaptive 100-question bank (including 6 forced-choice tradeoff questions + 8 targeted differentiation questions Q90-Q97) dynamically selecting 8-16 questions based on real-time confidence, integrating with onboarding. Features an adaptive engine with 3-level question difficulty, real-time archetype predictions, and milestone encouragement. Current accuracy: 55% exact match, 79% similar match (target: 70%/85%, improved from 54%/65% baseline via systematic bias reduction + differentiation questions). Uses explicit targetPairs metadata on differentiation questions for reliable prioritization when confusable archetypes are detected. All 100 questions have Xiaoyue feedback entries.
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