// apps/server/src/archetypeConfig.ts
import { ARCHETYPE_CANONICAL_ORDER, type ArchetypeName } from '@shared/personality/archetypeNames';

/**
 * Canonical archetype names - imported from shared module
 * This ensures consistency with user-client and prevents ordering drift
 */
export const ARCHETYPE_NAMES = ARCHETYPE_CANONICAL_ORDER;

export type { ArchetypeName };
