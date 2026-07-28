/**
 * Production build for @joyjoin/server.
 *
 * Why this file exists (2026-07-28, OOM root-fix S3):
 * `@joyjoin/shared` ships as TypeScript source (its package.json `exports`
 * point at `src/*.ts`), and server code imports it via both the package name
 * and the `@shared/*` tsconfig alias. The previous CLI build used
 * `--packages=external`, which left those imports external in dist/ — so the
 * container had to boot with `node --import tsx/esm` to resolve and transpile
 * them at runtime. That kept the whole tsx + esbuild toolchain resident in
 * the server process (~30-60MB RSS) purely to load shared TS.
 *
 * Here we bundle ONLY the shared package into dist/ (every other bare import
 * stays external, matching the old behaviour) so the server boots with plain
 * `node dist/index.js`. The mini-program and admin client resolve shared from
 * source in their own bundlers and are unaffected by this change.
 */

import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedSrc = path.resolve(__dirname, '../../packages/shared/src');

/**
 * Mark every bare import external EXCEPT the shared package — that one must
 * be bundled because it ships as TS source. Filter matches bare specifiers
 * (no leading '.' or '/'; `[^:]` excludes node: builtins and drive-letter
 * paths, per esbuild docs). platform:'node' externalizes builtins regardless.
 */
const externalExceptShared = {
  name: 'external-except-shared',
  setup(b) {
    b.onResolve({ filter: /^[\w@][^:]*$/ }, (args) => {
      if (
        args.path === '@joyjoin/shared' ||
        args.path.startsWith('@joyjoin/shared/') ||
        args.path === '@shared' ||
        args.path.startsWith('@shared/')
      ) {
        return null; // not handled here → esbuild resolves and bundles it
      }
      return { external: true };
    });
  },
};

await build({
  entryPoints: [
    'src/index.ts',
    'src/scripts/seed-flash-catalog.ts',
    'src/scripts/check-flash-readiness.ts',
  ],
  platform: 'node',
  format: 'esm',
  bundle: true,
  outdir: 'dist',
  tsconfig: 'tsconfig.json',
  alias: { '@shared': sharedSrc },
  plugins: [externalExceptShared],
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});
