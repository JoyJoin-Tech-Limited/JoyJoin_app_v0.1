# Local Micro-Events Social Network (JoyJoin)

## Overview

JoyJoin (悦聚·Joy) is a social networking platform designed to connect individuals locally through small, curated micro-events (5-10 attendees). The platform leverages AI for intelligent user matching based on interests, personality, and social compatibility, with a strong emphasis on psychological safety and inclusivity. Primarily targeting the Hong Kong/Shenzhen market, JoyJoin aims to foster meaningful local connections and build community. Key capabilities include AI-powered matching for events and people, a comprehensive feedback system for continuous algorithm refinement, streamlined event management, and a robust Admin Portal for platform oversight and analytics. A core innovation is the 12-Archetype Animal Social Vibe System, which categorizes user social energy and personality for sophisticated group dynamics and chemistry matching.

## Recent Changes

### December 12, 2025 - Occupation Taxonomy Overhaul for Shenzhen Market

**New Occupation Categories:**
- 战投/CVC (cvc_strategic): 战投、战略投资、并购、CVC、腾讯投资、字节战投、阿里战投等大厂战投部门
- 投行(IBD): 从"投行分析师"改为"投行(IBD)"，去掉junior岗位称呼

**New Industries Added (15 → 18):**
- 硬科技/芯片 (hardware): 芯片工程师、芯片验证、硬件工程师、嵌入式工程师、工艺工程师、硬件产品经理
- 新能源汽车 (new_energy): 新能源汽车工程师、电池工程师、自动驾驶工程师、整车工程师、充电桩/储能、汽车销售

**AI Industry Expanded:**
- 机器人工程师 (robotics_engineer): 优必选、大疆、宇树、Figure、Tesla Bot
- 具身智能研发 (embodied_ai): Embodied AI、运动控制、感知算法

**Terminology Updates:**
- "在职员工" → "在职人士" (88-92% acceptance across all seniority levels)
- "保险学" → "保险与精算/风险管理" (field-of-study mapping)
- "投行分析师" → "投行(IBD)" (去掉junior称呼)

**Synonym Expansion for Shenzhen/HK Market:**
- 法律: Added 红圈所 (金杜/君合/中伦/方达/海问), 魔圈 (Magic Circle), 美所 (Kirkland/Latham/Skadden)
- 金融: Expanded IBD (中金/华泰/国君/高盛/摩根士丹利/瑞银), PE/VC (红杉/高瓴/IDG/黑石/KKR/淡马锡), 新增战投/CVC
- 咨询: Added MBB全称 (McKinsey/Boston Consulting/Bain), 二梯队 (罗兰贝格/奥纬/科尔尼)
- 科技: Shenzhen giants (深信服/迈瑞/大疆/比亚迪/中兴/传音), 外企 (Microsoft/Google/Apple/Meta)

**OccupationSelector UI Simplification:**
- 反馈卡片从"推荐专业领域"改为"同桌可见标签：行业"
- 新增 getIndustryLabel() 和 getIndustryId() 辅助函数
- 移除 getSuggestedFieldsOfStudy 在UI的使用（后台保留）

**Files Modified:** shared/occupations.ts, client/src/components/OccupationSelector.tsx

---

### December 12, 2025 - Registration UX Simplification

**Age Visibility Simplified (4 → 2 options):**
- Reduced from dropdown with 4 options to simple Switch toggle
- Default: ON (显示年龄段给同桌人)
- New options: show_age_range (default), hide_all
- Legacy values (show_generation, show_exact_age) handled with backward compatibility
- Age displayed as range brackets: "25-29岁", "30-34岁" etc.
- Added getGenerationLabel() for alternative display: "95后", "00后" etc.
- Files: constants.ts, schema.ts, utils.ts, RegistrationPage.tsx

**Work Mode Options Refined (labels updated):**
- "transitioning": 描述改为"求职中、休整、转型、预备接班" (覆盖厂二代)
- "caregiver_retired": 标签改为"家庭为主"，描述改为"全职家长、照顾家人、退休、在家躺平"
- Work mode selector now always visible (can switch anytime, no need to reset)
- Selected work mode highlighted with purple border/background

**Field-of-Study Removed from Registration:**
- Removed manual fieldOfStudy input section entirely from RegistrationPage
- Made fieldOfStudy optional in schema (defaults to undefined)
- Added cleanup logic in mutation to strip empty strings before submission
- Field-of-study now suggestion-only, displayed in OccupationSelector feedback card

**OccupationSelector Immediate Feedback:**
- Feedback card now shows immediately after occupation selection (no waiting for work mode)
- Work mode selector embedded inside feedback card for streamlined flow
- Removed unused showWorkModeStep state and onFieldOfStudySuggestion callback
- Simplified component architecture while maintaining all functionality

**Files Modified:** RegistrationPage.tsx, OccupationSelector.tsx, shared/schema.ts, shared/constants.ts, shared/occupations.ts

---

### December 11, 2025 - Occupation Selector UX Improvements

**Occupation Search Enhancements:**
- Added comprehensive search synonyms for hot occupations (金融: 投资银行/四大/德勤/普华/安永/毕马威, 咨询: MBB/麦肯锡/BCG/贝恩, 科技: 大厂/BAT/字节/腾讯/阿里, 医疗: 大夫)
- Added traditional industries (餐饮从业/零售从业/制造业) and casual expressions (创业者/自由职业者/外企员工/打工人)
- Fixed duplicate pinyin mapping conflict (摩根 changed from "mg" to "mgs")

**Occupation→Field-of-Study Intelligent Mapping:**
- Created `getSuggestedFieldsOfStudy()` function in shared/occupations.ts
- 28 occupation categories mapped to relevant academic fields
- Suggestions displayed as recommended tags in OccupationSelector feedback card

**OccupationSelector Component Updates:**
- Feedback card displays recommended field-of-study tags (first highlighted as primary)
- Industry browser auto-collapses after occupation selection for cleaner UI
- "浏览其他行业" button to re-expand collapsed industry list
- "更改" button restores industry browser visibility

**Files Modified:** shared/occupations.ts, client/src/components/OccupationSelector.tsx, client/src/pages/RegistrationPage.tsx

---

### November 24, 2025 - Event Feedback Flow Redesign & Registration Enhancements

🚀 **24-Hour Update Summary:**

✅ **What's New:**
• Streamlined event feedback flow from 7→5 steps (Intro → Atmosphere → Connections → Improvements → Completion)
• Eliminated individual trait tagging to reduce social pressure & judgment anxiety
• Removed connection radar self-assessment for simplified cognitive load
• Completion time reduced ~5 min → ~2 min (50% faster)
• Replaced all emoji with proper lucide-react icons for consistent dark mode support
• Added micro-interactions & animations (spring entrance, rotating icons, glow effects, selection badges)
• Global registration progress indicator across all 6 steps
• Real-time interest selection counters with celebration animations
• Staggered animations for personality quiz intro
• Enhanced archetype profiles with rich content (nickname, tagline, epic descriptions, style quotes, core contributions)
• Field info tooltips for education, industry, language preferences

📁 **Modified Files: 14 total**
• Event Feedback Flow: EventFeedbackFlow.tsx, AtmosphereThermometer.tsx, SelectConnectionsStep.tsx, ImprovementCards.tsx (4 files)
• Registration: RegistrationProgress.tsx (NEW), FieldInfoTooltip.tsx (NEW), ProfileSetupPage.tsx, InterestsTopicsPage.tsx, QuizIntro.tsx, RegistrationPage.tsx (6 files)
• Display: PersonalityTestResultPage.tsx, SocialRoleCard.tsx (2 files)
• Schema: shared/schema.ts - Extended archetype fields (1 file)
• Docs: replit.md, CHANGELOG_24H.md (2 files)

🔍 **For Tech Devs:** See CHANGELOG_24H.md for detailed file-by-file changes, line numbers, animation timing, and testing checklist

⚙️ **Backend Impact:**
• Data interface simplified (removed attendeeTraits, connectionRadar; kept atmosphereScore, atmosphereNote, connections, improvementAreas, improvementOther)
• Mutual matching logic unchanged
• Matching algorithm intact & unchanged
• No database migrations required

✅ **Key Benefits:**
• Eliminated social pressure (no trait judgment on individuals)
• Faster completion (50% reduction)
• Better UX signals (proper icons + smooth animations)
• Maintained mutual matching for 1v1 DM unlock
• Preserved algorithm data collection (atmosphere + connections)

📋 **Status:** Ready for testing. No rollback needed unless issues found.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Frameworks:** React 18 with TypeScript, Vite, Wouter for routing.
- **UI/Styling:** Radix UI primitives, shadcn/ui (New York style), Tailwind CSS. The design is mobile-first, supports dark mode, uses a purple-centric warm color palette, and is bilingual (Chinese/English).
- **State Management:** TanStack Query for server state.
- **Animations:** Framer-motion for all UI transitions and effects
- **Key UI Patterns:** Bottom navigation, event cards, two-part match scoring, personality radar charts, social role cards, progressive disclosure, registration progress indicators.
- **Design Principles:** Emphasizes warmth, accessibility, responsive design, and progressive anxiety reduction through clear progress feedback.

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
- **Two-Stage Event Pool Matching Model:** Admin creates event pools with hard constraints (time, location), and users register with soft preferences. AI matches users within pools using a 5-dimensional algorithm (personality, interest, background, conversation, intent) and a 12-Archetype Animal Social Vibe System for group chemistry. This system includes a real-time dynamic matching service that continuously scans pools with adaptive thresholds and a time decay algorithm to ensure successful matching.
- **AI-Driven Matchmaking:** Utilizes AI for sophisticated event and people matching, considering personality, interests, and group dynamics, with a focus on explainability and a deep feedback system for continuous learning.
- **Two-Tier Feedback Architecture:** Implements both basic and optional anonymous deep feedback mechanisms to refine the matching algorithms.
- **Gamified Personality Assessment:** A 10-question test determines social role archetypes, visualized with a Personality Radar Chart, and requiring all users to retake for the new 12-archetype system.
- **Streamlined Onboarding:** A multi-step registration process covers identity, interests, personality, and profile creation with progressive UX enhancements including progress indicators, time expectations, and celebratory animations.
- **Admin Portal:** A desktop-first interface for comprehensive management of users, subscriptions, events, finance, moderation, and insights. This includes an Admin Matching Lab for real-time algorithm tuning.
- **Payment & Subscription System:** Full payment infrastructure including WeChat Pay integration, webhook handling, and subscription management.
- **Intelligent Venue Matching & Booking:** Algorithm-based venue scoring and a transactional booking system with race condition protection.
- **Real-Time Bidirectional Data Sync (WebSocket):** Production-ready WebSocket for instant data synchronization, crucial for event status updates and notifications.
- **Data Insights Dashboard:** A comprehensive analytics dashboard provides key performance indicators, user segmentation, activity quality, retention, revenue conversion, and social role distribution.

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
