import { describe, it, expect } from 'vitest';
import { generateSeedMap, getSeedMapStats, GENERATED_SEED_MAP } from '../generateSeedMap';
import { OCCUPATIONS } from '@shared/occupations';

describe('Seed Map Generation', () => {
  describe('generateSeedMap', () => {
    it('should generate seed map from occupations', () => {
      const seedMap = generateSeedMap();
      
      expect(seedMap).toBeInstanceOf(Map);
      expect(seedMap.size).toBeGreaterThan(0);
    });
    
    it('should include occupations with seedMappings', () => {
      const seedMap = generateSeedMap();
      
      // Check for dancer
      const dancerEntry = seedMap.get('舞蹈演员');
      expect(dancerEntry).toBeDefined();
      expect(dancerEntry?.category).toBe('culture_sports');
      expect(dancerEntry?.segment).toBe('performing_arts');
      expect(dancerEntry?.niche).toBe('dancer');
      expect(dancerEntry?.confidence).toBe(1.0); // Canonical name
    });
    
    it('should include synonyms with correct confidence', () => {
      const seedMap = generateSeedMap();
      
      // Check for dancer synonym
      const synonym = seedMap.get('舞者');
      expect(synonym).toBeDefined();
      expect(synonym?.category).toBe('culture_sports');
      expect(synonym?.confidence).toBe(0.95); // Synonym confidence
    });
    
    it('should include pilot and flight attendant', () => {
      const seedMap = generateSeedMap();
      
      const pilot = seedMap.get('飞行员');
      expect(pilot).toBeDefined();
      expect(pilot?.category).toBe('life_services');
      expect(pilot?.segment).toBe('aviation');
      expect(pilot?.niche).toBe('pilot');
      
      const flightAttendant = seedMap.get('空乘人员');
      expect(flightAttendant).toBeDefined();
      expect(flightAttendant?.category).toBe('life_services');
      expect(flightAttendant?.segment).toBe('aviation');
    });
    
    it('should include tech occupations', () => {
      const seedMap = generateSeedMap();
      
      const frontend = seedMap.get('前端工程师');
      expect(frontend).toBeDefined();
      expect(frontend?.category).toBe('tech');
      expect(frontend?.segment).toBe('software_dev');
      expect(frontend?.niche).toBe('frontend');
      
      const backend = seedMap.get('后端工程师');
      expect(backend).toBeDefined();
      expect(backend?.category).toBe('tech');
      expect(backend?.niche).toBe('backend');
    });
    
    it('should include finance occupations', () => {
      const seedMap = generateSeedMap();
      
      const ib = seedMap.get('投行(IBD)');
      expect(ib).toBeDefined();
      expect(ib?.category).toBe('finance');
      expect(ib?.segment).toBe('investment_banking');
    });
    
    it('should skip very short synonyms', () => {
      const seedMap = generateSeedMap();
      
      // Check that single-character synonyms are skipped (if any exist)
      const entries = Array.from(seedMap.keys());
      const singleChar = entries.filter(k => k.length === 1);
      expect(singleChar.length).toBe(0);
    });
  });
  
  describe('GENERATED_SEED_MAP constant', () => {
    it('should be pre-generated and available', () => {
      expect(GENERATED_SEED_MAP).toBeInstanceOf(Map);
      expect(GENERATED_SEED_MAP.size).toBeGreaterThan(0);
    });
    
    it('should match generateSeedMap() output', () => {
      const fresh = generateSeedMap();
      expect(GENERATED_SEED_MAP.size).toBe(fresh.size);
    });
  });
  
  describe('getSeedMapStats', () => {
    it('should return statistics', () => {
      const stats = getSeedMapStats();
      
      expect(stats.totalEntries).toBeGreaterThan(0);
      expect(stats.occupationsWithMappings).toBeGreaterThan(0);
      expect(stats.coverageRatio).toBeGreaterThan(0);
      expect(stats.coverageRatio).toBeLessThanOrEqual(1);
    });
    
    it('should show coverage improvement', () => {
      const stats = getSeedMapStats();
      
      // With the new system, we should have better coverage than the old 72-entry seed map
      console.log('Seed Map Stats:', stats);
      console.log(`Coverage: ${(stats.coverageRatio * 100).toFixed(1)}%`);
      console.log(`Total Entries: ${stats.totalEntries}`);
      console.log(`Occupations with Mappings: ${stats.occupationsWithMappings}/${OCCUPATIONS.length}`);
      
      // We should have at least improved from the original 72 entries
      expect(stats.totalEntries).toBeGreaterThan(72);
    });
  });
  
  describe('Coverage Tests', () => {
    it('should cover performing arts occupations', () => {
      const seedMap = generateSeedMap();
      
      const dancer = seedMap.get('舞蹈演员');
      const actor = seedMap.get('演员');
      const musician = seedMap.get('音乐人');
      
      expect(dancer).toBeDefined();
      expect(actor).toBeDefined();
      expect(musician).toBeDefined();
      
      // All should be in performing_arts segment
      expect(dancer?.segment).toBe('performing_arts');
      expect(actor?.segment).toBe('performing_arts');
      expect(musician?.segment).toBe('performing_arts');
    });
    
    it('should cover aviation occupations', () => {
      const seedMap = generateSeedMap();
      
      const pilot = seedMap.get('飞行员');
      const attendant = seedMap.get('空乘人员');
      const ground = seedMap.get('地勤人员');
      
      expect(pilot).toBeDefined();
      expect(attendant).toBeDefined();
      expect(ground).toBeDefined();
      
      // All should be in aviation segment
      expect(pilot?.segment).toBe('aviation');
      expect(attendant?.segment).toBe('aviation');
      expect(ground?.segment).toBe('aviation');
    });
    
    it('should not have the old hardcoded fallback problem', () => {
      // The problem was: "舞蹈员" and "飞行员" would fall back to "软件开发"
      // Now they should be properly classified
      
      const seedMap = generateSeedMap();
      
      // These should NOT map to software_dev
      const dancer = seedMap.get('舞蹈演员');
      const pilot = seedMap.get('飞行员');
      
      expect(dancer?.segment).not.toBe('software_dev');
      expect(pilot?.segment).not.toBe('software_dev');
      
      // They should map to correct segments
      expect(dancer?.segment).toBe('performing_arts');
      expect(pilot?.segment).toBe('aviation');
    });
  });
});
