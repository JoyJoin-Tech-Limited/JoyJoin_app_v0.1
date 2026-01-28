#!/usr/bin/env node
/**
 * Quick verification script for archetypeSkills
 * Tests that all 12 archetypes have properly defined skills
 */

import { archetypeSkills, getAllSkillArchetypes } from '../packages/shared/src/personality/archetypeSkills.ts';
import { ARCHETYPE_CANONICAL_ORDER } from '../packages/shared/src/personality/archetypeNames.ts';

console.log('🎴 Pokemon Card Skill Tree Verification\n');
console.log('=' .repeat(60));

const archetypes = getAllSkillArchetypes();
console.log(`\n✅ Total archetypes with skills: ${archetypes.length}/12\n`);

// Verify all 12 canonical archetypes have skills
let allPresent = true;
ARCHETYPE_CANONICAL_ORDER.forEach((archetype, index) => {
  const skillSet = archetypeSkills[archetype];
  if (skillSet) {
    console.log(`\n${index + 1}. ${archetype} (${skillSet.attribute})`);
    console.log(`   📛 Card Title: ${skillSet.cardTitle}`);
    console.log(`   ⚡ Active: ${skillSet.activeSkill.name} (${skillSet.activeSkill.energyCost}${skillSet.activeSkill.energyType})`);
    console.log(`      ${skillSet.activeSkill.icon} ${skillSet.activeSkill.shortEffect}`);
    console.log(`   🌟 Passive: ${skillSet.passiveSkill.name}`);
    console.log(`      ${skillSet.passiveSkill.icon} ${skillSet.passiveSkill.shortEffect}`);
  } else {
    console.log(`\n❌ ${index + 1}. ${archetype} - MISSING SKILLS!`);
    allPresent = false;
  }
});

console.log('\n' + '='.repeat(60));
if (allPresent) {
  console.log('✅ All 12 archetypes have complete skill definitions!');
  process.exit(0);
} else {
  console.log('❌ Some archetypes are missing skill definitions!');
  process.exit(1);
}
