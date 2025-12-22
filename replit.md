# Local Micro-Events Social Network (JoyJoin)

## Overview
JoyJoin (悦聚·Joy) is a social networking platform designed to foster meaningful local connections through curated micro-events (5-10 attendees). It targets the Hong Kong/Shenzhen market, leveraging AI for intelligent user matching based on interests, personality, and social compatibility. The platform prioritizes psychological safety and inclusivity, featuring AI-powered matching, a comprehensive feedback system, streamlined event management, and a robust Admin Portal. A key innovation is the 12-Archetype Animal Social Vibe System, which enhances group dynamics and chemistry matching.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Frameworks:** React 18 with TypeScript, Vite, Wouter.
- **UI/Styling:** Mobile-first design using Radix UI, shadcn/ui, and Tailwind CSS. Supports dark mode, a purple-centric warm color palette, and bilingualism (Chinese/English).
- **State Management:** TanStack Query for server state.
- **Animations:** Framer-motion.
- **Design Principles:** Focuses on warmth, accessibility, responsive design, and progressive anxiety reduction.

### Backend
- **Runtime:** Node.js with Express.js, TypeScript.
- **API Design:** RESTful API.
- **Payment System:** Integrated WeChat Pay structure.

### Data Storage
- **Database:** PostgreSQL (Neon serverless) with Drizzle ORM, managing Users, Events, Matching Algorithm data, Feedback/Ratings, and Admin Portal entities.

### Authentication & Authorization
- **User Authentication:** Phone number + SMS verification.
- **Session Management:** `express-session` with PostgreSQL storage.
- **Admin Authorization:** `isAdmin` flag.

### System Features & Design Decisions
- **AI-Driven Event Pool Matching:** Two-stage model using admin-defined event pools and an AI-driven, 6-dimensional algorithm (Personality, Interests, Intent, Background, Culture, Conversation Signature) for user matching. Includes a 12-Archetype Animal Social Vibe System and explainable match points.
  - **Deep Trait Extraction:** 5-category psychological profiling from conversation patterns (Cognitive Style, Communication Preference, Social Personality, Emotional Traits, Interaction Rhythm).
  - **Dynamic Weight Adjustment:** Feedback-driven optimization of matching dimension weights.
  - **Hybrid Semantic Strategy:** Combines regex patterns for simple features and DeepSeek API for complex semantics to manage costs.
  - **Matching Cache System:** In-memory caching for performance.
  - **Expanded Cantonese Dialect Support:** Comprehensive vocabulary patterns covering various Cantonese linguistic nuances and regional specifics.
- **Two-Tier Feedback Architecture:** Collects basic and optional anonymous deep feedback for algorithm refinement.
- **Gamified Personality Assessment:** 12-question test with cumulative trait-based scoring across 5 dimensions (AOCEX) and cosine similarity matching against 12 archetype animal profiles. Includes a low-energy archetype calibration system for refined distinctions.
- **AI-First Onboarding (小悦对话注册):** Conversational, AI-powered registration flow with character-based AI (小悦) as default, covering identity, interests, and personality. Traditional form registration is available as a fallback.
  - **3-Tier Information Funnel:** Scientifically designed data collection for explicit fundamentals, natural enrichment, and AI-inferred hidden insights (e.g., dialect profiles).
  - **Dialect Matching:** Integrates dialect background as a chemistry factor in matching.
  - **Intelligent Inference Engine:** Hybrid architecture for inferring user attributes and optimizing question flow.
  - **Registration Funnel Analytics:** Admin dashboard for monitoring KPIs, drop-offs, and AI inference accuracy.
- **Admin Portal:** Desktop-first interface for comprehensive management and real-time algorithm tuning via an Admin Matching Lab.
- **Payment & Subscription System:** Full payment infrastructure including WeChat Pay integration.
- **Intelligent Venue Matching & Booking:** Algorithm-based venue scoring and a transactional booking system.
- **Venue Partnership System:** Supports collaborative restaurant/bar partnerships with exclusive member deals, detailed venue models, unified budget tiers, and various deal redemption methods.
- **Personalized Icebreaker Topics:** Algorithm-curated topics based on common interests and archetypes.
- **Activity Toolkit UX Enhancements:** Features like "适合破冰" badges and atmosphere checks.
- **King Game (国王游戏) Digital Card System:** Interactive digital poker game with multi-device WebSocket synchronization and dynamic features.
- **小悦进化系统 (AI Evolution System V2.0):** Enables the Xiaoyue chatbot to learn and improve through user feedback and multi-armed bandit optimization, including real-time insight detection across 6 categories (Safety, Emotional, Lifestyle, Relationship, Career, Preference).
  - **Dynamic Weight Optimization:** Utilizes Thompson Sampling for adjusting matching weights.
  - **Real-time Insight Detection:** Per-message and full conversation analysis for user profile enrichment.
  - **Admin Evolution Portal:** Provides KPIs, visualizations for weights and triggers, and golden dialogue management.

## External Dependencies

### Core Frameworks
- **React Ecosystem:** `react`, `react-dom`, `@tanstack/react-query`.
- **Routing:** `wouter`.
- **Build Tools:** `vite`.

### UI Component Libraries
- **Radix UI:** `@radix-ui/react-*`.
- **Styling:** `tailwindcss`, `shadcn/ui`, `lucide-react`.
- **Animations:** `framer-motion`.

### Database & ORM
- **Database:** `@neondatabase/serverless` (PostgreSQL).
- **ORM:** `drizzle-orm`, `drizzle-kit`.
- **Validation:** `zod`.

### Authentication
- `express-session`, `connect-pg-simple`.

### AI Services
- **DeepSeek API:** Used for conversational AI.

## Recent Changes (December 2025)
- **ProfilePage Optimization:** Added level badge on avatar (Lv.X badge at bottom-right), integrated "Social DNA" collapsible section combining SocialRoleCard, personality traits radar, archetype insights, and compatibility matches
- **Edit Profile Alignment with AI Chat Registration:** Added petTypes, companyName, seniority, cuisinePreference fields to EditProfilePage; created EditSocialPage for icebreakerRole and socialStyle editing
- **CollectedInfo Interface:** Added hasSiblings field for AI registration flow
- **Display Mapping Functions:** Added getIcebreakerRoleDisplay and getSocialStyleDisplay in userFieldMappings.ts