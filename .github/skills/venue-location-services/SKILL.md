---
name: venue-location-services
description: >
  Venue catalog, assignment, matching, and geocoding services for JoyJoin events.
  Covers the admin-managed venue database, automatic venue-to-group assignment after pool matching,
  time-slot availability, venue-deal management, Tencent Maps geocoding integration, and
  venue data quality validation. Use when working with venue CRUD, assignment scoring,
  location APIs, or deal/booking lifecycles. Trigger phrases: venue assignment, venue matching,
  MapPicker, geocode address, venue time slot, venue deal, venue data quality,
  assignVenuesToGroups, venueMatchingService, /api/admin/venues, /api/venues.
---

# venue-location-services

**Core rule:** Venues are an admin-curated catalog. The server owns assignment scoring, time-slot availability, and deal entitlements; the admin portal owns map-based geocoding via Tencent Maps. Venue assignment runs deterministically after pool matching completes.

## When to use this skill

- Adding, updating, or deleting venue records (admin CRUD)
- Changing venue assignment logic (`assignVenuesToGroups`) or scoring weights
- Modifying venue matching criteria (`VenueMatchingService`) for event planning
- Working with venue time slots or availability checks
- Adding or modifying venue deals
- Integrating or debugging Tencent Maps geocoding, place search, or the admin `MapPicker`
- Running or extending venue data quality checks

## Venue catalog overview

The canonical venue model lives in `packages/shared/src/schema.ts` (`venues` table):

| Field | Purpose |
|-------|---------|
| `name` | Internal identifier / fallback display name |
| `brandName` | Actual restaurant/bar brand name shown to users and admins |
| `venueType` | `restaurant`, `bar`, `homebar`, `cafe` |
| `city` / `area` | Hard location constraints (深圳, 香港 + district) |
| `cuisines` | Array of cuisine tags for matching |
| `budgetCategories` | Supported budget ranges |
| `capacity` | Concurrent-event capacity |
| `partnerStatus` | `active`, `paused`, `ended` |
| `isActive` | Soft-delete flag |

Related tables: `venueDeals`, `venueTimeSlots`, `venueTimeSlotBookings`.

## Assignment scoring overview

After pool matching completes, `assignVenuesToGroups` scores every available venue for each matched group:

1. **Budget Match (40 pts)** — hard fail if no overlap with group consensus
2. **Cuisine Match (30 pts)** — overlap between group preferences and venue tags
3. **Capacity Match (20 pts)** — `venue.capacity >= groupSize`
4. **Location (10 pts)** — same city/district

For Tencent Maps geocoding details, time-slot availability logic, venue-deal management, data quality validation rules, and assignment algorithm specifics — see [references/venue-ops.md](references/venue-ops.md).

## Quick examples

**Example 1: Add a new budget category to venue assignment scoring**
Ensure the new value is accepted in the registration/pool form, `venues.budgetCategories` can include it, and the scoring logic still caps at 40 pts with hard-fail on zero overlap.

**Example 2: Debug "no venue assigned to group"**
1. Check `eventPools.city` and `district` match active venues
2. Check `venueTimeSlots` for the event date/time
3. Verify `venues.venueType` matches event type
4. Check group budget consensus — zero overlap means score = 0
5. Check `venues.isActive = true` and `partnerStatus != 'ended'`

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Groups matched but no venue assigned | No time slots cover the event datetime; or no budget overlap | Add time slots; check registration budget options |
| `MapPicker` shows "地图配置不可用" | Missing `TENCENT_MAP_JS_KEY` or `TENCENT_MAP_KEY` | Set the JS key env var and restart server; verify `/api/config/map` returns the key |
| Venue data quality shows duplicate names | Same venue added twice with slight name differences | Merge duplicates; prefer `brandName` for user-facing identity; add DB unique constraint if product agrees |
| `venueMatchingService` returns empty for dining event | `dateTime` crosses midnight (not supported) or no slots available | Split cross-day events; add time slots |
| Admin can't see venue deals on event page | `partnerStatus` is not `active` or deals are expired | Update `partnerStatus` or deal `validUntil` |

## Review checklist

- [ ] New venue fields are added to `packages/shared/src/schema.ts` and follow existing naming
- [ ] Admin routes use `requireAdmin` + `requireOperatorOrAbove` for mutations
- [ ] Venue assignment scoring weights sum to 100 (or documented if changed)
- [ ] Time-slot queries handle both `dayOfWeek` and `specificDate` modes
- [ ] Tencent Maps keys are never logged or sent to non-admin clients
- [ ] Venue data quality rules are updated if new required fields are introduced
- [ ] Deal/booking routes check `partnerStatus` or `isActive` before returning data
- [ ] Cross-day event rejection is preserved if modifying `VenueMatchingService`
