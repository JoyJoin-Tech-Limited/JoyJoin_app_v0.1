/**
 * Canonical TanStack Query keys for the equipment/wardrobe domain.
 * Kept dependency-free on purpose: the persistent-cache layer
 * (lib/api/persistentCache.ts) imports this module, and any import of the API
 * client from here would create a module cycle (persistentCache → equipmentApi
 * → api → authSession → queryClient → persistentCache).
 */
export const EQUIPMENT_ME_QUERY_KEY = ['mini-program', 'equipment', 'me'] as const
