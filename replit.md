# Local Micro-Events Social Network (JoyJoin)

## Overview

JoyJoin (悦聚·Joy) is a social networking platform that connects individuals locally through small, curated micro-events (5-10 attendees). It uses AI for intelligent user matching based on interests, personality, and social compatibility, prioritizing psychological safety and inclusivity. Primarily targeting the Hong Kong/Shenzhen market, JoyJoin aims to foster meaningful local connections and build community. Key features include AI-powered matching, a comprehensive feedback system, streamlined event management, and a robust Admin Portal. A core innovation is the 12-Archetype Animal Social Vibe System for sophisticated group dynamics and chemistry matching.

## User Preferences

Preferred communication style: Simple, everyday language.

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