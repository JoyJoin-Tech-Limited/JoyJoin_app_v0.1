// Debug: dump migration log (used by CI deploy SSH script)
// Usage: node scripts/devtools/debug-migration-log.mjs <logFilePath>
import fs from 'node:fs';

const p = process.argv[2];
if (!p) {
  console.log(JSON.stringify({ error: 'missing path argument' }));
  process.exit(1);
}
try {
  const content = fs.readFileSync(p, 'utf8');
  const compact = content.slice(0, 8000);
  console.log(JSON.stringify({ chars: content.length, preview: compact }));
} catch (error) {
  console.log(JSON.stringify({ readError: error?.message ?? String(error) }));
}
