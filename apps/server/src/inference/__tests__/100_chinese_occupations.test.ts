/**
 * 100 Chinese Occupation Descriptions Test
 * Tests accuracy with real-world Chinese occupation descriptions
 * Target: 99% accuracy (99/100 correct)
 */

import { describe, it, expect } from 'vitest';
import { classifyIndustry } from '../industryClassifier';

const describeBenchmark = process.env.RUN_INFERENCE_BENCHMARKS ? describe : describe.skip;

describeBenchmark('100 Chinese Occupation Descriptions', () => {
  it('should classify 100 Chinese occupations with 99% accuracy', async () => {
    console.log('\n🔍 Testing 100 Chinese occupation descriptions...\n');
    
    // 100 occupation descriptions from the user
    const occupations = [
      // 科技与互联网 (Tech & Internet) - 1-20
      { input: '软件工程师', expectedCategory: 'tech', expectedSegment: 'software_dev' },
      { input: '前端开发工程师', expectedCategory: 'tech', expectedSegment: 'software_dev', expectedNiche: 'frontend' },
      { input: '后端开发工程师', expectedCategory: 'tech', expectedSegment: 'software_dev', expectedNiche: 'backend' },
      { input: '全栈工程师', expectedCategory: 'tech', expectedSegment: 'software_dev', expectedNiche: 'fullstack' },
      { input: '数据分析师', expectedCategory: 'tech', expectedSegment: 'data_analytics' },
      { input: '人工智能工程师', expectedCategory: 'tech', expectedSegment: 'ai_ml' },
      { input: '云计算工程师', expectedCategory: 'tech', expectedSegment: 'software_dev' },
      { input: '网络安全工程师', expectedCategory: 'tech', expectedSegment: 'software_dev' },
      { input: '产品经理', expectedCategory: 'tech', expectedSegment: 'product' },
      { input: 'UI设计师', expectedCategory: 'tech', expectedSegment: 'design' },
      { input: 'UX设计师', expectedCategory: 'tech', expectedSegment: 'design' },
      { input: '测试工程师', expectedCategory: 'tech', expectedSegment: 'software_dev' },
      { input: '运维工程师', expectedCategory: 'tech', expectedSegment: 'software_dev' },
      { input: '区块链开发工程师', expectedCategory: 'tech', expectedSegment: 'software_dev' },
      { input: '物联网工程师', expectedCategory: 'tech', expectedSegment: 'software_dev' },
      { input: '嵌入式开发工程师', expectedCategory: 'tech', expectedSegment: 'software_dev' },
      { input: '游戏开发工程师', expectedCategory: 'tech', expectedSegment: 'software_dev' },
      { input: '音视频工程师', expectedCategory: 'tech', expectedSegment: 'software_dev' },
      { input: '大数据工程师', expectedCategory: 'tech', expectedSegment: 'data_analytics' },
      { input: 'DevOps工程师', expectedCategory: 'tech', expectedSegment: 'software_dev' },
      
      // 金融与经济 (Finance & Economics) - 21-30
      { input: '投资分析师', expectedCategory: 'finance', expectedSegment: 'investment_banking' },
      { input: '风险管理师', expectedCategory: 'finance' },
      { input: '证券交易员', expectedCategory: 'finance', expectedSegment: 'securities' },
      { input: '基金经理', expectedCategory: 'finance', expectedSegment: 'asset_mgmt' },
      { input: '审计师', expectedCategory: 'professional_services', expectedSegment: 'accounting' },
      { input: '注册会计师', expectedCategory: 'professional_services', expectedSegment: 'accounting' },
      { input: '精算师', expectedCategory: 'finance', expectedSegment: 'insurance' },
      { input: '银行信贷专员', expectedCategory: 'finance', expectedSegment: 'commercial_banking' },
      { input: '财务规划师', expectedCategory: 'finance' },
      { input: '金融科技产品经理', expectedCategory: 'tech', expectedSegment: 'product' },
      
      // 医疗与健康 (Healthcare) - 31-40
      { input: '临床医生', expectedCategory: 'healthcare', expectedSegment: 'medical_services' },
      { input: '中医师', expectedCategory: 'healthcare', expectedSegment: 'medical_services' },
      { input: '护士', expectedCategory: 'healthcare', expectedSegment: 'medical_services' },
      { input: '药剂师', expectedCategory: 'healthcare', expectedSegment: 'medical_services' },
      { input: '医学影像技师', expectedCategory: 'healthcare', expectedSegment: 'medical_services' },
      { input: '公共卫生医师', expectedCategory: 'healthcare', expectedSegment: 'medical_services' },
      { input: '康复治疗师', expectedCategory: 'healthcare', expectedSegment: 'medical_services' },
      { input: '营养师', expectedCategory: 'healthcare' },
      { input: '医疗器械工程师', expectedCategory: 'healthcare' },
      { input: '基因检测顾问', expectedCategory: 'healthcare' },
      
      // 教育、科研与法律 (Education, Research & Law) - 41-50
      { input: '中小学教师', expectedCategory: 'education', expectedSegment: 'k12' },
      { input: '大学讲师', expectedCategory: 'education' },
      { input: '职业培训师', expectedCategory: 'education', expectedSegment: 'vocational' },
      { input: '教育产品研发', expectedCategory: 'education' },
      { input: '科学研究员', expectedCategory: 'education' },
      { input: '专利代理人', expectedCategory: 'professional_services', expectedSegment: 'legal' },
      { input: '律师', expectedCategory: 'professional_services', expectedSegment: 'legal' },
      { input: '法官', expectedCategory: 'government' },
      { input: '检察官', expectedCategory: 'government' },
      { input: '公证员', expectedCategory: 'professional_services', expectedSegment: 'legal' },
      
      // 文化、传媒与艺术 (Culture, Media & Arts) - 51-60
      { input: '记者', expectedCategory: 'media_creative', expectedSegment: 'journalism' },
      { input: '编辑', expectedCategory: 'media_creative', expectedSegment: 'journalism' },
      { input: '新媒体运营', expectedCategory: 'media_creative', expectedSegment: 'marketing' },
      { input: '视频剪辑师', expectedCategory: 'media_creative', expectedSegment: 'video_production' },
      { input: '摄影师', expectedCategory: 'media_creative', expectedSegment: 'photography' },
      { input: '平面设计师', expectedCategory: 'media_creative', expectedSegment: 'design' },
      { input: '动漫原画师', expectedCategory: 'media_creative', expectedSegment: 'design' },
      { input: '作家', expectedCategory: 'media_creative', expectedSegment: 'content' },
      { input: '音乐制作人', expectedCategory: 'media_creative', expectedSegment: 'music' },
      { input: '策展人', expectedCategory: 'media_creative' },
      
      // 制造、工程与能源 (Manufacturing, Engineering & Energy) - 61-70
      { input: '机械工程师', expectedCategory: 'manufacturing', expectedSegment: 'machinery' },
      { input: '电气工程师', expectedCategory: 'manufacturing', expectedSegment: 'electronics' },
      { input: '土木工程师', expectedCategory: 'real_estate', expectedSegment: 'construction' },
      { input: '汽车工程师', expectedCategory: 'manufacturing', expectedSegment: 'automotive' },
      { input: '工艺工程师', expectedCategory: 'manufacturing' },
      { input: '工业设计师', expectedCategory: 'manufacturing' },
      { input: '建筑设计师', expectedCategory: 'real_estate', expectedSegment: 'architecture' },
      { input: '城市规划师', expectedCategory: 'real_estate', expectedSegment: 'architecture' },
      { input: '新能源工程师', expectedCategory: 'energy_environment', expectedSegment: 'new_energy' },
      { input: '环境工程师', expectedCategory: 'energy_environment', expectedSegment: 'environmental' },
      
      // 贸易、销售与市场 (Trade, Sales & Marketing) - 71-80
      { input: '外贸业务员', expectedCategory: 'consumer_retail', expectedSegment: 'sales' },
      { input: '销售经理', expectedCategory: 'consumer_retail', expectedSegment: 'sales' },
      { input: '市场专员', expectedCategory: 'media_creative', expectedSegment: 'marketing' },
      { input: '电商运营', expectedCategory: 'consumer_retail', expectedSegment: 'ecommerce' },
      { input: '直播带货主播', expectedCategory: 'media_creative', expectedSegment: 'live_streaming' },
      { input: '商务拓展', expectedCategory: 'professional_services', expectedSegment: 'consulting' },
      { input: '客户成功经理', expectedCategory: 'tech', expectedSegment: 'product' },
      { input: '品牌策划', expectedCategory: 'media_creative', expectedSegment: 'marketing' },
      { input: '市场分析师', expectedCategory: 'media_creative', expectedSegment: 'marketing' },
      { input: '公关专员', expectedCategory: 'media_creative', expectedSegment: 'pr' },
      
      // 服务、管理与公共事务 (Services, Management & Public Affairs) - 81-90
      { input: '人力资源管理', expectedCategory: 'professional_services', expectedSegment: 'hr' },
      { input: '行政专员', expectedCategory: 'professional_services', expectedSegment: 'admin' },
      { input: '项目经理', expectedCategory: 'professional_services', expectedSegment: 'consulting' },
      { input: '物流师', expectedCategory: 'logistics', expectedSegment: 'logistics_mgmt' },
      { input: '供应链管理', expectedCategory: 'logistics', expectedSegment: 'supply_chain' },
      { input: '酒店经理', expectedCategory: 'life_services', expectedSegment: 'hospitality' },
      { input: '旅游策划师', expectedCategory: 'life_services', expectedSegment: 'travel' },
      { input: '餐饮店长', expectedCategory: 'consumer_retail', expectedSegment: 'food_service' },
      { input: '家政服务师', expectedCategory: 'life_services', expectedSegment: 'household' },
      { input: '社区工作者', expectedCategory: 'government' },
      
      // 新兴与特色职业 (Emerging & Special Occupations) - 91-100
      { input: '无人机飞手', expectedCategory: 'tech' },
      { input: '人工智能训练师', expectedCategory: 'tech', expectedSegment: 'ai_ml' },
      { input: '数字化管理师', expectedCategory: 'tech', expectedSegment: 'product' },
      { input: '宠物营养师', expectedCategory: 'life_services', expectedSegment: 'pets' },
      { input: '收纳整理师', expectedCategory: 'life_services', expectedSegment: 'household' },
      { input: '剧本杀编剧', expectedCategory: 'media_creative', expectedSegment: 'content' },
      { input: '碳排放管理员', expectedCategory: 'energy_environment', expectedSegment: 'environmental' },
      { input: '老年人能力评估师', expectedCategory: 'healthcare' },
      { input: '在线学习服务师', expectedCategory: 'education', expectedSegment: 'online' },
      { input: '民宿房东', expectedCategory: 'life_services', expectedSegment: 'hospitality' },
    ];
    
    const results = {
      total: occupations.length,
      correct: 0,
      incorrect: 0,
      categoryCorrect: 0,
      segmentCorrect: 0,
      nicheCorrect: 0,
      errors: [] as Array<{
        input: string;
        expected: string;
        actual: string;
        reasoning: string;
      }>,
    };
    
    console.log(`Testing ${occupations.length} Chinese occupations...\n`);
    
    for (let i = 0; i < occupations.length; i++) {
      const test = occupations[i];
      
      try {
        const result = await classifyIndustry(test.input);
        
        // Check category match
        const categoryMatch = result.category.id === test.expectedCategory;
        
        // Check segment match (if specified)
        const segmentMatch = !test.expectedSegment || result.segment.id === test.expectedSegment;
        
        // Check niche match (if specified)
        const nicheMatch = !test.expectedNiche || result.niche?.id === test.expectedNiche;
        
        const isCorrect = categoryMatch && segmentMatch && nicheMatch;
        
        if (isCorrect) {
          results.correct++;
          if (categoryMatch) results.categoryCorrect++;
          if (segmentMatch) results.segmentCorrect++;
          if (nicheMatch && test.expectedNiche) results.nicheCorrect++;
          
          console.log(`✅ ${i + 1}. "${test.input}" → ${result.category.label}${result.segment ? ' > ' + result.segment.label : ''}${result.niche ? ' > ' + result.niche.label : ''} (${result.source}, ${(result.confidence * 100).toFixed(0)}%)`);
        } else {
          results.incorrect++;
          results.errors.push({
            input: test.input,
            expected: `${test.expectedCategory}${test.expectedSegment ? '/' + test.expectedSegment : ''}${test.expectedNiche ? '/' + test.expectedNiche : ''}`,
            actual: `${result.category.id}/${result.segment.id}${result.niche ? '/' + result.niche.id : ''}`,
            reasoning: result.reasoning ?? "",
          });
          
          console.log(`❌ ${i + 1}. "${test.input}" → ${result.category.label} (expected: ${test.expectedCategory})`);
          console.log(`   Expected: ${test.expectedCategory}${test.expectedSegment ? '/' + test.expectedSegment : ''}`);
          console.log(`   Actual: ${result.category.id}/${result.segment.id}`);
          console.log(`   Reasoning: ${result.reasoning}`);
        }
      } catch (error) {
        results.incorrect++;
        results.errors.push({
          input: test.input,
          expected: `${test.expectedCategory}`,
          actual: 'ERROR',
          reasoning: error instanceof Error ? error.message : String(error),
        });
        console.log(`💥 ${i + 1}. "${test.input}" → ERROR: ${error}`);
      }
    }
    
    // Summary
    const accuracy = (results.correct / results.total * 100).toFixed(2);
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 100 CHINESE OCCUPATIONS TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`Total Tests: ${results.total}`);
    console.log(`Correct: ${results.correct} (${accuracy}%)`);
    console.log(`Incorrect: ${results.incorrect} (${((results.incorrect / results.total) * 100).toFixed(2)}%)`);
    console.log(`\nBreakdown:`);
    console.log(`  Category Correct: ${results.categoryCorrect}/${results.total}`);
    console.log(`  Segment Correct: ${results.segmentCorrect}/${results.total}`);
    
    if (results.errors.length > 0) {
      console.log(`\n❌ ERRORS (${results.errors.length}):`);
      results.errors.forEach((err, idx) => {
        console.log(`\n${idx + 1}. "${err.input}"`);
        console.log(`   Expected: ${err.expected}`);
        console.log(`   Actual: ${err.actual}`);
        console.log(`   Reasoning: ${err.reasoning}`);
      });
    } else {
      console.log('\n✅ All classifications correct!');
    }
    
    console.log('='.repeat(70) + '\n');
    
    // Assertions
    const accuracyRate = results.correct / results.total;
    expect(accuracyRate).toBeGreaterThanOrEqual(0.99); // 99% accuracy target
    expect(results.errors.length).toBeLessThanOrEqual(1); // Allow max 1 error
  }, 120000); // 2 minute timeout
});
