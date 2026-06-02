#!/usr/bin/env node
/**
 * Boundary Persona Generator
 * Generates personas that sit on confusion hyperplanes between confusable archetypes
 */

import { archetypeRegistry, type ArchetypeId } from '../../packages/shared/src/personality/archetypeRegistry';
import { TraitKey } from '../../packages/shared/src/personality/types';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addTraitNoise, type Persona } from './lib/persona-utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

// Collect unique confusion pairs from the registry
function collectConfusionPairs(): Array<[ArchetypeId, ArchetypeId]> {
  const pairs = new Set<string>();
  const result: Array<[ArchetypeId, ArchetypeId]> = [];

  for (const [archetypeId, record] of Object.entries(archetypeRegistry)) {
    for (const confusable of record.profile.confusableWith) {
      // Store canonical ordering (alphabetical) to avoid duplicates
      const pairKey = [archetypeId, confusable].sort().join(':');
      if (!pairs.has(pairKey)) {
        pairs.add(pairKey);
        const [a, b] = pairKey.split(':') as [ArchetypeId, ArchetypeId];
        result.push([a, b]);
      }
    }
  }

  return result;
}

function interpolateTraits(
  archetypeA: ArchetypeId,
  archetypeB: ArchetypeId,
  ratio: number
): Record<TraitKey, number> {
  const protoA = archetypeRegistry[archetypeA].profile.traitProfile;
  const protoB = archetypeRegistry[archetypeB].profile.traitProfile;

  const result = {} as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    result[trait] = Math.round(protoA[trait] * (1 - ratio) + protoB[trait] * ratio);
  }
  return result;
}

function generateBoundaryPersonas(): Persona[] {
  const pairs = collectConfusionPairs();
  const personas: Persona[] = [];
  let idCounter = 1;

  const blendRatios = [0.4, 0.5, 0.6]; // 40/60, 50/50, 60/40

  for (const [archetypeA, archetypeB] of pairs) {
    const nameA = archetypeRegistry[archetypeA].name;
    const nameB = archetypeRegistry[archetypeB].name;

    for (const ratio of blendRatios) {
      const blended = interpolateTraits(archetypeA, archetypeB, ratio);
      const noisy = addTraitNoise(blended, 3); // Small ±3 perturbation

      // The "expected" archetype is the one with higher blend proportion
      const expected = ratio < 0.5 ? archetypeA : archetypeB;
      const dominantName = ratio < 0.5 ? nameA : nameB;
      const minorityName = ratio < 0.5 ? nameB : nameA;

      personas.push({
        id: `boundary-${idCounter.toString().padStart(2, '0')}`,
        label: `${dominantName}↔${minorityName} (${Math.round((1 - ratio) * 100)}/${Math.round(ratio * 100)})`,
        traitProfile: noisy,
        expectedArchetype: expected,
        category: 'boundary',
        metadata: {
          pair: [archetypeA, archetypeB],
          blendRatio: ratio,
          dominantRatio: 1 - ratio,
        },
      });

      idCounter++;
    }
  }

  return personas;
}

function generateCentroidPersonas(): Persona[] {
  const personas: Persona[] = [];

  for (const [archetypeId, record] of Object.entries(archetypeRegistry)) {
    personas.push({
      id: `centroid-${archetypeId}`,
      label: `${record.name} (centroid)`,
      traitProfile: { ...record.profile.traitProfile },
      expectedArchetype: archetypeId,
      category: 'centroid',
    });
  }

  return personas;
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  console.log('🔬 Generating boundary personas...\n');

  const boundaryPersonas = generateBoundaryPersonas();
  const centroidPersonas = generateCentroidPersonas();

  console.log(`Generated ${boundaryPersonas.length} boundary personas across ${collectConfusionPairs().length} confusion pairs`);
  console.log(`Generated ${centroidPersonas.length} centroid personas`);
  console.log(`Total: ${boundaryPersonas.length + centroidPersonas.length} personas\n`);

  // Show sample
  console.log('Sample boundary personas:');
  for (const p of boundaryPersonas.slice(0, 5)) {
    console.log(`  ${p.id}: ${p.label} → expected: ${p.expectedArchetype}`);
    console.log(`    A=${p.traitProfile.A} C=${p.traitProfile.C} E=${p.traitProfile.E} O=${p.traitProfile.O} X=${p.traitProfile.X} P=${p.traitProfile.P}`);
  }

  // Ensure data directory exists
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Write boundary personas
  const boundaryPath = path.join(dataDir, 'boundary-personas.json');
  fs.writeFileSync(
    boundaryPath,
    JSON.stringify(boundaryPersonas, null, 2),
    'utf8'
  );
  console.log(`\n✅ Wrote ${boundaryPath}`);

  // Write all personas (centroids + boundaries)
  const allPath = path.join(dataDir, 'all-personas.json');
  fs.writeFileSync(
    allPath,
    JSON.stringify([...centroidPersonas, ...boundaryPersonas], null, 2),
    'utf8'
  );
  console.log(`✅ Wrote ${allPath}`);
}

main();
