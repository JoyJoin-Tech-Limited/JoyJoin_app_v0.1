# ⚠️ LEGACY — DO NOT USE: Chat Registration Backup (Admin Client)

> **STATUS: QUARANTINED — NOT ACTIVE RUNTIME CODE**
>
> Files in this folder are **NOT part of any active onboarding or registration flow**.
> They exist only as historical backup / potential rollback material.
> Do NOT import, route to, or extend anything in this directory for new features.

## What is this?

This folder contains the **legacy AI chat-based registration system (小悦对话注册)**
for the admin client. It was decommissioned on **2026-01-20** as part of the
onboarding flow cleanup.

## Active onboarding flow (as of 2026-02)

The current onboarding is **server-driven** via the `nextStep` field returned by
`GET /api/auth/user`. Steps are:

| `nextStep` value | Route | Component |
|-----------------|-------|-----------|
| `personality-test` | `/personality-test` | `PersonalityTestPageV4` |
| `essential-data` | `/onboarding/setup` | `EssentialDataPage` |
| `extended-data` | `/onboarding/extended` | `ExtendedDataPage` |
| `profile-review` | `/onboarding/review` | `FinalProfileReviewPage` |
| `discover` | `/discover` | `DiscoverPage` |

See `apps/user-client/src/App.tsx` → `AuthenticatedRouter` for authoritative routing.

## Files in this backup

- `pages/ChatRegistrationPage.tsx` — AI chat registration interface (admin-client copy)

## Moved on

2026-01-20 — Moved to backup as part of onboarding flow cleanup.
2026-03-18 — Explicitly quarantined; README added.
