# ⚠️ LEGACY — DO NOT USE: Chat Registration Backup (User Client)

> **STATUS: QUARANTINED — NOT ACTIVE RUNTIME CODE**
>
> Files in this folder are **NOT part of any active onboarding or registration flow**.
> They exist only as historical backup / potential rollback material.
> Do NOT import, route to, or extend anything in this directory for new features.

## What is this?

This folder contains the **legacy AI chat-based registration system (小悦对话注册)**
for the user client. It was decommissioned on **2026-01-20** as part of the
onboarding flow cleanup.

## System Overview

### Legacy System (THIS FOLDER)
- **AI Chat Interface** - Conversational registration with Xiaoyue AI
- **Multiple Modes** - Express, Standard, Deep, and Enrichment modes
- **Used in**: ChatRegistrationPage
- **Status**: ❌ DEPRECATED — NOT active, NOT routed, NOT in use

### Active System (Current — as of 2026-02)
The onboarding flow is **server-driven** via the `nextStep` field returned by
`GET /api/auth/user`. See `apps/user-client/src/App.tsx` → `AuthenticatedRouter`.

| `nextStep` value | Route | Component |
|-----------------|-------|-----------|
| `personality-test` | `/personality-test` | `PersonalityTestPageV4` |
| `essential-data` | `/onboarding/setup` | `EssentialDataPage` |
| `extended-data` | `/onboarding/extended` | `ExtendedDataPage` |
| `profile-review` | `/onboarding/review` | `FinalProfileReviewPage` |
| `discover` | `/discover` | `DiscoverPage` |

> **Note:** `DuolingoOnboardingPage` referenced in older versions of this README
> was also subsequently replaced and is itself no longer the active flow.

## Why was this moved?

1. **Simpler User Flow**: The structured onboarding provides a clearer, server-driven experience
2. **Code Organization**: The chat registration is no longer routed in App.tsx
3. **Development Clarity**: Prevent confusion about which registration system is currently active

## Files in this backup

### Pages
- `ChatRegistrationPage.tsx` — AI chat registration interface (user-client copy)

## Moved On
2026-01-20 — Moved to backup as part of onboarding flow cleanup
2026-03-18 — README updated to reflect current active architecture; file quarantined
