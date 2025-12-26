# Local Micro-Events Social Network (JoyJoin)

## Overview
JoyJoin is a social networking platform designed to connect users through curated local micro-events (5-10 attendees) in the Hong Kong/Shenzhen market. It leverages AI for intelligent user matching based on interests, personality, and social compatibility, emphasizing psychological safety and inclusivity. Key capabilities include AI-powered matching, comprehensive feedback, streamlined event management, and a robust Admin Portal. A distinctive feature is the 12-Archetype Animal Social Vibe System, aimed at enhancing group dynamics and chemistry.

## User Preferences
Preferred communication style: Simple, everyday language.
Dialect support: Platform serves both Cantonese speakers and other 方言人群 (regional dialect groups) equally - do not over-emphasize any single dialect.

## System Architecture

### Monorepo Structure
The project uses a monorepo setup (`joyjoin-monorepo`) containing separate applications for the user client, admin client, and API server, along with a shared package for common schemas and types.

### Frontend
- **Frameworks:** React 18 with TypeScript, Vite, Wouter.
- **UI/Styling:** Mobile-first design utilizing Radix UI, shadcn/ui, and Tailwind CSS. Features include dark mode, a purple-centric warm color palette, bilingual support (Chinese/English), and design principles focused on warmth, accessibility, responsiveness, and progressive anxiety reduction.
- **State Management:** TanStack Query for server state.
- **Animations:** Framer-motion, with accessibility support for reduced motion preferences.

### Backend
- **Runtime:** Node.js with Express.js, TypeScript.
- **API Design:** RESTful API.

### Data Storage
- **Database:** PostgreSQL (Neon serverless) managed with Drizzle ORM.
- **Data Entities:** Users, Events, Matching Algorithm data, Feedback/Ratings, and Admin Portal entities.

### Authentication & Authorization
- **User Authentication:** Phone number + SMS verification.
- **Session Management:** `express-session` with PostgreSQL storage.
- **Admin Authorization:** `isAdmin` flag.

### System Features & Design Decisions
- **AI-Driven Event Pool Matching:** A two-stage model employing admin-defined event pools and a 7-dimensional AI algorithm with validated weights: Chemistry (30%), Interest (20%), Language (15%), Preferences (15%), Hometown (8-12% dynamic), Background (5%), Emotional (5%). It integrates a 12-Archetype Animal Social Vibe System with event-type-specific preference scoring (饭局 vs 酒局). Features include dynamic hometown affinity with opt-in, bar theme/alcohol comfort matching for 酒局, and taste intensity/cuisine matching for 饭局. Includes a matching cache and Cantonese dialect support.
- **Two-Tier Feedback Architecture:** Collects basic and anonymous deep feedback for continuous algorithm refinement.
- **Gamified Personality Assessment:** A 12-question test for cumulative trait-based scoring across 5 dimensions (AOCEX) and cosine similarity matching to 12 archetype animal profiles.
- **AI-First Onboarding (小悦对话注册):** Conversational, AI-powered registration flow guided by a character-based AI (小悦), utilizing a 3-tier information funnel and intelligent inference engine.
- **Admin Portal:** Desktop-first interface with comprehensive management tools and a real-time Admin Matching Lab for algorithm tuning.
- **Payment & Subscription System:** Full payment infrastructure including WeChat Pay integration.
- **Intelligent Venue Matching & Booking:** Algorithm-based venue scoring with a transactional booking system.
- **Venue Partnership System:** Supports collaborative restaurant/bar partnerships with exclusive deals.
- **Personalized Icebreaker Topics:** Algorithm-curated topics based on common interests and archetypes.
- **AI-Generated Match Explanations (桌友分析):** DeepSeek-powered service that generates personalized explanations for each pair of matched users, explaining why they might connect well based on archetypes, shared interests, and connection points. Includes group dynamics analysis with chemistry temperature levels (fire/warm/mild/cold).
- **Personalized Ice-Breaker Generation:** AI-generated conversation starters customized to group composition, analyzing common interests, archetypes, and event type (饭局 vs 酒局). Fallback templates for API failures.
- **KPI Tracking System:** Comprehensive metrics collection including CSAT (Customer Satisfaction Score), NPS (Net Promoter Score), user engagement tracking, churn analysis, and daily KPI snapshots. Database tables: `kpi_snapshots`, `user_engagement_metrics`, `event_satisfaction_summary`. Admin API endpoints for dashboard visualization.
- **King Game (国王游戏) Digital Card System:** Interactive digital poker game with multi-device WebSocket synchronization.
- **小悦进化系统 (AI Evolution System V2.0):** Enables the Xiaoyue chatbot to learn and improve through user feedback and multi-armed bandit optimization, including real-time insight detection and an Admin Evolution Portal.
- **偷偷碎嘴系统 V2.1 (Gossip Engine V2.1):** Optimized personality inference system with: (1) Pillar quota matrix achieving balanced distribution (Identity 27.7%, Energy 50.1%, Value 22.2%), (2) 4-tier rarity grading (common/uncommon/rare/legendary) with novelty scoring, (3) 30+ inference rules covering combo_*, rare_*, legendary_* triggers, (4) Dynamic template variant system with trigger-to-key mapping via `getTriggerBase()`, (5) Dynamic prefix system (15 prefixes, 60% usage rate) and transition system (10 transitions, 40% usage rate), (6) Trigger dampening with exponential decay (0.85^n), (7) "毒舌公式" snarky endings library, (8) Safety guard with forbidden words dictionary. Test results: 重复率 41.3% (target ≤50%), 期待感 4.20, 综合评分 4.06/5.00, 独立话术 587个. Module: `apps/user-client/src/lib/gossipEngineV2.ts`.
- **Intelligent Information Collection System:** Extracts and structures professional information, featuring a SmartInsight System and an Industry Ontology Knowledge Base.
- **Location Structure:** Simplified to two main clusters (南山区, 福田区) with distinct districts, providing a card-based selection UI.
- **Event Type Preferences:** Implemented dual-track preference system for Dining (饭局) and Bar (酒局) events, with conditional UI for specific options like cuisine, taste intensity, bar themes, and alcohol comfort levels. Event-type-specific budget options: 饭局 (≤¥150, ¥150-200, ¥200-300, ¥300-500 per person) vs 酒局 (≤¥80/杯, ¥80-150/杯 per drink).
- **Timezone Handling:** All timestamps are stored as China timezone (UTC+8) directly in the database. Frontend uses `chineseDateTime.ts` utilities with `parseAsChinaTime()` helper to parse without timezone conversion. Time format uses Chinese periods (凌晨/上午/中午/下午/晚上) with 12-hour format.

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

## Deployment Configuration

### Production Deployment (Caddy + Docker)
- **Domain:** yuejuapp.com with subdomains (www, api, admin)
- **Reverse Proxy:** Caddy for automatic HTTPS via Let's Encrypt
- **Session Sharing:** Cross-subdomain cookie with `.yuejuapp.com` domain
- **Files:**
  - `deployment/Caddyfile` - Caddy reverse proxy configuration
  - `deployment/docker-compose.caddy.yml` - Docker Compose with Caddy
  - `deployment/.env.production.example` - Production environment template
- **Key Settings:**
  - `COOKIE_DOMAIN=.yuejuapp.com` enables session sharing across subdomains
  - `app.set('trust proxy', 1)` allows Express to trust Caddy's X-Forwarded headers
  - `proxy: true` in session config for secure cookies behind proxy