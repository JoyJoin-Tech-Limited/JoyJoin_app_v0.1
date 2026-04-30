/**
 * CI invariant test: archetypeRegistry.ts ↔ prototypes.ts consistency
 * Ensures archetypeRegistry remains the single source of truth for trait profiles.
 */

import { describe, it, expect } from 'vitest';
import { archetypePrototypes } from '../prototypes';
import { archetypeRegistry } from '../archetypeRegistry';
import { ARCHETYPE_CANONICAL_ORDER } from '../archetypeNames';

describe('archetypeRegistry consistency', () => {
  it('all 12 archetypes have identical trait profiles in registry and prototypes', () => {
    for (const arch of ARCHETYPE_CANONICAL_ORDER) {
      const proto = archetypePrototypes[arch];
      const registry = archetypeRegistry[arch];

      expect(proto, `prototype entry missing for ${arch}`).toBeDefined();
      expect(registry, `registry entry missing for ${arch}`).toBeDefined();

      expect(proto.traitProfile).toEqual(registry.profile.traitProfile);
      expect(proto.energyLevel).toEqual(registry.profile.energyLevel);
      expect(proto.secondaryDifferentiators).toEqual(registry.profile.secondaryDifferentiators);
      expect(proto.confusableWith).toEqual(registry.profile.confusableWith);
      expect(proto.uniqueSignalTraits).toEqual(registry.profile.uniqueSignalTraits);
    }
  });
});
