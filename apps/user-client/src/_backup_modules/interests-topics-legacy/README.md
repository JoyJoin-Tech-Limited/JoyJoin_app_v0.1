# Legacy Interest & Topics Selection System - BACKUP

## What is this?

This folder contains the **legacy interest selection system** that has been replaced by the new **Interest Carousel** system. These files are kept as backup for potential rollback or reference purposes.

## System Overview

### Legacy System (THIS FOLDER)
- **20 Interest Options** - Curated list of activity interests
- **Topic Avoidances** - Users could select topics to avoid in conversations
- **Used in**: InterestsTopicsPage, EditInterestsPage
- **Status**: ❌ DEPRECATED - No longer in active use

### Active System (Current)
- **60 Interest Topics with Heat Levels** - Interest Carousel with categories
- **Used in**: ExtendedDataPage (onboarding flow)
- **Location**: `apps/user-client/src/components/interests/InterestCarousel.tsx`
- **Data**: `apps/user-client/src/data/interestCarouselData.ts`
- **Status**: ✅ ACTIVE

## Why were these files moved?

1. **User Experience Improvement**: The Interest Carousel provides a richer, more engaging selection experience with 60 topics organized by categories
2. **Confusion Prevention**: Having two parallel interest selection systems in the codebase was causing developer confusion
3. **Code Clarity**: The legacy system was no longer routed or accessible in the app, but files remained in active directories

## Files in this backup

### Pages (`pages/`)
- `InterestsTopicsPage.tsx` - Original interest selection page
- `InterestsTopicsPage.legacy.tsx` - Earlier backup version
- `EditInterestsPage.tsx` - Profile edit page for legacy interests

### Components (`components/`)
- `InterestMapping.tsx` - Visualization component for 20-interest system

### Data (`data/`)
- `interestsTopicsData.ts` - Legacy interest and topic data definitions

## When/If to restore

### Restore if:
- User testing shows the carousel is too complex or overwhelming
- Data shows lower completion rates with the new system
- Product team decides to revert to simpler 20-interest model

### How to restore:
1. Copy files back to their original locations:
   - `pages/` → `apps/user-client/src/pages/`
   - `components/` → `apps/user-client/src/components/`
   - `data/` → `apps/user-client/src/data/`
2. Update `App.tsx` to import and route the legacy pages
3. Update `ExtendedDataPage.tsx` to use InterestsTopicsPage instead of InterestCarousel
4. Run tests and verify functionality

## Notes

- **Admin Panel**: The admin client may still use similar interest data for analytics/viewing purposes. Check `apps/admin-client/src/` before making changes.
- **Data Migration**: User data is compatible between systems - both store interests in the same database fields
- **Helper Functions**: Some active components still use `getInterestLabel()` and `getTopicLabel()` helpers from the data file for displaying existing user interests

## Moved On
**Date**: 2026-01-19  
**Reason**: Replaced by Interest Carousel (60 topics) in ExtendedDataPage  
**Original Locations**: See file headers for original paths
