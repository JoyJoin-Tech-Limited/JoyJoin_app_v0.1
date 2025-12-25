# Local Micro-Events Social Network (JoyJoin)

## Overview
JoyJoin (悦聚·Joy) is a social networking platform that connects users through curated local micro-events (5-10 attendees). Primarily targeting the Hong Kong/Shenzhen market, it uses AI for intelligent user matching based on interests, personality, and social compatibility. The platform emphasizes psychological safety and inclusivity, offering AI-powered matching, a comprehensive feedback system, streamlined event management, and a robust Admin Portal. A unique feature is the 12-Archetype Animal Social Vibe System, designed to enhance group dynamics and chemistry.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Monorepo Structure
```
joyjoin-monorepo/
├── apps/
│   ├── user-client/     # 用户端前端 (React + Vite)
│   ├── admin-client/    # 管理端前端 (React + Vite)  
│   └── server/          # API 服务 (Express + Node.js)
├── packages/
│   └── shared/          # @joyjoin/shared 共享包 (schema, types)
└── package.json         # npm workspaces 配置
```

**开发模式：** `npm run dev` - 从 `apps/server/src/index.ts` 启动，Vite 中间件服务前端

**部署命令：**
- `docker build -f apps/user-client/Dockerfile -t joyjoin-user .`
- `docker build -f apps/admin-client/Dockerfile -t joyjoin-admin .`
- `docker build -f apps/server/Dockerfile -t joyjoin-api .`

### Frontend
- **Frameworks:** React 18 with TypeScript, Vite, Wouter.
- **UI/Styling:** Mobile-first design using Radix UI, shadcn/ui, and Tailwind CSS. Features dark mode, a purple-centric warm color palette, and bilingual support (Chinese/English).
- **State Management:** TanStack Query for server state.
- **Animations:** Framer-motion.
- **Design Principles:** Focuses on warmth, accessibility, responsiveness, and progressive anxiety reduction.

### Backend
- **Runtime:** Node.js with Express.js, TypeScript.
- **API Design:** RESTful API.

### Data Storage
- **Database:** PostgreSQL (Neon serverless) with Drizzle ORM. Manages Users, Events, Matching Algorithm data, Feedback/Ratings, and Admin Portal entities.

### Authentication & Authorization
- **User Authentication:** Phone number + SMS verification.
- **Session Management:** `express-session` with PostgreSQL storage.
- **Admin Authorization:** `isAdmin` flag.

### System Features & Design Decisions
- **AI-Driven Event Pool Matching:** A two-stage model utilizing admin-defined event pools and a 6-dimensional AI algorithm (Personality, Interests, Intent, Background, Culture, Conversation Signature) for user matching. Incorporates a 12-Archetype Animal Social Vibe System and explainable match points. Features deep trait extraction from conversation patterns, dynamic weight adjustment based on feedback, and a hybrid semantic strategy for cost-effective AI processing. Includes a matching cache system and expanded Cantonese dialect support.
- **Two-Tier Feedback Architecture:** Collects both basic and anonymous deep feedback for continuous algorithm refinement.
- **Gamified Personality Assessment:** A 12-question test with cumulative trait-based scoring across 5 dimensions (AOCEX) and cosine similarity matching to 12 archetype animal profiles.
- **AI-First Onboarding (小悦对话注册):** Conversational, AI-powered registration flow with a character-based AI (小悦) guiding users through identity, interests, and personality. Includes a 3-tier information funnel for data collection and intelligent inference engine for user attribute inference.
- **Admin Portal:** Desktop-first interface offering comprehensive management and real-time algorithm tuning via an Admin Matching Lab.
- **Payment & Subscription System:** Full payment infrastructure including WeChat Pay integration.
- **Intelligent Venue Matching & Booking:** Algorithm-based venue scoring with a transactional booking system.
- **Venue Partnership System:** Supports collaborative restaurant/bar partnerships with exclusive deals and various redemption methods.
- **Personalized Icebreaker Topics:** Algorithm-curated topics based on common interests and archetypes.
- **King Game (国王游戏) Digital Card System:** Interactive digital poker game with multi-device WebSocket synchronization.
- **小悦进化系统 (AI Evolution System V2.0):** Enables the Xiaoyue chatbot to learn and improve through user feedback and multi-armed bandit optimization, including real-time insight detection across 6 categories. Features dynamic weight optimization using Thompson Sampling and an Admin Evolution Portal for monitoring.
- **Intelligent Information Collection System:** Extracts and structures professional information, including a SmartInsight System for tracking categories, insights, evidence, and confidence, and an Industry Ontology Knowledge Base with hierarchical segments and smart inference rules.

## Recent Changes (2025-12-25)

### Multi-Select Button UI Optimization (Expert Consultation)
- **Created Reusable MultiSelectButton Component** (`apps/user-client/src/components/ui/multi-select-button.tsx`):
  - Selected state: Primary color fill + white text (clear visual distinction)
  - Checkmark icon: ✓ appears on left side when selected
  - Micro-animation: `active:scale-[0.97]` press feedback
  - Haptic feedback: `navigator.vibrate(10)` on mobile
  - Accessibility: min-h-[44px] touch targets
- **Selection Counter**: Shows "已选 2/3" progress badge for multi-select fields
- **Smart Hints**: Changed "可多选" to "多选可提升42%匹配率" (motivational copy)
- **SingleSelectButton Component**: Radio-button style for single-select fields (e.g., 饮酒程度)

### Social Intent Selector Redesign
- **"灵活开放" as Standalone Toggle**: Extracted from 6 buttons, now a Switch toggle above 5 intent buttons
  - When enabled: Shows "已交给AI智能匹配" and hides specific intent buttons
  - When disabled: Shows 5 specific intent buttons (拓展人脉/交朋友/深度讨论/娱乐放松/浪漫社交)
- **3-Item Selection Limit**: Maximum 3 specific intents can be selected; toast notification when exceeded
- **Progressive Disclosure**: Intent buttons only visible when "灵活开放" is off

### LocationPickerSheet Simplification
- **Removed "最近使用" Section**: Simplified to direct cluster selection without redundant recent history

### JoinBlindBoxSheet UI/UX Refactoring
- **Form Structure Reorganization**: Restructured into 3 clear sections with visual separators:
  - **STEP 1: 必填信息 (Required)**: Budget selection + District selection (moved from optional)
  - **STEP 2: 偏好设置 (Optional)**: Intent, Language preferences, Event-specific preferences (饭局/酒局)
  - **STEP 3: 组队邀请 (Optional)**: Team formation with invite link sharing
  - **Rules & Guarantee section**: Displayed before submit button
- **Section Headers**: Added iconography (Wallet, Globe, Users) with required/optional badges
- **Mobile Touch Target Optimization**: All interactive buttons now have `min-h-[44px]` for accessibility compliance:
  - Budget selection buttons, District chips, Intent buttons, Language buttons
  - Taste intensity, Cuisine, Bar theme, Alcohol comfort buttons
- **Event Type Preference Reset**: Added `useEffect` hook that automatically clears irrelevant preferences when switching between 饭局 (dining) and 酒局 (bar) event types
- **Layout Improvements**: Changed from fixed grid layouts to `flex flex-wrap gap-2` for better responsive behavior
- **Removed duplicate code**: Consolidated district selection into Step 1

### Bar Preference Simplification & Single-Select Alcohol Comfort
- **Bar Theme Options Simplified:** Reduced from 5 to 3 user-facing options (精酿 / 清吧 / 私密调酒·Homebar) - maintains multi-select capability
  - Tooltip for Homebar: "隐藏/预约制调酒空间" (hidden/reservation-based cocktail space)
  - Bar types remain multi-selectable for users with diverse preferences
- **Alcohol Comfort Level Changed to Single-Select:** Only one option can be selected at a time (可以喝酒 / 微醺就好 / 无酒精饮品)
  - Rationale: Prevents matching conflicts when misaligned with group expectations
  - Users with variable drinking tolerance should select their most comfortable baseline
- **JoinBlindBoxSheet Updates:** 
  - Modified `barThemeOptions` array (lines 150-154)
  - Updated `toggleAlcoholComfort` function to enforce single-select logic (lines 227-231)
  - Updated UI labels: "酒吧类型（可多选）" and "饮酒程度（请选一个）"

### Dual-Track Preference System for Event Types (2025-12-24)
- **Event Type Differentiation:** Implemented conditional rendering for event-specific preferences
  - **饭局 (Dining Events):** Shows taste intensity (爱吃辣/不辣清淡) + cuisine preferences (中餐/川菜/粤菜/火锅/烧烤/西餐/日料)
  - **酒局 (Bar Events):** Shows bar themes (精酿/清吧/私密调酒·Homebar) + alcohol comfort levels (single-select)
  - **Shared:** Language preferences (国语/粤语/英语) displayed for both event types
- **Database Schema Updates:** Added bar-specific fields to venues table:
  - `barThemes`: text array for bar theme categories
  - `alcoholOptions`: text array for alcohol comfort options supported
  - `vibeDescriptor`: text field for editorial atmosphere description
- **Admin Portal Enhancement:** Venue management form now conditionally displays bar-specific fields only when venue type is "bar"
- **Confirmation Dialog:** Updated to show appropriate preference summary based on event type

### Location Structure Simplification & Unified Data Model
- **Cluster Model:** Simplified to **2 clusters only** (南山区, 福田区) - consolidated from previous 4-cluster structure
- **District Mapping:**
  - **南山区 (Nanshan):** 科技园, 后海, 深圳湾, 蛇口, 前海, 华侨城 (6 districts)
  - **福田区 (Futian):** 车公庙, 购物公园·会展, 梅林 (3 districts)

### Frontend UI/UX Implementation
- **LocationPickerSheet:** Refactored to card-based cluster selection UI for improved usability
- **JoinBlindBoxSheet:** Enhanced with smart district selection features:
  - Auto-select all districts within chosen cluster
  - Dynamic district updates when switching clusters
  - Support for cross-cluster district selection
  - "Select All / Deselect All" toggle for each cluster
  - Display of selected district count (e.g., "南山 4")

### Backend & Configuration Updates
- **Data Synchronization:** 
  - Updated `packages/shared/src/districts.ts` as authoritative source
  - Synchronized `apps/admin-client/src/lib/districts.ts` to match shared structure
  - Added helper functions: `getDistrictIdsByCluster()`, `getClusterIdByDistrictId()`
- **Import Path Fixes:**
  - Fixed TypeScript path issues in `apps/server/src/` to use `@shared/*` alias instead of relative paths
  - Fixed `vite.ts` import path from `../vite.config` to `../../../vite.config`
  - Excluded `src/vite.ts` from TypeScript checking due to dynamic import requirements
- **Tailwind Configuration:**
  - Added `tailwind.config.ts` and `postcss.config.js` to `apps/user-client`
  - Added `tailwind.config.ts` and `postcss.config.js` to `apps/admin-client`
  - Fixed build issues related to missing Tailwind content paths and color tokens

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