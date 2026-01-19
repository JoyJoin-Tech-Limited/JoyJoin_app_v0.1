import { describe, it, expect } from 'vitest';
import { matchOccupation } from '../occupationMatcher';

describe('occupationMatcher - Comprehensive Pattern Review', () => {
  describe('Potential problematic overlaps', () => {
    it('should classify "研究员" - could overlap with research positions', () => {
      const result = matchOccupation('研究员');
      console.log('研究员 →', result);
      expect(result).toBeDefined();
    });

    it('should classify "科研人员" - research staff', () => {
      const result = matchOccupation('科研人员');
      console.log('科研人员 →', result);
    });

    it('should classify "研发工程师" - R&D engineer', () => {
      const result = matchOccupation('研发工程师');
      console.log('研发工程师 →', result);
      expect(result).toBeDefined();
    });

    it('should classify "医药研发" - pharma R&D', () => {
      const result = matchOccupation('医药研发');
      console.log('医药研发 →', result);
    });

    it('should classify "教育咨询" - education consulting', () => {
      const result = matchOccupation('教育咨询');
      console.log('教育咨询 →', result);
    });

    it('should classify "医疗咨询" - medical consulting', () => {
      const result = matchOccupation('医疗咨询');
      console.log('医疗咨询 →', result);
    });

    it('should classify "法律咨询" - legal consulting', () => {
      const result = matchOccupation('法律咨询');
      console.log('法律咨询 →', result);
    });

    it('should classify "财务咨询" - financial consulting', () => {
      const result = matchOccupation('财务咨询');
      console.log('财务咨询 →', result);
    });
  });

  describe('Generic terms that might match multiple patterns', () => {
    it('should classify "助理" - assistant', () => {
      const result = matchOccupation('助理');
      console.log('助理 →', result);
    });

    it('should classify "客户经理" - customer manager', () => {
      const result = matchOccupation('客户经理');
      console.log('客户经理 →', result);
    });

    it('should classify "培训" - training', () => {
      const result = matchOccupation('培训');
      console.log('培训 →', result);
    });

    it('should classify "培训师" - trainer', () => {
      const result = matchOccupation('培训师');
      console.log('培训师 →', result);
    });

    it('should classify "商务" - business', () => {
      const result = matchOccupation('商务');
      console.log('商务 →', result);
    });

    it('should classify "审计" - auditor', () => {
      const result = matchOccupation('审计');
      console.log('审计 →', result);
    });

    it('should classify "会计" - accountant', () => {
      const result = matchOccupation('会计');
      console.log('会计 →', result);
    });
  });

  describe('Industry-specific roles with overlapping keywords', () => {
    it('should classify "银行客户经理" - bank customer manager', () => {
      const result = matchOccupation('银行客户经理');
      console.log('银行客户经理 →', result);
    });

    it('should classify "医疗销售" - medical sales', () => {
      const result = matchOccupation('医疗销售');
      console.log('医疗销售 →', result);
    });

    it('should classify "保险销售" - insurance sales', () => {
      const result = matchOccupation('保险销售');
      console.log('保险销售 →', result);
    });

    it('should classify "软件销售" - software sales', () => {
      const result = matchOccupation('软件销售');
      console.log('软件销售 →', result);
    });

    it('should classify "金融产品经理" - finance product manager', () => {
      const result = matchOccupation('金融产品经理');
      console.log('金融产品经理 →', result);
    });

    it('should classify "医疗器械工程师" - medical device engineer', () => {
      const result = matchOccupation('医疗器械工程师');
      console.log('医疗器械工程师 →', result);
    });

    it('should classify "生物医药研发" - biomedical R&D', () => {
      const result = matchOccupation('生物医药研发');
      console.log('生物医药研发 →', result);
    });
  });

  describe('Tech subfields that should be tech', () => {
    it('should classify "大数据" - big data', () => {
      const result = matchOccupation('大数据');
      console.log('大数据 →', result);
    });

    it('should classify "云计算" - cloud computing', () => {
      const result = matchOccupation('云计算');
      console.log('云计算 →', result);
    });

    it('should classify "区块链" - blockchain', () => {
      const result = matchOccupation('区块链');
      console.log('区块链 →', result);
    });

    it('should classify "测试工程师" - test engineer', () => {
      const result = matchOccupation('测试工程师');
      console.log('测试工程师 →', result);
    });

    it('should classify "运维工程师" - DevOps engineer', () => {
      const result = matchOccupation('运维工程师');
      console.log('运维工程师 →', result);
    });
  });

  describe('Ambiguous "经理" roles', () => {
    it('should classify "经理" - generic manager', () => {
      const result = matchOccupation('经理');
      console.log('经理 →', result);
    });

    it('should classify "项目经理" - project manager', () => {
      const result = matchOccupation('项目经理');
      console.log('项目经理 →', result);
    });

    it('should classify "总经理" - general manager', () => {
      const result = matchOccupation('总经理');
      console.log('总经理 →', result);
    });
  });
});
