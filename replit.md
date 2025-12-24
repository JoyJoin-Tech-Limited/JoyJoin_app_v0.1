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
- **TypeScript Type Safety Fixes (Dec 24):** Resolved all CI/CD compilation errors for cleaner builds
  - **Vite Type Declarations:** Created vite-env.d.ts in both apps/user-client/src/ and apps/admin-client/src/ with image module declarations
  - **TSConfig Updates:** Added "types": ["vite/client"] and vite-env.d.ts to include array in both client tsconfigs
  - **Animation Type Fix:** Explicitly typed events array in animationTestSimulation.ts to resolve union type inference errors
  - **Cleanup:** Removed three broken example files (EventCard.tsx, MobileHeader.tsx, JoyEventCard.tsx) that referenced non-existent components
  - **Key Files:** apps/*/src/vite-env.d.ts, apps/*/tsconfig.json, apps/user-client/src/lib/animationTestSimulation.ts
- **Monorepo Structure Standardization (Dec 24):** Complete migration from legacy directories to proper monorepo structure
  - **Directory Structure:** Code migrated from `server/` and `client/` to `apps/server/src/`, `apps/user-client/src/`, `apps/admin-client/src/`
  - **Per-App TypeScript:** Each app has dedicated `tsconfig.json` with proper path aliases (@/, @shared/, @assets/)
  - **CI/CD Pipeline:** Lint runs `npx tsc --noEmit` per app, test path updated to `apps/server/src/tests/`, artifact upload/download paths aligned to `apps/*/dist`
  - **Vite Configs:** Output to local `dist` directory per app for cleaner builds
  - **Key Files:** `.github/workflows/cicd.yml`, `apps/*/tsconfig.json`, `apps/*/vite.config.ts`, `packages/shared/src/index.ts`
- **JoinBlindBoxSheet UX Overhaul (Dec 24):** Major redesign of registration flow with multi-select districts and gamified team invitation
  - **Multi-Select District Chips:** Replaced simple "相邻商圈" toggle with collapsible cluster groups (南山走廊, 前海, 华侨城, 福田), each district as selectable chip with heat indicator (🔥), max 4 selections, "多选2-3个商圈，成局率提升42%" incentive
  - **Gamified Team Invitation:** Replaced form-based "邀请朋友" with game-style "发起组队" button, 1-friend limit, showTeamInvite state managing invite flow, Web Share API integration for WeChat sharing, teammate status tracking (waiting/joined)
  - **Clean State Management:** Removed redundant inviteFriends/friendsCount states, showTeamInvite now drives all invite-related UI/payload, inviteLink generated and persisted
  - **Confirm Dialog Updates:** Shows selected districts as badges, displays team invite status when active
  - **Key Files:** client/src/components/JoinBlindBoxSheet.tsx, client/src/lib/districts.ts
- **CI/CD TypeScript Error Fix (Dec 23):** Resolved all 37 blocking TypeScript errors to 0
  - **Schema Extensions:** Added poolId to blindBoxEvents, atmosphereType/hostUserId to icebreakerSessions, totalAcceptances to invitations
  - **Interface Updates:** Added avgChemistryScore to MatchGroup in poolMatchingService.ts
  - **Type Fixes:** Fixed storage method calls (getAllCoupons, getBlindBoxEventById), added type assertions for SQL query results, fixed Map iterator compatibility
  - **Key Files:** server/routes.ts, shared/schema.ts, server/poolMatchingService.ts
- **6-Dimension Dialogue Guidance System (Dec 23):** Scientific dimension orchestrator replacing hard-coded conversation flow
  - **dimensionOrchestrator.ts:** Unified orchestrator managing 6-dimension conversation flow (interest → lifestyle → personality → social → career → expectation)
  - **Mode Configs:** Express (2 required dimensions), Standard (all 6 dimensions), Deep (unlimited follow-ups)
  - **L1/L2 Field Mapping:** Maps each dimension to corresponding user profile fields for completion tracking
  - **Dynamic Prompt Injection:** Real-time prompt updates with dimension progress, suggested questions, and transition phrases
  - **Integration Pipeline:** Orchestrator → inferenceEngine → insightDetector → stateManager
  - **Key Files:** server/inference/dimensionOrchestrator.ts, server/deepseekClient.ts (continueXiaoyueChatWithInference)
- **Intelligent Information Collection System (Dec 22):** Comprehensive system to "珍惜每次用户给我们的宝贵回复" - intelligently extracts and structures professional information
  - **SmartInsight System:** category/insight/evidence/confidence tracking with Jaccard similarity deduplication (threshold 0.8), confidence gating (>=0.7), and category limits (max 5 per category)
  - **InferredTraits:** Deep psychological profiling covering cognitive style, communication preference, social personality, emotional traits
  - **Industry Ontology Knowledge Base:** 10+ industries (金融/科技/咨询/法律/医疗/教育/地产/快消/传媒/制造) with hierarchical segments, synonym mappings, and RAG retrieval functions
  - **Finance Deep Segments:** 一级市场/PE/VC/并购/投行/二级市场/量化/四大/MBB/银行/保险/资管
  - **Smart Inference Rules:** 15+ regex-based rules for professional terminology mapping (e.g., "一级并购" → industrySegment: "一级市场-并购")
  - **Key Files:** server/inference/industryOntology.ts, server/inference/smartInsightsService.ts, server/inference/smartInference.ts
- **ProfilePage Optimization:** Added level badge on avatar (Lv.X badge at bottom-right), integrated "Social DNA" collapsible section combining SocialRoleCard, personality traits radar, archetype insights, and compatibility matches
- **Edit Profile Alignment with AI Chat Registration:** Added petTypes, companyName, seniority, cuisinePreference fields to EditProfilePage; created EditSocialPage for icebreakerRole and socialStyle editing
- **CollectedInfo Interface:** Added hasSiblings field for AI registration flow
- **Display Mapping Functions:** Added getIcebreakerRoleDisplay and getSocialStyleDisplay in userFieldMappings.ts
- **EditProfilePage UIUX Overhaul (Dec 22):** Restructured from 7 cards to 4 themed groups (身份基础, 生活快照, 成长与职业, 社交偏好) with chip-style value display and incomplete field count badges. Personal background split into "生活状态" and "城市足迹" subsections.
- **DB Schema Extension:** Added companyName, icebreakerRole, interestsDeep, industrySegment, structuredOccupation, insightLedger(JSONB) fields to users table
- **Admin Event Pool Editing (Dec 22):** Added full CRUD support for event pools in Admin Portal with edit button on pool cards, timezone-safe datetime handling using date-fns format(), and form reuse between create/edit modes
- **AI Mystique UX Updates (Dec 22):** Replaced explicit data counts with progressive reveal messaging for AI mystique effect
  - Resume prompt: "已收集X项信息" → tiered hints ("小悦已捕捉到不少有趣洞察" for >=8 items)
  - Progress bar labels: "核心资料 X/Y项" → mystical stages ("小悦正在感知你的特质")
  - Footer progress: "X/Y项" → progressive reveals ("渐入佳境.../洞察完成")
- **Registration Data Persistence (Dec 22):** New fields (industry/industrySegment/structuredOccupation/companyType/seniority) and smartInsights→insightLedger(JSONB) now persist on chat registration completion
- **SmartInsights Frontend Display (Dec 22):** AI-powered insights now visible in both chat registration and profile pages
  - **SocialProfileCard (ChatRegistrationPage):** Shows "小悦的洞察" section with top 3 high-confidence (≥0.7) insights, category-based coloring (career/blue, personality/purple, lifestyle/amber, preference/pink, background/green, social/orange), staggered motion animations
  - **ProfilePage Career Card:** New "职业画像" card displaying industry/occupation/seniority chips, company info, and insightLedger insights with category icons (Briefcase/Users/Coffee/Heart/Globe), fallback message when no high-confidence insights