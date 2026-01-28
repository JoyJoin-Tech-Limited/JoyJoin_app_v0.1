/**
 * Tests for archetypeSkills module
 * Verifies all 12 archetypes have valid skill definitions
 */

import { 
  archetypeSkills,
  getArchetypeSkills,
  hasArchetypeSkills,
  getAllSkillArchetypes,
  type ArchetypeSkill,
  type ArchetypeSkillSet
} from '../archetypeSkills';
import { ARCHETYPE_CANONICAL_ORDER } from '../archetypeNames';

describe('archetypeSkills', () => {
  describe('archetypeSkills object', () => {
    it('should contain all 12 canonical archetypes', () => {
      const skillArchetypes = Object.keys(archetypeSkills);
      expect(skillArchetypes).toHaveLength(12);
      
      ARCHETYPE_CANONICAL_ORDER.forEach((archetype) => {
        expect(archetypeSkills).toHaveProperty(archetype);
      });
    });

    it('should have valid ArchetypeSkillSet structure for each archetype', () => {
      Object.values(archetypeSkills).forEach((skillSet) => {
        expect(skillSet).toHaveProperty('attribute');
        expect(skillSet).toHaveProperty('cardTitle');
        expect(skillSet).toHaveProperty('activeSkill');
        expect(skillSet).toHaveProperty('passiveSkill');
        
        // Validate attribute format (emoji + space + Chinese text)
        expect(skillSet.attribute).toMatch(/^.+\s.+$/);
        
        // Validate card title is not empty
        expect(skillSet.cardTitle.length).toBeGreaterThan(0);
      });
    });

    it('should have valid active skills with energy costs', () => {
      Object.values(archetypeSkills).forEach((skillSet) => {
        const { activeSkill } = skillSet;
        
        expect(activeSkill.type).toBe('active');
        expect(activeSkill.energyCost).toBeGreaterThanOrEqual(0);
        expect(activeSkill.energyCost).toBeLessThanOrEqual(3);
        expect(activeSkill.name.length).toBeGreaterThan(0);
        expect(activeSkill.energyType.length).toBeGreaterThan(0);
        expect(activeSkill.shortEffect.length).toBeGreaterThan(0);
        expect(activeSkill.shortEffect.length).toBeLessThanOrEqual(20); // Allow some flexibility
        expect(activeSkill.fullEffect.length).toBeGreaterThan(0);
        expect(activeSkill.icon.length).toBeGreaterThan(0);
      });
    });

    it('should have valid passive skills with zero energy cost', () => {
      Object.values(archetypeSkills).forEach((skillSet) => {
        const { passiveSkill } = skillSet;
        
        expect(passiveSkill.type).toBe('passive');
        expect(passiveSkill.energyCost).toBe(0);
        expect(passiveSkill.name.length).toBeGreaterThan(0);
        expect(passiveSkill.shortEffect.length).toBeGreaterThan(0);
        expect(passiveSkill.shortEffect.length).toBeLessThanOrEqual(20); // Allow some flexibility
        expect(passiveSkill.fullEffect.length).toBeGreaterThan(0);
        expect(passiveSkill.icon.length).toBeGreaterThan(0);
      });
    });

    it('should have energy costs distributed across 1-3', () => {
      const energyCosts = Object.values(archetypeSkills).map(
        (skillSet) => skillSet.activeSkill.energyCost
      );
      
      // Check that we have variety in energy costs
      const uniqueCosts = new Set(energyCosts);
      expect(uniqueCosts.size).toBeGreaterThanOrEqual(2);
      
      // Verify all costs are within valid range
      energyCosts.forEach((cost) => {
        expect(cost).toBeGreaterThanOrEqual(0);
        expect(cost).toBeLessThanOrEqual(3);
      });
    });

    it('should have unique skill names', () => {
      const activeSkillNames = new Set<string>();
      const passiveSkillNames = new Set<string>();
      
      Object.values(archetypeSkills).forEach((skillSet) => {
        activeSkillNames.add(skillSet.activeSkill.name);
        passiveSkillNames.add(skillSet.passiveSkill.name);
      });
      
      // All active skills should have unique names
      expect(activeSkillNames.size).toBe(12);
      // All passive skills should have unique names
      expect(passiveSkillNames.size).toBe(12);
    });
  });

  describe('getArchetypeSkills', () => {
    it('should return skill set for valid archetype', () => {
      const corgiSkills = getArchetypeSkills('开心柯基');
      expect(corgiSkills).toBeDefined();
      expect(corgiSkills?.attribute).toBe('🔥 热情');
      expect(corgiSkills?.cardTitle).toBe('破冰点火官');
      expect(corgiSkills?.activeSkill.name).toBe('摇尾热场波');
      expect(corgiSkills?.passiveSkill.name).toBe('永动引擎');
    });

    it('should return undefined for invalid archetype', () => {
      expect(getArchetypeSkills('不存在')).toBeUndefined();
      expect(getArchetypeSkills('')).toBeUndefined();
    });
  });

  describe('hasArchetypeSkills', () => {
    it('should return true for all canonical archetypes', () => {
      ARCHETYPE_CANONICAL_ORDER.forEach((archetype) => {
        expect(hasArchetypeSkills(archetype)).toBe(true);
      });
    });

    it('should return false for invalid archetype', () => {
      expect(hasArchetypeSkills('不存在')).toBe(false);
      expect(hasArchetypeSkills('')).toBe(false);
    });
  });

  describe('getAllSkillArchetypes', () => {
    it('should return all 12 archetype names', () => {
      const archetypes = getAllSkillArchetypes();
      expect(archetypes).toHaveLength(12);
    });

    it('should return same archetypes as canonical order', () => {
      const skillArchetypes = getAllSkillArchetypes();
      ARCHETYPE_CANONICAL_ORDER.forEach((archetype) => {
        expect(skillArchetypes).toContain(archetype);
      });
    });
  });

  describe('Specific archetype validations', () => {
    it('should have correct skills for 开心柯基', () => {
      const skills = archetypeSkills['开心柯基'];
      expect(skills.attribute).toBe('🔥 热情');
      expect(skills.cardTitle).toBe('破冰点火官');
      expect(skills.activeSkill.energyCost).toBe(2);
      expect(skills.activeSkill.energyType).toBe('🔥');
    });

    it('should have correct skills for 机智狐', () => {
      const skills = archetypeSkills['机智狐'];
      expect(skills.attribute).toBe('🗺️ 探索');
      expect(skills.cardTitle).toBe('秘境引路人');
      expect(skills.activeSkill.energyCost).toBe(1);
      expect(skills.activeSkill.energyType).toBe('🗺️');
    });

    it('should have correct skills for 稳如龟 (highest energy cost)', () => {
      const skills = archetypeSkills['稳如龟'];
      expect(skills.attribute).toBe('💎 真知');
      expect(skills.cardTitle).toBe('真知炮台');
      expect(skills.activeSkill.energyCost).toBe(3);
      expect(skills.activeSkill.energyType).toBe('💎');
      expect(skills.activeSkill.name).toBe('真知慢放炮');
    });
  });
});
