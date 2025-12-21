# Local Micro-Events Social Network (JoyJoin)

## Overview

JoyJoin (悦聚·Joy) is a social networking platform that facilitates meaningful local connections through curated micro-events (5-10 attendees). It targets the Hong Kong/Shenzhen market, utilizing AI for intelligent user matching based on interests, personality, and social compatibility, with a focus on psychological safety and inclusivity. Key features include AI-powered matching, a comprehensive feedback system, streamlined event management, and a robust Admin Portal. A core innovation is the 12-Archetype Animal Social Vibe System, which enhances group dynamics and chemistry matching.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Frameworks:** React 18 with TypeScript, Vite, Wouter.
- **UI/Styling:** Mobile-first design using Radix UI, shadcn/ui, and Tailwind CSS. Features dark mode, a purple-centric warm color palette, and bilingual support (Chinese/English).
- **State Management:** TanStack Query for server state.
- **Animations:** Framer-motion.
- **Design Principles:** Emphasizes warmth, accessibility, responsive design, and progressive anxiety reduction.

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
- **Two-Stage Event Pool Matching Model:** Admin-defined event pools with hard constraints; AI-driven, 6-dimensional algorithm (Personality 23%, Interests 24%, Intent 13%, Background 15%, Culture 10%, Conversation Signature 15%) matches users within pools. Includes a 12-Archetype Animal Social Vibe System and granular match point explanations.
  - **Deep Trait Extraction System:** 5-category psychological profiling from conversation patterns (Cognitive Style, Communication Preference, Social Personality, Emotional Traits, Interaction Rhythm). Emotional traits now use descriptive categories (stable/sensitive/balanced) instead of 0-100 scores to avoid labeling risks.
  - **Dynamic Weight Adjustment:** Feedback-driven weight optimization that adapts dimension weights based on user satisfaction and match point discussions.
  - **Hybrid Semantic Strategy (Option C):** Simple features use regex patterns, complex semantics call DeepSeek API only for low-confidence attributes to control costs.
  - **Matching Cache System:** In-memory caching for pair scores and signatures, ready for Redis migration.
  - **Expanded Cantonese Dialect Support:** 368 Cantonese vocabulary patterns covering particles, verbs, adjectives, phrases, HK/SZ locations (80 MTR stations), and internet slang.
- **AI-Driven Matchmaking:** Utilizes AI for sophisticated event and people matching, focusing on personality, interests, and group dynamics, with explainable results and a deep feedback system.
- **Two-Tier Feedback Architecture:** Collects basic and optional anonymous deep feedback to refine algorithms.
- **Gamified Personality Assessment:** 12-question test using cumulative trait-based scoring:
  - **Cumulative Scoring System:** Trait scores accumulated from each answer, min-max normalized to 0-100
  - **5-Dimensional Model (AOCEX):** Affinity, Openness, Conscientiousness, Emotional Stability, Extraversion
  - **P-Dimension Integration:** Positivity distributed to X(25%), O(35%), A(40%) using floating-point precision (V6.4 optimized)
  - **Cosine Similarity Matching:** User traits matched against 12 archetype animal profiles
  - **Empirical Score Ranges:** A(-4~30), O(-3~35), C(0~30), E(0~28), X(-15~38) including P contributions (V3 with negative scores)
  - Visualized with personalized Personality Radar Chart.
  - **Accuracy Optimization (V6.9 - Current):** Expert-reviewed optimization achieving balanced distribution:
    - Distribution improvement: All 12 archetypes now within 5.53%-11.22% range (previously 1.8%-21%)
    - Question bank V3.1: Q5 rewritten with calm negotiation path ("温和边界"), Q1/Q6/Q7 rebalanced for O coverage (66.7%→83.3%)
    - Key improvements: 开心柯基(3.3%→8.07%), 夸夸豚(2.2%→5.53%), 沉思猫头鹰(17.7%→7.91%), 暖心熊(3.3%→11.15%), 太阳鸡(3.9%→7.69%)
    - Vector differentiation strategy: 淡定海豚 vs 定心大象 separated by A/O (dolphin) vs C/X (elephant) dimensions
    - Dimension coverage: A(91.7%), O(83.3%), C(100%), E(100%), X(83.3%), P(91.7%)
    - A/B test ready: `archetypeTraitScoresOptimized.ts` with `setABTestVariant('control'/'optimized')`
    - **Low-Energy Archetype Calibration System (V6.8 - Integrated):** 3 supplementary questions ("静谧小屋" scenarios) for distinguishing 5 similar low-energy archetypes (淡定海豚/定心大象/稳如龟/隐身猫/沉思猫头鹰). Triggered when primary/secondary match score difference <3%, affecting ~10-15% of users. Now fully integrated into PersonalityTestPage.tsx with proper UI flow and score merging.
    - **Known limitation:** 3 low-energy archetype pairs have >98% cosine similarity. Supplementary calibration questions address this.
    - **Algorithm Recommendation:** Maintain cosine similarity (production-proven) with conditional calibration for edge cases.
- **AI-First Onboarding (小悦对话注册):** Registration defaults to AI-powered conversational flow with character-based AI (小悦). Traditional form registration available at `/registration/form` as fallback. Multi-step flow covering identity, interests, personality, and profile creation.
- **Admin Portal:** Desktop-first interface for comprehensive management and real-time algorithm tuning via an Admin Matching Lab.
- **Payment & Subscription System:** Full payment infrastructure including WeChat Pay integration.
- **Intelligent Venue Matching & Booking:** Algorithm-based venue scoring and a transactional booking system.
- **AI Chat Registration:** AI-powered conversational registration flow using a character-based AI (小悦) for engaging user onboarding and secure server-side information extraction. Features tiered conversation modes, context-aware quick replies, smart inference, anti-abuse protection, and dialect teasing.
  - **3-Tier Information Funnel (V7.2):** Scientifically-designed data collection architecture based on 10 social expert recommendations:
    - **L1 (Explicit Fundamentals):** 7 must-ask fields collected directly - nickname, phone, gender, age range, city, hometown province, language preference. Used as hard filters in matching.
    - **L2 (Natural Enrichment):** 11 optional fields gathered conversationally - interests, occupation, intent, social style, ideal group size, budget, availability, dietary restrictions, etc. Contributes 40% to compatibility scoring.
    - **L3 (Hidden Insights):** AI-inferred from conversation patterns - dialect profile (8 dialects: Cantonese, Hunan, Teochew, Hakka, Sichuan, Northeastern, Hokkien, Shanghainese), communication style, conversation rhythm, emotional signature, personality signals. Contributes 15% to chemistry scoring.
  - **Dialect Matching as Chemistry Factor:** Same dialect background = +15 points bonus in ConversationSignature similarity (老乡 effect). Both having dialect backgrounds but different = +5 points (移民共鸣).
  - **Intelligent Inference Engine:** Hybrid microkernel architecture (Semantic Matcher, LLM Reasoner, Knowledge Graph, State Manager) to infer user attributes and skip redundant questions with confidence-based actions.
  - **Expert Evaluation System:** Framework with 10 AI expert personas and 7 weighted evaluation dimensions for quality assessment.
- **Personalized Icebreaker Topics:** Algorithm-curated topics considering common interests and archetypes.
- **Activity Toolkit (活动工具包) UX Enhancements:** Features like "适合破冰" badges, atmosphere checks, and streamlined ending screens.
- **King Game (国王游戏) Digital Card System:** Interactive digital poker card game with multi-device WebSocket synchronization, 3D flip animations, dynamic deck generation, and automated dealer rotation.

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