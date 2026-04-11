/**
 * Re-export archetype color mappings from the shared package.
 *
 * This facade preserves backward-compatible import paths (`@/data/archetypeColors`)
 * while the canonical definitions now live in `packages/shared/src/archetypeColors.ts`.
 */
export {
  type ArchetypeHSL,
  ARCHETYPE_COLORS,
  DEFAULT_ACCENT,
  MIN_CONFIDENCE_THRESHOLD,
  getArchetypeHSL,
  formatHSL,
} from "@joyjoin/shared/archetypeColors";

