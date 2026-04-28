/**
 * CLI entry for the Social Icebreaker AI benchmark.
 *
 * Usage (from repo root):
 *   npx tsx apps/server/src/benchmarks/socialAIBenchmark.cli.ts
 *
 * Options:
 *   --iterations N   Number of iterations per fixture-model (default: 5)
 *   --models a,b,c   Comma-separated model list (default: minimax-m2.7,minimax-m2.7-highspeed,deepseek-v4-flash)
 *   --json           Output raw JSON report instead of human-readable summary
 */

export {};

import { runSocialAIBenchmark, formatBenchmarkReport } from './socialAIBenchmark';

async function main() {
  const args = process.argv.slice(2);
  let iterations: number | undefined;
  let modelsOverride: string | undefined;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--iterations' || arg === '-i') {
      iterations = parseInt(args[i + 1] || '5', 10);
      i += 1;
    } else if (arg === '--models' || arg === '-m') {
      modelsOverride = args[i + 1];
      i += 1;
    } else if (arg === '--json') {
      jsonOutput = true;
    }
  }

  if (modelsOverride) {
    process.env.BENCHMARK_MODELS = modelsOverride;
  }

  console.log('Starting Social Icebreaker AI benchmark...');
  console.log(`Iterations: ${iterations ?? 5}`);
  console.log(`Models: ${process.env.BENCHMARK_MODELS ?? 'default'}`);
  console.log('');

  const report = await runSocialAIBenchmark({
    iterations,
    onProgress: (result) => {
      const status = result.success ? (result.validationValid ? 'OK' : 'PARSE_FAIL') : 'ERROR';
      console.log(
        `[${result.fixtureId}] ${result.modelLabel} #${result.iteration + 1} → ${status} (${result.latencyMs}ms)`
      );
    },
  });

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatBenchmarkReport(report));
  }
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
