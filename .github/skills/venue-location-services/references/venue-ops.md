# Venue Ops Reference

## Tencent Maps geocoding details

- Env var: `TENCENT_MAP_KEY`
- Admin endpoint: `GET /api/config/map` (returns key; `requireAdmin` gated)
- Component: `apps/admin-client/src/components/MapPicker.tsx`
- Uses Tencent Maps JavaScript SDK (`TMap`) with `TMap.service.Geocoding` and `TMap.service.PlaceSearch`
- Default center: Shenzhen (`22.5431, 114.0579`)
- Place search city is hardcoded to `深圳` — update if expanding to other cities

> **Migration history:** Migrated from AMap (Gaode) to Tencent Maps on 2026-06-17. Old AmapPicker.tsx deleted; `AMAP_API_KEY`/`AMAP_SECURITY_KEY` env vars replaced by `TENCENT_MAP_KEY`. See git history for the pre-migration code.

## Time-slot availability logic

Related tables: `venueTimeSlots`, `venueTimeSlotBookings`.

Time-slot availability is checked in parallel before scoring. Assignments are persisted to `eventPoolGroups.venueId`, `venueName`, `venueAddress`.

## Venue-deal management

Related table: `venueDeals`.

Admin routes use `requireAdmin` + `requireOperatorOrAbove` for mutations.
Deal/booking routes check `partnerStatus` or `isActive` before returning data.

## Data quality validation rules

`apps/server/src/lib/venueDataQuality.ts` runs lightweight validation:

- Required fields: name, venueType, address, city, area
- Contact info present (contactPerson or contactPhone)
- Budget/price range configured
- Duplicate name detection
- Partner status consistency (`ended` + `isActive` is a warning)

Endpoint: `GET /api/admin/venues/data-quality`

## Assignment algorithm specifics

### Venue Assignment (Post-Match)

After pool matching completes, `assignVenuesToGroups` scores every available venue for each matched group:

1. **Budget Match (40 pts)** — hard fail if no overlap with group consensus (30% threshold)
2. **Cuisine Match (30 pts)** — overlap between group cuisine preferences and venue tags
3. **Capacity Match (20 pts)** — `venue.capacity >= groupSize`
4. **Location (10 pts)** — same city/district (placeholder for future geo distance)

### Venue Matching (Event Planning)

`VenueMatchingService.findMatchingVenues(criteria)` scores candidates for event planning:

- Event type match (20 pts)
- Capacity match (25 pts)
- City + district match (20 pts)
- Cuisine match (15 pts, dining only)
- Price range match (10 pts)
- Decor style match (10 pts)
- Time slot availability bonus (10 pts)

Cross-day events (spanning midnight) are rejected. Returns top 5 venues.

## Canonical References

- `apps/server/src/venueAssignmentService.ts` — post-match group-to-venue assignment
- `apps/server/src/venueMatchingService.ts` — event-planning venue scoring
- `apps/server/src/lib/venueDataQuality.ts` — data quality rules and report
- `apps/server/src/routes.ts` — venue/deal/booking/time-slot routes
- `apps/server/src/routes/domains/admin.ts` — `GET /api/config/map` (Tencent Maps key)
- `apps/admin-client/src/components/MapPicker.tsx` — Tencent Maps geocoding UI
- `packages/shared/src/schema.ts` — `venues`, `venueDeals`, `venueTimeSlots`, `venueTimeSlotBookings`
