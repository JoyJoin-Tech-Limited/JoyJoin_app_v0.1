#!/usr/bin/env node
/**
 * WeChat mini-program uploader for CI.
 *
 * Why this exists instead of `npx miniprogram-ci upload`:
 *
 * miniprogram-ci's CLI declares a `--use-cos` flag but never forwards it to
 * `ci.upload()`. Verified in 2.1.31 (the version we pin) and 2.1.48 (beta):
 * the CLI's upload call passes project / setting / threads / version / desc /
 * robot / onProgressUpdate only. So `--use-cos=false` is a no-op, and because
 * our package is larger than MIN_COS_UPLOAD_SIZE (5 MiB) the CLI silently
 * takes the async COS path.
 *
 * That matters because the two paths validate differently:
 *   - direct HTTP path: `if (0 !== errCode) throw` — a rejected upload fails.
 *   - COS path: the response body is stored without ever reading `errCode`,
 *     so a rejection can look like a success.
 *
 * Forcing `useCOS: false` gives us the path that actually checks the result.
 *
 * `setting` mirrors the CLI's own object literally (`undefined` where the CLI
 * has no default) so the compiled package is identical to a CLI upload.
 *
 * Usage:
 *   node wechat-upload.cjs --appid wx... --project dist --private-key private.key \
 *     --version 1.0.20260101.1200 --desc "..." [--robot 1]
 */

'use strict';

const path = require('path');

const REQUIRED_ARGS = ['appid', 'project', 'private-key', 'version', 'desc'];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith('--')) {
      throw new Error(`Unexpected argument: ${flag}`);
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for ${flag}`);
    }
    args[flag.slice(2)] = value;
    i += 1;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const missing = REQUIRED_ARGS.filter((key) => !args[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required argument(s): ${missing.map((key) => `--${key}`).join(', ')}`);
  }

  const ci = require('miniprogram-ci');

  const project = new ci.Project({
    appid: args.appid,
    projectPath: path.resolve(args.project),
    privateKeyPath: path.resolve(args['private-key']),
    type: 'miniProgram',
  });

  let lastMessage = '';
  const onProgressUpdate = (task) => {
    const message = task && task.message ? String(task.message) : '';
    if (message && message !== lastMessage) {
      lastMessage = message;
      console.log(`[progress] ${message}`);
    }
  };

  const result = await ci.upload({
    project,
    setting: {
      es6: undefined,
      es7: undefined,
      minify: undefined,
      autoPrefixWXSS: undefined,
      minifyWXML: undefined,
      minifyWXSS: undefined,
      minifyJS: undefined,
      codeProtect: undefined,
      useProjectConfig: true,
    },
    threads: 0,
    version: args.version,
    desc: args.desc,
    robot: args.robot || 1,
    // The whole point of this script: stay on the direct path, which checks
    // the response `errCode` and throws instead of trusting a 200.
    useCOS: false,
    onProgressUpdate,
  });

  const subPackageSize = result && result.subPackageInfo ? result.subPackageInfo.length : 0;
  console.log(
    `[wechat-upload] direct upload completed: useCOS=false version=${args.version} subPackages=${subPackageSize}`,
  );
}

main().catch((error) => {
  console.log(`[wechat-upload] upload did not complete: ${error && error.message ? error.message : error}`);
  process.exitCode = 1;
});
