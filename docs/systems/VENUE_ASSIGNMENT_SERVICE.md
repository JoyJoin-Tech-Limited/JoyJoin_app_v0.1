# Venue Assignment Service

> Canonical reference for automatic venue-to-group assignment after pool matching. Last updated: 2026-06-16

## Overview

After an admin triggers pool matching (`POST /api/admin/pools/:poolId/match`), the matching algorithm forms groups. The **Venue Assignment Service** then automatically assigns the optimal partner venue to each matched group based on budget, time slot availability, capacity, and district alignment.

**Entry point:** `apps/server/src/venueAssignmentService.ts`

## Architecture

```
Pool Matching completes
    ↓
saveMatchResults() calls assignVenuesToGroups()
    ↓
assignVenuesToGroups()  →  scoring + filtering  →  assignments + unassigned maps
    ↓
saveVenueAssignments()  →  atomic transaction  →  venue_time_slot_bookings + event_pool_groups
    ↓
WeCom alert (if unassigned) + in-app notifications (venue_assigned / venue_tbd)
```

## Assignment Criteria

A venue must satisfy **all** of the following to be eligible:

| Criterion | Field | Rule |
|-----------|-------|------|
| **Status** | `isActive`, `onboardingStatus`, `partnerStatus` | All three must be `true` / `'active'` |
| **Contract** | `contractEndDate` | Must be `NULL` or `>= CURRENT_DATE` |
| **District** | `city`, `area` | Must match the event pool's city and district |
| **Type** | `venueType` | `bar` / `homebar` for 酒局; `restaurant` / `cafe` for 饭局 |
| **Time slot** | `venue_time_slots` | Must have an active slot covering the event time with `bookingCount < maxConcurrentEvents` |
| **Budget** | `budgetCategories` vs group consensus | Must overlap with group budget (≥30% threshold) |
| **Capacity** | `seatingCapacity` | Hard constraint: `seatingCapacity >= groupSize` (score=0 if violated) |

## Scoring Algorithm

`scoreVenueForGroup()` returns 0–100:

1. **Capacity Hard Constraint** (gate): `seatingCapacity < groupSize` → score=0, immediate rejection
2. **Budget Match** (40 pts): overlap between group consensus budgets and venue `budgetCategories`
3. **Cuisine Match** (30 pts): overlap between group cuisine preferences and venue `cuisines`
4. **Capacity Bonus** (20 pts): awarded if `seatingCapacity >= groupSize`
5. **Location** (10 pts): default (district matching is future work)

## Time Slot Availability

`checkTimeSlotAvailability()` checks both:
- **Weekly recurring slots**: `dayOfWeek` matching the event date
- **Specific date slots**: `specificDate` matching the event date

Returns the first slot where `bookingCount < maxConcurrentEvents`.

## Concurrency & Race Condition Protection

Two mechanisms prevent overbooking:

1. **In-memory tracker** (`slotUsageTracker`): prevents multiple groups in the same pool from being assigned to the same slot beyond capacity
2. **Transaction-level row locking**: `saveVenueAssignments()` uses `FOR UPDATE` on both:
   - `venue_time_slots` rows (serializes per-slot access even when zero bookings exist)
   - `venue_time_slot_bookings` rows (ensures count consistency)

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `venues` | Partner venue catalog |
| `venue_time_slots` | Available time slots per venue (weekly + specific date) |
| `venue_time_slot_bookings` | Confirmed bookings per slot per date |
| `event_pool_groups` | Matched groups with `venueAssignmentStatus` / `venueAssignmentReason` |

### Indexes

```sql
-- venue_time_slots
idx_venue_time_slots_lookup   (venue_id, day_of_week, is_active, start_time, end_time)
idx_venue_time_slots_specific (venue_id, specific_date, is_active, start_time, end_time)

-- venue_time_slot_bookings
idx_vtsb_slot_date_status (time_slot_id, booking_date, status)
idx_vtsb_group_status     (event_group_id, status)
idx_vtsb_venue_date       (venue_id, booking_date, status)

-- event_pool_groups
idx_event_pool_groups_pool         (pool_id)
idx_event_pool_groups_venue_status (venue_assignment_status)
```

## API Integration

### User-facing

`GET /api/pool-groups/:groupId` returns:
```json
{
  "group": {
    "venueName": "Delete Bar大喇叭精酿",
    "venueAddress": "深圳市南山区...",
    "venueAssignmentStatus": "assigned",
    "venueAssignmentReason": null
  }
}
```

`venueName` is resolved as `COALESCE(brand_name, name)` so the public brand name is shown when populated, falling back to the internal venue name otherwise.

When `venueAssignmentStatus === 'unassigned'`, the mini-program shows a "地点待定" state.

### Admin-facing

`GET /api/admin/pools` and pool detail pages show:
- Assigned groups: green "已分配: {venueName}" badge
- Unassigned groups: "未分配场地" badge + reason chip (预算不匹配 / 容量不足 / 无可用时段 / 时段已满)

## Unassigned Reason Codes

| Code | Label | Meaning |
|------|-------|---------|
| `budget_mismatch` | 预算不匹配 | Group budget ranges don't overlap with any venue's `budgetCategories` |
| `capacity_insufficient` | 容量不足 | All available venues have `seatingCapacity < groupSize` |
| `no_available_slots` | 无可用时段 | No venues have active time slots covering the event time |
| `slot_fully_booked_at_save` | 时段已满 | Slot was available at scoring time but reached capacity during transaction |
| `no_suitable_venue` | 无合适场地 | Catch-all when none of the above apply |

## Observability

- **Log prefix:** `[VenueAssignment]`
- **WeCom alert:** Fires when any pool has ≥1 unassigned group (reason breakdown included)
- **In-app notifications:** `venue_assigned` / `venue_tbd` sent to all group members

## Feature Flag

`venueAssignmentEnabled` is a **DB-backed feature flag** (2026-06-17) registered in `FLAG_ENV_MAP` at `apps/server/src/lib/featureFlags.ts`. The DB row is the source of truth; env var `VENUE_ASSIGNMENT_ENABLED` is the fallback.

| Identifier | Admin toggle key | Default | Description |
|-----------|-----------------|---------|-------------|
| `venueAssignmentEnabled` | `venueAssignmentEnabled` | `true` | When `false`, venue assignment is skipped after matching. Server-side only — not exposed in auth response `features`. |

## Launch Gate Checklist

- [ ] DB indexes created and `EXPLAIN ANALYZE` confirms usage
- [ ] Timezone consistency verified (`parseEventDate` helper)
- [ ] Capacity hard constraint enforced
- [ ] Race condition test passes (concurrent assignment simulation)
- [ ] Contract expiry check active
- [ ] WeCom alert fires for unassigned groups
- [ ] Mini-program shows "地点待定" gracefully
- [ ] Admin dashboard shows unassigned reason codes
- [ ] Unit tests pass (9 scenarios)
