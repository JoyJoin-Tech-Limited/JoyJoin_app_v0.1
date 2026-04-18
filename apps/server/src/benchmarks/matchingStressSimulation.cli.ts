/**
 * CLI shim: `poolMatchingService` imports `db`, which requires DATABASE_URL at load time.
 * This file sets a harmless placeholder before any module that transitively imports `db` is evaluated.
 *
 * Usage (from repo root):
 *   npx tsx apps/server/src/benchmarks/matchingStressSimulation.cli.ts 1000
 *   npx tsx apps/server/src/benchmarks/matchingStressSimulation.cli.ts 1000 --ai-chat 200
 */

export {};

process.env.DATABASE_URL ??= 'postgresql://benchmark:benchmark@127.0.0.1:5432/benchmark_placeholder';

const { runMatchingStressCli } = await import('./matchingStressSimulation.ts');
await runMatchingStressCli(process.argv);
