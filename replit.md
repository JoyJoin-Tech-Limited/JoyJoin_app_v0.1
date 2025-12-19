# Local Micro-Events Social Network (JoyJoin)

## Overview

JoyJoin (悦聚·Joy) is a social networking platform designed to foster meaningful local connections through curated micro-events (5-10 attendees). It leverages AI for intelligent user matching based on interests, personality, and social compatibility, with a strong emphasis on psychological safety and inclusivity. Primarily targeting the Hong Kong/Shenzhen market, JoyJoin aims to build community by connecting individuals for shared experiences. Key capabilities include AI-powered matching, a comprehensive feedback system, streamlined event management, and a robust Admin Portal. A core innovation is the 12-Archetype Animal Social Vibe System, which enhances sophisticated group dynamics and chemistry matching.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Frameworks:** React 18 with TypeScript, Vite, Wouter for routing.
- **UI/Styling:** Mobile-first design using Radix UI primitives, shadcn/ui (New York style), and Tailwind CSS. Supports dark mode, a purple-centric warm color palette, and is bilingual (Chinese/English).
- **State Management:** TanStack Query for server state.
- **Animations:** Framer-motion for UI transitions and effects.
- **Key UI Patterns:** Bottom navigation, event cards, two-part match scoring, personality radar charts, social role cards, progressive disclosure, and registration progress indicators.
- **Design Principles:** Emphasizes warmth, accessibility, responsive design, and progressive anxiety reduction.

### Backend
- **Runtime:** Node.js with Express.js, TypeScript.
- **API Design:** RESTful API.
- **Payment System:** Integrated WeChat Pay structure.

### Data Storage
- **Database:** PostgreSQL (Neon serverless) with Drizzle ORM.
- **Schema:** Manages Users, Events, Matching Algorithm data, Feedback/Ratings, and Admin Portal entities (venues, eventTemplates, subscriptions, payments, coupons).
- **Migrations:** Drizzle Kit.

### Authentication & Authorization
- **User Authentication:** Phone number + SMS verification.
- **Session Management:** `express-session` with PostgreSQL storage.
- **Admin Authorization:** `isAdmin` flag for portal access.

### System Features & Design Decisions
- **Two-Stage Event Pool Matching Model:** Admin defines event pools with hard constraints; users register with soft preferences. An AI-driven, 5-dimensional algorithm (personality, interest, background, conversation, intent) matches users within pools, incorporating a 12-Archetype Animal Social Vibe System and a real-time dynamic matching service.
- **AI-Driven Matchmaking:** Utilizes AI for sophisticated event and people matching, focusing on personality, interests, and group dynamics, with explainable results and a deep feedback system.
- **Two-Tier Feedback Architecture:** Collects both basic and optional anonymous deep feedback to continuously refine matching algorithms.
- **Gamified Personality Assessment:** A 10-question test determines social role archetypes, visualized with a Personality Radar Chart, requiring re-assessment for the new 12-archetype system.
- **Streamlined Onboarding:** Multi-step registration covering identity, interests, personality, and profile creation, enhanced with UX features like progress indicators and celebratory animations.
- **Admin Portal:** Desktop-first interface for comprehensive management (users, subscriptions, events, finance, moderation, insights), including an Admin Matching Lab for real-time algorithm tuning.
- **Payment & Subscription System:** Full payment infrastructure including WeChat Pay integration, webhook handling, and subscription management.
- **Intelligent Venue Matching & Booking:** Algorithm-based venue scoring and a transactional booking system with race condition protection.
- **AI Chat Registration:** New AI-powered conversational registration flow using a character-based AI (小悦) for a more engaging user onboarding experience, extracting user information securely server-side. Features include:
  - **Tiered Conversation Modes:** Four modes with star ratings indicating profile completion:
    - ⚡ Express (90s, ★★☆☆☆): 4 core questions, quick registration
    - ☀️ Standard (3min, ★★★☆☆): 8 questions, balanced experience  
    - 💎 Deep (5min, ★★★★☆): 12+ questions, comprehensive profile
    - 🚀 All-in-one: Registration + personality test fusion
  - **Conversation Resumption:** localStorage-based autosave with breakpoint restore and AI context injection
  - **Profile Enrichment Mode:** Users with <90% complete profiles can supplement missing info via personalized AI conversations
  - **Evolving Avatar:** User avatar clarity evolves as more profile information is collected during chat
  - **Message Queue Display:** AI messages display line-by-line with 350ms intervals for better readability
  - **Sequential Opening Messages:** Opening messages split into multiple paragraphs displayed sequentially with typing animations using AbortController for clean cancellation
  - **Anti-Abuse Protection:** Comprehensive abuse detection system with content filtering (6 categories: political, pornographic, violent, harassment, spam, illegal), rate limiting (500ms message interval, 30 turns/session, 50k tokens/day), gibberish/repetition detection, and progressive punishment (warning → 1hr freeze → 24hr freeze → permanent ban)
  - **Smart Quick Replies:** Context-aware quick reply suggestions covering intent (交友目的), languages, relationship status, education, children, topic avoidances, cuisine preferences, pet types, overseas regions, icebreaker roles (破冰角色), energy recovery (能量恢复), life stage (人生阶段) - all in Chinese with multi-select support
  - **Quick Reply Pagination:** Multi-select scenarios show max 4 options per page with "换一批" rotation button and "自己输入" custom input option; page resets automatically when options change
  - **Yes/No Auto-Detection:** Binary questions (是不是/要不要/会...吗 etc.) trigger simple "是的/不是" quick replies with safeguards against enumeration and open-ended questions
  - **6 Intelligent Conversation Strategies:** Context memory & cross-referencing, emotion-aware pacing, information validation & clarification, time-aware pacing based on mode, high-value signal detection, personalized wrap-up summaries
  - **Mode-Specific Follow-up Rules:** Express=no follow-ups, Standard=selective 1-2 follow-ups, Deep=deep exploration with dialect teasing
  - **Dialect Teasing Feature:** 小悦 responds in user's dialect when detected (四川话→"安逸嘛", 粤语→"叻仔/叻女喔", etc.)
  - **Key Files:** `ChatRegistrationPage.tsx`, `server/deepseekClient.ts`, `ProfilePage.tsx`
  - **Intelligent Inference Engine:** Hybrid microkernel architecture that eliminates redundant questions by inferring user attributes from conversation context. Features include:
    - **4-Layer Architecture:** Semantic Matcher (fast pattern matching) → LLM Reasoner (complex inference) → Knowledge Graph (entity recognition) → State Manager (session tracking)
    - **Confidence-Based Actions:** ≥85% confidence skips questions, 60-85% uses confirmation prompts, <60% asks normally
    - **Semantic Matcher:** 15+ quick inference rules, 200+ synonym mappings for life stages, industries, relationships, returnee patterns
    - **Knowledge Graph:** 60+ companies, 30+ schools, 40+ cities with industry/city inference chains
    - **LLM Chain-of-Thought Reasoner:** DeepSeek-powered fallback for ambiguous cases with structured JSON output
    - **500 Test Scenarios:** Evaluation framework with 5 personas × 5 linguistic styles for quality assurance
    - **API Endpoints:** `POST /api/inference/test` (quick test), `GET /api/inference/logs` (admin), `POST /api/inference/evaluate` (admin)
    - **Live Integration:** `POST /api/registration/chat/message` now uses inference-enhanced chat, automatically skipping redundant questions
    - **Key Files:** `server/inference/engine.ts`, `server/inference/semanticMatcher.ts`, `server/inference/llmReasoner.ts`, `server/inference/knowledgeGraph.ts`, `server/inference/evaluator.ts`
- **Personalized Icebreaker Topics:** Curated icebreaker topics generated by an algorithm that considers common interests, archetype composition, and difficulty levels, with personalized recommendation reasons.
- **Activity Toolkit (活动工具包) UX Enhancements:**
  - **"适合破冰" Badges:** Visual indicators on games/topics that are beginner-friendly (category='quick' or difficulty='easy')
  - **End Activity Confirmation Modal:** Prevents accidental session termination with confirmation dialog showing elapsed time
  - **60-Minute Atmosphere Check:** Mid-activity modal collecting atmosphere feedback (很棒/不错/一般/有点尴尬) to refine matching algorithms
  - **120-Minute Auto-End:** Automatic session termination after 2 hours without confirmation required
  - **Streamlined Ending Screen:** Prominent feedback CTA with gradient styling and animation, removed share/download buttons for focused user flow
  - **Key Files:** `EndActivityConfirmModal.tsx`, `AtmosphereCheckModal.tsx`, `IcebreakerEndingScreen.tsx`
- **King Game (国王游戏) Digital Card System:** Interactive digital poker card game for 4-6 players as part of the Icebreaker Toolkit. Features include:
  - **Multi-Device WebSocket Sync:** Real-time game synchronization across all player devices with private card dealing (each player only sees their own card)
  - **3D Flip Animation Cards:** Using framer-motion for smooth card flip animations with distinct number (1-N) and King card designs
  - **Dynamic Deck Generation:** Automatically generates N+1 cards based on player count (4-6 players supported)
  - **Private Card Dealing:** Server-side card assignment with individual WebSocket messages - cards are never exposed to other players
  - **Dealer Rotation:** Automatic dealer advancement after each round for fair gameplay
  - **Smart Table Card Calculation:** Only reveals the "King's number" (remaining table card) after all players have drawn
  - **15 Command Suggestions:** Pre-built fun commands categorized by type (physical, performance, social, funny, dare) with intensity levels (light, medium, spicy)
  - **Complete Game Flow:** Waiting → Dealing → Commanding → Executing phases with WebSocket-based state synchronization
  - **Key Files:** `useKingGameWebSocket.ts` hook, `KingGameController.tsx` (local + multi-device modes), `wsService.ts` handlers, `wsEvents.ts` type definitions

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

### AI Services
- **DeepSeek API:** Used for conversational AI in the chat registration flow.