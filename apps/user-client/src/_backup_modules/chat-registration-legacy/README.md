# Legacy Chat Registration System - BACKUP

## What is this?

This folder contains the **legacy AI chat-based registration system (小悦对话注册)** that has been replaced by the new **DuolingoOnboardingPage** flow. These files are kept as backup for potential rollback or reference purposes.

## System Overview

### Legacy System (THIS FOLDER)
- **AI Chat Interface** - Conversational registration with Xiaoyue AI
- **Multiple Modes** - Express, Standard, Deep, and Enrichment modes
- **Used in**: ChatRegistrationPage
- **Status**: ❌ DEPRECATED - No longer in active use

### Active System (Current)
- **Duolingo-style Onboarding** - Step-by-step questionnaire flow
- **Used in**: DuolingoOnboardingPage
- **Location**: `apps/user-client/src/pages/DuolingoOnboardingPage.tsx`
- **Status**: ✅ ACTIVE

## Why was this moved?

1. **Simpler User Flow**: The Duolingo-style onboarding provides a clearer, more structured experience
2. **Code Organization**: The chat registration is no longer routed in App.tsx but files remained in active directories
3. **Development Clarity**: Prevent confusion about which registration system is currently active

## Files in this backup

### Pages
- `ChatRegistrationPage.tsx` - AI chat registration interface (user-client)
- `ChatRegistrationPage.tsx` - AI chat registration interface (admin-client)

## When/If to restore

### Restore if:
- User testing shows preference for conversational onboarding
- Product team decides to revert to AI chat-based registration
- Need to support both flows simultaneously

### How to restore:
1. Copy files back to `apps/user-client/src/pages/` and `apps/admin-client/src/pages/`
2. Update `App.tsx` routing to include chat registration routes
3. Test the full flow end-to-end

## Moved On
2026-01-20 - Moved to backup as part of onboarding flow cleanup
