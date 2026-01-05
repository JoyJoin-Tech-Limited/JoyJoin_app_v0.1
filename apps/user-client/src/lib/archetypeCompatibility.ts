/**
 * Archetype Compatibility - Re-export from shared package
 * This file re-exports the unified compatibility data from @shared/personality
 * to maintain backwards compatibility with existing imports
 */

export {
  compatibilityMatrix,
  getArchetypeCompatibility,
  getTopCompatibleArchetypes,
  getCompatibilityCategory,
  getChemistryForArchetype,
  getCompatibilityDescription,
  ARCHETYPE_COMPATIBILITY_DESCRIPTIONS,
  ALL_ARCHETYPES,
  type ArchetypeName,
  type ChemistryResult,
} from '@shared/personality/archetypeCompatibility';
