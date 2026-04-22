---
name: venue-location-services
description: >
  Venue catalog, assignment, matching, and geocoding services for JoyJoin events.
  Covers the admin-managed venue database, automatic venue-to-group assignment after pool matching,
  time-slot availability, venue-deal management, AMap/Gaode geocoding integration, and
  venue data quality validation. Use when working with venue CRUD, assignment scoring,
  location APIs, or deal/booking lifecycles. Trigger phrases: venue assignment, venue matching,
  AMap picker, geocode address, venue time slot, venue deal, venue data quality,
  assignVenuesToGroups, venueMatchingService, /api/admin/venues, /api/venues.
---

# venue-location-services

**Core rule:** Venues are an admin-curated catalog. The server owns assignment scoring, time-slot availability, and deal entitlements; the admin portal owns map-based geocoding via AMap. Venue assignment runs deterministically after pool matching completes.

---

## When to use this skill

- Adding, updating, or deleting venue records (admin CRUD)
- Changing venue assignment logic (`assignVenuesToGroups`) or scoring weights
- Modifying venue matching criteria (`VenueMatchingService`) for event planning
- Working with venue time slots (`venueTimeSlots`, `venueTimeSlotBookings`) or availability checks
- Adding or modifying venue deals (discounts, redemption flows)
- Integrating or debugging AMap/Gaode geocoding, place search, or the admin `AmapPicker`
- Running or extending venue data quality checks (`checkVenueDataQuality`)
- Adding new venue-related public or admin API routes

## When NOT to use this skill

- Pool matching or group formation logic → use `event-pool-and-matching-operations`
- Pair compatibility scoring or match weights → use `matching-domain`
- Admin RBAC, audit logging, or role checks → use `admin-audit-and-rbac-governance`
- LLM provider routing or AI-generated content → use `llm-runtime-safety-and-integration`
- Generic frontend UI layout unrelated to venue maps → use `frontend-component-architecture`

---

## Venue Catalog Schema

The canonical venue model lives in `packages/shared/src/schema.ts` (`venues` table):

| Field | Purpose |
|-------|---------|
| `venueType` | `restaurant`, `bar`, `homebar`, `cafe` |
| `city` / `area` | Hard location constraints (深圳, 香港 + district) |
| `cuisines` | Array of cuisine tags for matching |
| `budgetCategories` | Supported budget ranges (e.g., `["150-200", "200-300"]`) |
| `decorStyle` | Style tags: 轻奢现代风, 绿植花园风, etc. |
| `barThemes` / `alcoholOptions` | Bar-specific tags |
| `capacity` | Concurrent-event capacity (not seating; known limitation) |
| `partnerStatus` | `active`, `paused`, `ended` |
| `isActive` | Soft-delete flag |

Related tables: `venueDeals`, `venueTimeSlots`, `venueTimeSlotBookings`.

## Venue Assignment (Post-Match)

After pool matching completes, `assignVenuesToGroups` scores every available venue for each matched group:

1. **Budget Match (40 pts)** — hard fail if no overlap with group consensus (30% threshold)
2. **Cuisine Match (30 pts)** — overlap between group cuisine preferences and venue tags
3. **Capacity Match (20 pts)** — `venue.capacity >= groupSize`
4. **Location (10 pts)** — same city/district (placeholder for future geo distance)

Time-slot availability is checked in parallel before scoring. Assignments are persisted to `eventPoolGroups.venueId`, `venueName`, `venueAddress`.

## Venue Matching (Event Planning)

`VenueMatchingService.findMatchingVenues(criteria)` scores candidates for event planning:

- Event type match (20 pts)
- Capacity match (25 pts)
- City + district match (20 pts)
- Cuisine match (15 pts, dining only)
- Price range match (10 pts)
- Decor style match (10 pts)
- Time slot availability bonus (10 pts)

Cross-day events (spanning midnight) are rejected. Returns top 5 venues.

## AMap / Gaode Integration

- Env vars: `AMAP_API_KEY`, `AMAP_SECURITY_KEY`
- Admin endpoint: `GET /api/config/amap` (returns keys; `requireAdmin` gated)
- Component: `apps/admin-client/src/components/AmapPicker.tsx`
- Uses `@amap/amap-jsapi-loader` v2.0 with `AMap.Geocoder` and `AMap.PlaceSearch`
- Default center: Shenzhen (`22.5431, 114.0579`)
- Place search city is hardcoded to `深圳` — update if expanding to other cities

## Venue Data Quality

`apps/server/src/lib/venueDataQuality.ts` runs lightweight validation:

- Required fields: name, venueType, address, city, area
- Contact info present (contactPerson or contactPhone)
- Budget/price range configured
- Duplicate name detection
- Partner status consistency (`ended` + `isActive` is a warning)

Endpoint: `GET /api/admin/venues/data-quality`

---

## Quick Examples

**Example 1: Add a new budget category to venue assignment scoring**

```ts
// In apps/server/src/venueAssignmentService.ts
// The budget consensus uses the group's selected budget ranges.
// If adding a new range (e.g., "500+"), ensure:
// 1. The new value is accepted in the registration/pool form
// 2. venues.budgetCategories can include it
// 3. The scoring logic still caps at 40 pts and hard-fails on zero overlap
```

**Example 2: Debug "no venue assigned to group"**

1. Check `eventPools.city` and `district` match active venues
2. Check `venueTimeSlots` for the event date/time (dayOfWeek vs specificDate)
3. Verify `venues.venueType` is `restaurant`/`cafe` for 饭局, `bar`/`homebar` for 酒局
4. Check group budget consensus — if group has no budget overlap with any venue, score = 0
5. Check `venues.isActive = true` and `partnerStatus != 'ended'`

**Example 3: Add a geocoded lat/lng field to the venue schema**

```ts
// 1. Add columns in packages/shared/src/schema.ts
lat: numeric("lat", { precision: 10, scale: 7 }),
lng: numeric("lng", { precision: 10, scale: 7 }),

// 2. Update admin create/update routes to accept lat/lng
// 3. Wire AmapPicker onSelect into the admin venue form
// 4. Run npm run db:generate (or db:push in dev)
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Groups matched but no venue assigned | No time slots cover the event datetime; or no budget overlap | Add time slots for that day/time; check registration budget options |
| `AmapPicker` shows "地图加载失败" | Missing `AMAP_API_KEY` or `AMAP_SECURITY_KEY` | Set env vars and restart server; verify `/api/config/amap` returns keys |
| Venue data quality shows duplicate names | Same venue added twice with slight name differences | Merge duplicates; add DB unique constraint if product agrees |
| `venueMatchingService` returns empty for dining event | `dateTime` crosses midnight (not supported) or no slots available | Split cross-day events; add time slots |
| Admin can't see venue deals on event page | `partnerStatus` is not `active` or deals are expired | Update `partnerStatus` or deal `validUntil` |

---

## Review checklist

- [ ] New venue fields are added to `packages/shared/src/schema.ts` and follow existing naming
- [ ] Admin routes use `requireAdmin` + `requireOperatorOrAbove` for mutations
- [ ] Venue assignment scoring weights sum to 100 (or documented if changed)
- [ ] Time-slot queries handle both `dayOfWeek` and `specificDate` modes
- [ ] AMap keys are never logged or sent to non-admin clients
- [ ] Venue data quality rules are updated if new required fields are introduced
- [ ] Deal/booking routes check `partnerStatus` or `isActive` before returning data
- [ ] Cross-day event rejection is preserved if modifying `VenueMatchingService`

---

## Related skills

| Skill | When to hand off |
|-------|------------------|
| `event-pool-and-matching-operations` | Venue assignment is triggered by match-run; pool lifecycle owns the caller |
| `matching-domain` | If changes touch group formation or pair scoring, not venue scoring |
| `admin-audit-and-rbac-governance` | When adding new admin routes or changing venue mutation permissions |
| `database-migration-safety` | When adding venue schema columns or tightening constraints |
| `platform-coordination-protocol` | When venue details or deals appear in both web and mini-program surfaces |
| `llm-runtime-safety-and-integration` | If adding AI-generated venue descriptions or vibe copy |
| `backend-models-standards` | When defining new Drizzle tables or relationships for venue sub-features |

---

## Canonical References

- `apps/server/src/venueAssignmentService.ts` — post-match group-to-venue assignment
- `apps/server/src/venueMatchingService.ts` — event-planning venue scoring
- `apps/server/src/lib/venueDataQuality.ts` — data quality rules and report
- `apps/server/src/routes.ts` — venue/deal/booking/time-slot routes (search `/api/admin/venues` and `/api/venues`)
- `apps/server/src/routes/domains/admin.ts` — `GET /api/config/amap`
- `apps/admin-client/src/components/AmapPicker.tsx` — AMap geocoding UI
- `packages/shared/src/schema.ts` — `venues`, `venueDeals`, `venueTimeSlots`, `venueTimeSlotBookings`
