# Shared Types

Core TypeScript type definitions and DTO contracts shared across JoyJoin workspaces.

## What belongs here

- Cross-app interface and type definitions
- API response/request DTOs
- Enum and union types used by multiple surfaces
- Type-only barrel exports consumed by server, web, and mini-program

## What does NOT belong here

- App-specific types (leave in the app)
- Server secrets or config types (use `config.ts` in server)
- Component props (co-locate with the component)
- One-off helper types for a single workspace

## Key types

- User profile types (PersonalityProfile, ArchetypeResult, etc.)
- Event types (EventPool, EventGroup, Registration, etc.)
- Payment types (PaymentIntent, Coupon, Subscription, etc.)
- Assessment V4 types (AssessmentSession, Answer, Question, etc.)
- API transport wrappers and normalizers

## Usage

```ts
import { type SomeType } from '@joyjoin/shared';
// or via subpath:
import { type SomeType } from '@joyjoin/shared/types';
```
