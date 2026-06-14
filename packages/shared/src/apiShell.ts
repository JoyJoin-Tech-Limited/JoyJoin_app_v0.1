import { z } from 'zod'

// ---------------------------------------------------------------------------
// Discover Predictive Shell — composite endpoint schemas
// ---------------------------------------------------------------------------
// Why: Discover currently fires 3 parallel requests.  A single composite
// endpoint cuts TTFB, eliminates request overhead, and lets the mini-program
// prefetch the entire screen payload from the Landing page.
// ---------------------------------------------------------------------------

export const DiscoverShellPoolItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  eventType: z.string(),
  city: z.string(),
  district: z.string().nullable().optional(),
  dateTime: z.string(),
  status: z.string(),
  registrationCount: z.number(),
  currentParticipants: z.number(),
  maxParticipants: z.number(),
  spotsLeft: z.number(),
  sampleArchetypes: z.array(z.string()),
  topArchetypes: z.array(z.object({ archetype: z.string(), count: z.number() })),
  accentFamily: z.enum(['warm', 'cool', 'fire', 'calm']).nullable().optional(),
  aiHeadline: z.string().nullable(),
  hasUserArchetypeMatch: z.boolean(),
  price: z.number().nullable().optional(),
  userTypeCount: z.number().optional(),
  userTypeRarity: z.enum(['rare', 'present', 'dominant']).optional(),
  highChemistryCount: z.number().optional(),
  topComplementaryType: z.string().nullable().optional(),
  narrativePivot: z.enum(['rare', 'present', 'dominant', 'empty']).optional(),
  hoursUntilDeadline: z.number().optional(),
})

export const DiscoverShellQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(20).optional(),
});

export const DiscoverShellResponseSchema = z.object({
  user: z.object({
    nextStep: z.string(),
    primaryArchetype: z.string().nullable(),
  }),
  pools: z.object({
    items: z.array(DiscoverShellPoolItemSchema),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
  }),
  myRegistrations: z.object({
    ids: z.array(z.string()),
    statuses: z.record(z.string(), z.enum(['pending', 'confirmed', 'cancelled'])),
  }),
  meta: z.object({
    cacheKey: z.string(),
    serverTime: z.string(), // ISO timestamp
  }),
})

export type DiscoverShellPoolItem = z.infer<typeof DiscoverShellPoolItemSchema>
export type DiscoverShellResponse = z.infer<typeof DiscoverShellResponseSchema>

// ── Profile Predictive Shell ────────────────────────────────────────────────

export const ProfileShellResponseSchema = z.object({
  user: z.any(), // AuthUserResponse — validated at runtime by the server
  coupons: z.object({
    count: z.number(),
    availableCount: z.number(),
    coupons: z.array(z.any()),
  }),
  stats: z.object({
    eventsJoined: z.number(),
    connectionsCount: z.number(),
  }),
  meta: z.object({
    cacheKey: z.string(),
    serverTime: z.string(),
  }),
});

export type ProfileShellResponse = z.infer<typeof ProfileShellResponseSchema>

// ── Events Predictive Shell ─────────────────────────────────────────────────

export const EventsShellResponseSchema = z.object({
  user: z.object({
    nextStep: z.string(),
    primaryArchetype: z.string().nullable(),
  }),
  joinedEvents: z.array(z.any()),
  notifications: z.object({
    discover: z.number(),
    activities: z.number(),
    chat: z.number(),
    total: z.number(),
  }),
  meta: z.object({
    cacheKey: z.string(),
    serverTime: z.string(),
  }),
});

export type EventsShellResponse = z.infer<typeof EventsShellResponseSchema>

// ── Connections Predictive Shell ────────────────────────────────────────────

export const ConnectionsShellResponseSchema = z.object({
  user: z.object({
    nextStep: z.string(),
    primaryArchetype: z.string().nullable(),
  }),
  connections: z.array(z.any()),
  pendingRequests: z.array(z.any()),
  notifications: z.object({
    discover: z.number(),
    activities: z.number(),
    chat: z.number(),
    total: z.number(),
  }),
  meta: z.object({
    cacheKey: z.string(),
    serverTime: z.string(),
  }),
});

export type ConnectionsShellResponse = z.infer<typeof ConnectionsShellResponseSchema>
