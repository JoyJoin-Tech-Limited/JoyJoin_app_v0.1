# Copilot Instructions for JoyJoin App

## Project Overview

JoyJoin is a mobile-first social platform that uses AI-powered personality matching to connect users in small-group social events (blind box matching). The project is a TypeScript monorepo with three main applications:

- **User Client** (`apps/user-client/`): React-based mobile-first user app
- **Admin Client** (`apps/admin-client/`): React-based admin portal (desktop-first)
- **Server** (`apps/server/`): Express.js backend with REST API and WebSocket support

The platform features a 12-archetype personality system based on the ACOEXP 6-trait model, with adaptive V4 personality assessments and AI-powered match explanations.

## Tech Stack

- **Frontend**: React 18, TanStack Query, Tailwind CSS, shadcn/ui components, Wouter routing
- **Backend**: Express.js, Drizzle ORM, PostgreSQL (Neon), WebSocket (ws)
- **AI Services**: OpenAI API (via DeepSeek), used for personality analysis and icebreaker generation
- **Build Tools**: Vite, esbuild, TypeScript 5.6
- **Testing**: Vitest
- **Deployment**: Docker, Docker Compose, Caddy (reverse proxy)

## Build, Test, and Lint Commands

```bash
# Install dependencies
npm install

# Development
npm run dev              # Run full stack dev server (port 5000)
npm run dev:user         # Run user client only
npm run dev:admin        # Run admin client only
npm run dev:server       # Run server only

# Type checking (primary linting)
npm run check            # Full TypeScript check
npx tsc -p apps/user-client/tsconfig.json --noEmit   # User client types
npx tsc -p apps/admin-client/tsconfig.json --noEmit  # Admin client types
npx tsc -p apps/server/tsconfig.json --noEmit        # Server types

# Build
npm run build            # Build all (Vite frontend + esbuild server)
npm run build:user       # Build user client only
npm run build:admin      # Build admin client only
npm run build:server     # Build server only

# Database
npm run db:push          # Sync Drizzle schema to database
npm run db:push --force  # Force sync (use when db:push fails)

# Production
npm run start            # Start production server
```

## Project Structure

```
joyjoin-monorepo/
├── apps/
│   ├── user-client/          # User-facing React app (mobile-first)
│   │   ├── src/
│   │   │   ├── pages/        # Page components
│   │   │   ├── components/   # Reusable UI components
│   │   │   ├── hooks/        # Custom React hooks
│   │   │   ├── lib/          # Utilities (queryClient, etc.)
│   │   │   └── App.tsx       # Main app with routing
│   │   └── tsconfig.json
│   │
│   ├── admin-client/         # Admin portal React app
│   │   ├── src/
│   │   │   ├── pages/admin/  # Admin-specific pages
│   │   │   ├── components/   # Admin UI components
│   │   │   └── AdminApp.tsx  # Admin app entry
│   │   └── tsconfig.json
│   │
│   └── server/               # Express.js backend
│       └── src/
│           ├── routes.ts     # API endpoints
│           ├── storage.ts    # Database storage interface
│           ├── db.ts         # Drizzle database connection
│           ├── index.ts      # Server entry point
│           ├── wsService.ts  # WebSocket service
│           └── tests/        # Server tests and simulations
│
├── packages/
│   └── shared/               # Shared types, schemas, personality system
│       └── src/
│           ├── schema.ts     # Drizzle ORM database schema
│           ├── wsEvents.ts   # WebSocket event interfaces
│           ├── constants.ts  # Shared constants
│           └── personality/  # Personality assessment system
│               ├── matcherV2.ts          # MatcherV2 algorithm
│               ├── questionsV4.ts        # V4 adaptive questions
│               ├── adaptiveEngine.ts     # Question selection engine
│               ├── archetypeRegistry.ts  # 12 archetype definitions
│               └── archetypeCompatibility.ts  # Chemistry matrix
│
├── migrations/               # Drizzle database migrations
├── scripts/                  # Utility scripts
├── docs/                     # Documentation
├── deployment/               # Docker and deployment configs
└── shared/                   # Legacy (use packages/shared instead)
```

## Code Conventions

### TypeScript

- Use strict TypeScript mode (`strict: true`)
- Prefer explicit types over `any`
- Use Zod for runtime validation

### Import Aliases

```typescript
// User client - use @/ for src directory
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

// Shared package - use @shared/ 
import { users, events } from "@shared/schema";
import { TraitKey } from "@shared/personality/types";
```

### Naming Conventions

- **Components**: `PascalCase.tsx` (e.g., `StyleSpectrum.tsx`)
- **Pages**: `PascalCasePage.tsx` (e.g., `ProfilePage.tsx`)
- **Hooks**: `use*.ts` (e.g., `useAuth.ts`)
- **Services**: `*Service.ts` (e.g., `poolMatchingService.ts`)

### API Patterns

```typescript
// TanStack Query - fetching
const { data, isLoading } = useQuery({
  queryKey: ['/api/users', userId],
});

// TanStack Query - mutations
const mutation = useMutation({
  mutationFn: (data) => apiRequest('/api/users', 'POST', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/users'] });
  },
});
```

### Component Patterns

- Use shadcn/ui components from `@/components/ui/`
- Follow existing component structure in the codebase
- Mobile-first responsive design for user client
- Desktop-first for admin client

## Key Systems

### 12-Archetype Personality System

The platform uses 12 animal-based archetypes based on the ACOEXP 6-trait model:
- **Traits**: A (Affinity), C (Conscientiousness), O (Openness), E (Emotional Stability), X (Extraversion), P (Positivity)
- **Key files**: `packages/shared/src/personality/`
- **MatcherV2**: Main matching algorithm in `matcherV2.ts`
- **Archetypes**: Defined in `archetypeRegistry.ts`

### Event Pool Matching

Two-stage matching model:
1. Pool Registration → User submits preferences
2. AI Matching → Forms optimal groups based on chemistry

Key files:
- `apps/server/src/poolMatchingService.ts`
- `apps/server/src/archetypeChemistry.ts`

### WebSocket Events

Real-time updates for matches and chat via WebSocket:
- Event types defined in `packages/shared/src/wsEvents.ts`
- Server implementation in `apps/server/src/wsService.ts`

## CI/CD Pipeline

GitHub Actions workflow runs on push to `main`:

1. **Type Check**: User client, admin client, and server (parallel)
2. **AI Simulation Test**: Runs personality matching simulations
3. **Production Deployment**: Docker-based deployment via SSH

Always run type checking before submitting PRs:
```bash
npx tsc -p apps/user-client/tsconfig.json --noEmit
npx tsc -p apps/admin-client/tsconfig.json --noEmit
npx tsc -p apps/server/tsconfig.json --noEmit
```

## Security Guidelines

- Never commit secrets or credentials to the repository
- Use environment variables for sensitive configuration
- All AI endpoints are rate-limited and auth-gated
- Session management via `express-session`
- Authentication via SMS verification and passport

### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session encryption |
| `AMAP_API_KEY` | Gaode Maps API |
| `DEEPSEEK_API_KEY` | AI service |

## Contribution Guidelines

1. **Branch from `main`** for all changes
2. **Run type checks** before submitting PRs
3. **Follow existing patterns** - match the style of surrounding code
4. **Update documentation** if making structural changes
5. **Test locally** - run `npm run dev` to verify changes work

### PR Requirements

- All TypeScript type checks must pass
- Changes should be focused and minimal
- Avoid breaking existing functionality
- Reference related issues in PR descriptions

## Debugging Tips

### Frontend

- Check TanStack Query cache invalidation for stale data
- Verify auth state in `useAuth` hook for routing issues
- Check Tailwind class conflicts for styling issues

### Backend

- Run `npm run db:push --force` for database schema sync issues
- Check `wsService.ts` for WebSocket connection problems
- Verify session middleware for authentication issues

### Personality System

- Check VETO thresholds in `matcherV2.ts` for archetype assignment issues
- Verify score calculations aren't double-multiplying
- Check `≥70%` threshold filter for adjacent style display

## Key Documentation

- `DEVELOPER_QUICK_REFERENCE.md` - Comprehensive developer guide
- `PRODUCT_REQUIREMENTS.md` - Product specifications
- `design_guidelines.md` - UI/UX guidelines
- `docs/` - Additional documentation

