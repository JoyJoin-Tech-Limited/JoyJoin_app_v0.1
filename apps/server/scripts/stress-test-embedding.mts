import { embeddingClient } from '../src/embeddingClient.js';

const WARMUP_RUNS = 2;
const STRESS_RUNS = 20;
const CONCURRENT_BATCH = 5;

const TEST_PROFILES = [
  '喜欢把轻松聊天聊出层次感，最近迷上了咖啡馆探店和城市散步。Social tag: 温柔倾听者',
  '北京互联网行业产品经理，周末喜欢剧本杀和飞盘。养了一只布偶猫，寻找同样喜欢桌游的朋友。',
  '上海外企设计师，爱好摄影和citywalk。Social tag: 记录生活。Favorite reason: 喜欢发现隐藏在巷子里的小店',
  '深圳创业中，做AI方向。Deep interests: 机器学习, 量化交易, 攀岩, 精酿啤酒',
  'Top interests: 烘焙, 瑜伽, 读书会, 露营. 周末不是在烤箱前就是在山里。期待在JoyJoin遇到真实的人。',
  'A tech enthusiast living in Shanghai, passionate about cross-cultural communication and board games.',
  '喜欢音乐和电影，周末经常去看livehouse。Social tag: 文艺青年。Deep interests: 独立音乐, 胶片摄影, vintage文化',
  '杭州电商运营，业余时间在做自己的饰品品牌。寻找能一起逛展、喝咖啡、聊人生的朋友。',
];

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSingleEmbed(text: string, index: number): Promise<{ duration: number; success: boolean; dimensions: number }> {
  const start = performance.now();
  try {
    const result = await embeddingClient.embed(text);
    const duration = performance.now() - start;
    if (result) {
      return { duration, success: true, dimensions: result.dimensions };
    }
    return { duration, success: false, dimensions: 0 };
  } catch {
    return { duration: performance.now() - start, success: false, dimensions: 0 };
  }
}

async function main() {
  const baseURL = process.env.EMBEDDING_BASE_URL || '(not set)';
  const model = process.env.EMBEDDING_MODEL || 'granite-embedding-97m-multilingual-r2 (default)';

  console.log('=== Embedding Stress Test ===\n');
  console.log(`Endpoint: ${baseURL}`);
  console.log(`Model:     ${model}`);
  console.log(`Profiles:  ${TEST_PROFILES.length} unique`);
  console.log(`Stress:    ${STRESS_RUNS} sequential + ${CONCURRENT_BATCH} concurrent\n`);

  // Quick health check
  const health = await embeddingClient.embed(TEST_PROFILES[0]);
  if (!health) {
    console.error('❌ Embedding endpoint is not responding. Set EMBEDDING_BASE_URL in .env');
    console.error('   Example: EMBEDDING_BASE_URL=http://localhost:8000/v1');
    process.exit(1);
  }
  console.log(`✅ Endpoint reachable. Vector dim=${health.dimensions}\n`);

  // --- Warmup ---
  console.log('--- Warmup ---');
  for (let i = 0; i < WARMUP_RUNS; i++) {
    const result = await embeddingClient.embed(TEST_PROFILES[0]);
    console.log(`  Warmup ${i + 1}: ${result ? `OK dim=${result.dimensions}` : 'FAIL'}`);
  }

  // --- Sequential stress ---
  console.log(`\n--- Sequential Stress (${STRESS_RUNS} calls) ---`);
  const seqDurations: number[] = [];
  let seqSuccess = 0;
  let seqFail = 0;
  let lastDimensions = 0;

  for (let i = 0; i < STRESS_RUNS; i++) {
    const profile = TEST_PROFILES[i % TEST_PROFILES.length];
    const { duration, success, dimensions } = await runSingleEmbed(profile, i);
    seqDurations.push(duration);

    if (success) {
      seqSuccess++;
      if (lastDimensions === 0) lastDimensions = dimensions;
      if (lastDimensions !== 0 && dimensions !== lastDimensions) {
        console.log(`  ⚠️  Dim mismatch: expected ${lastDimensions}, got ${dimensions}`);
      }
      console.log(`  [${i + 1}/${STRESS_RUNS}] ${duration.toFixed(0)}ms dim=${dimensions}`);
    } else {
      seqFail++;
      console.log(`  [${i + 1}/${STRESS_RUNS}] ${duration.toFixed(0)}ms FAIL`);
    }

    await sleep(50);
  }

  // --- Concurrent batch ---
  console.log(`\n--- Concurrent Batch (${CONCURRENT_BATCH} parallel) ---`);
  const batchStart = performance.now();
  const batchResults = await Promise.all(
    Array.from({ length: CONCURRENT_BATCH }, (_, i) =>
      runSingleEmbed(TEST_PROFILES[i % TEST_PROFILES.length], i)
    )
  );
  const batchDuration = performance.now() - batchStart;
  const batchSuccess = batchResults.filter(r => r.success).length;
  console.log(`  Batch: ${batchSuccess}/${CONCURRENT_BATCH} succeeded in ${batchDuration.toFixed(0)}ms total`);
  batchResults.forEach((r, i) => {
    console.log(`    [${i + 1}] ${r.duration.toFixed(0)}ms ${r.success ? `OK dim=${r.dimensions}` : 'FAIL'}`);
  });

  // --- Edge cases ---
  console.log('\n--- Edge Cases ---');
  const edgeCases = [
    { name: 'empty string', input: '' },
    { name: 'whitespace only', input: '   ' },
    { name: 'very short (1 char)', input: '嗨' },
    { name: 'mixed zh/en/emoji', input: 'Love 旅行 ☕️🎨 寻找有趣的灵魂' },
    { name: 'long text (~5k chars)', input: 'A '.repeat(2500) },
  ];
  for (const edge of edgeCases) {
    const start = performance.now();
    const result = await embeddingClient.embed(edge.input);
    const duration = performance.now() - start;
    const ok = result ? `OK dim=${result.dimensions}` : 'null (expected for empty)';
    console.log(`  ${edge.name}: ${duration.toFixed(0)}ms ${ok}`);
  }

  // --- Report ---
  console.log('\n=== Results ===');
  const sorted = [...seqDurations].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const avg = seqDurations.reduce((a, b) => a + b, 0) / seqDurations.length;
  const min = Math.min(...seqDurations);
  const max = Math.max(...seqDurations);

  console.log(`  Sequential: ${seqSuccess} succeeded, ${seqFail} failed`);
  console.log(`  Concurrent: ${batchSuccess}/${CONCURRENT_BATCH} succeeded`);
  console.log(`  Latency:    avg=${avg.toFixed(0)}ms min=${min.toFixed(0)}ms max=${max.toFixed(0)}ms`);
  console.log(`  p50=${p50.toFixed(0)}ms  p95=${p95.toFixed(0)}ms  p99=${p99.toFixed(0)}ms`);
  console.log(`  Dims:       ${lastDimensions}`);

  const pass = seqFail === 0 && batchSuccess === CONCURRENT_BATCH;
  console.log(`\n  Overall: ${pass ? '✅ PASS' : '❌ FAIL'}`);
  process.exit(pass ? 0 : 1);
}

main();
