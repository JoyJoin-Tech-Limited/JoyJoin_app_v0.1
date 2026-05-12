import { embeddingClient } from '../src/embeddingClient';
import { printReport, summarize, type TestResult } from './evaluate-embedding-quality/lib/report';

import { testSimilarityRanking } from './evaluate-embedding-quality/intrinsics/similarity-ranking';
import { testCrossLanguage } from './evaluate-embedding-quality/intrinsics/cross-language';
import { testVocabularyCoverage } from './evaluate-embedding-quality/intrinsics/vocabulary-coverage';
import { testDiscriminativePower } from './evaluate-embedding-quality/intrinsics/discriminative-power';
import { testInputEdgeCases } from './evaluate-embedding-quality/comprehensiveness/input-edge-cases';
import { testDeterminism } from './evaluate-embedding-quality/comprehensiveness/determinism';

interface Phase {
  name: string;
  run: () => Promise<TestResult[]>;
}

async function main() {
  const baseURL = process.env.EMBEDDING_BASE_URL || '(not set)';

  console.log('=== Embedding Quality Evaluation ===\n');
  console.log(`Endpoint: ${baseURL}`);
  console.log(`Date:     ${new Date().toISOString().slice(0, 10)}\n`);

  // Verify endpoint is reachable
  const health = await embeddingClient.embed('health check');
  if (!health) {
    console.error('❌ Embedding endpoint not reachable. Set EMBEDDING_BASE_URL in env.\n');
    console.error('   For offline testing, start the mock server:');
    console.error('     cd deploy/granite-embedding && source /tmp/granite-venv/bin/activate && python3 mock-server.py\n');
    process.exit(1);
  }
  console.log(`✅ Endpoint reachable — model=${health.model} dim=${health.dimensions}\n`);

  const phases: Phase[] = [
    { name: 'Intrinsic: Similarity Ranking', run: () => testSimilarityRanking(embeddingClient) },
    { name: 'Intrinsic: Cross-Language', run: () => testCrossLanguage(embeddingClient) },
    { name: 'Intrinsic: Vocabulary Coverage', run: () => testVocabularyCoverage(embeddingClient) },
    { name: 'Intrinsic: Discriminative Power', run: () => testDiscriminativePower(embeddingClient) },
    { name: 'Comprehensiveness: Input Edge Cases', run: () => testInputEdgeCases(embeddingClient) },
    { name: 'Comprehensiveness: Determinism', run: () => testDeterminism(embeddingClient) },
  ];

  let allPass = 0;
  let allWarn = 0;
  let allFail = 0;

  for (const phase of phases) {
    console.log(`\n═══ ${phase.name} ═══`);
    const results: TestResult[] = await phase.run();
    const summary = summarize(results);
    printReport({ phase: phase.name, results, summary });
    allPass += summary.pass;
    allWarn += summary.warn;
    allFail += summary.fail;
  }

  const total = allPass + allWarn + allFail;
  console.log(`\n═══════════════════════════════════`);
  console.log(`Total: ${allPass}/${total} PASS, ${allWarn} WARN, ${allFail} FAIL`);

  const passRate = allPass / total;
  if (allFail === 0 && passRate >= 0.8) {
    console.log(`\n✅ OVERALL: PASS (${(passRate * 100).toFixed(0)}% pass rate, 0 failures)`);
    process.exit(0);
  }
  if (allFail === 0) {
    console.log(`\n⚠️  OVERALL: PASS WITH WARNINGS`);
    process.exit(0);
  }
  console.log(`\n❌ OVERALL: FAIL`);
  process.exit(1);
}

main();
