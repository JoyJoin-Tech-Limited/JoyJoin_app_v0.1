/**
 * Gossip Engine V3 测试脚本
 * 运行方式: npx tsx scripts/testGossipV3.ts
 */

// 直接导入测试模块
import { 
  runV3Test, 
  testLevenshteinDistance 
} from '../apps/user-client/src/lib/gossipEngineV3Test';

console.log('🦊 Gossip Engine V3 测试开始...\n');

// 测试 Levenshtein 距离函数
testLevenshteinDistance();

// 运行主测试 (500 轮)
runV3Test(500);

console.log('✅ 测试完成');
