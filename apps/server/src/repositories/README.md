# Database Repositories

Repository pattern for database persistence in JoyJoin server.

## Design

- Each repository wraps Drizzle ORM queries for a domain
- Queries use `import { db } from '../db'` — a wrapped Neon Serverless Drizzle instance
- New persistence logic goes in `repositories/`, not `storage.ts`

## Repository list

- `venuesRepo.ts` — Venue CRUD, time slots, bookings, availability
- `notificationsRepo.ts` — In-app notification records
- `kpiRepo.ts` — KPI analytics queries
- `adminOutcomeAnalyticsRepo.ts` — Event outcome analytics

## Patterns

- Transactional writes use `db.transaction(async (tx) => { ... })`
- Read queries use raw `db.select()`
- Export typed repository interfaces for testability
