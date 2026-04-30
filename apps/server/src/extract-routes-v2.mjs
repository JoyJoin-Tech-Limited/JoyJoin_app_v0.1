import fs from 'fs';

const ROUTES_FILE = 'apps/server/src/routes.ts';
const content = fs.readFileSync(ROUTES_FILE, 'utf8');
const lines = content.split('\n');

// Find registerRoutes boundaries
let registerRoutesStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export async function registerRoutes')) {
    registerRoutesStart = i;
    break;
  }
}
const registerRoutesEnd = lines.length - 1;

// Parse all imports
const imports = [];
let currentImport = null;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('import ')) {
    currentImport = { startLine: i, text: line };
    imports.push(currentImport);
  } else if (currentImport && (line.startsWith('  ') || line.startsWith('\t')) && line.trim()) {
    currentImport.text += '\n' + line;
  } else if (currentImport && line.trim() && !line.startsWith('import ')) {
    currentImport = null;
  }
}

// Build symbol -> import map
const symbolToImport = new Map();
for (const imp of imports) {
  // Extract all symbol names from the import
  const allMatches = [...imp.text.matchAll(/([A-Za-z_$][A-Za-z0-9_$]*)/g)];
  for (const m of allMatches) {
    const sym = m[1];
    if (sym === 'import' || sym === 'type' || sym === 'from' || sym === 'as') continue;
    if (!symbolToImport.has(sym)) {
      symbolToImport.set(sym, imp.text);
    }
  }
}

// Find all active routes
const routes = [];
for (let i = registerRoutesStart + 1; i < registerRoutesEnd; i++) {
  const line = lines[i];
  const match = line.match(/^(\s*)app\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/);
  if (match) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('//')) {
      routes.push({ line: i, method: match[2], path: match[3], indent: match[1].length });
    }
  }
}

// Group routes by domain
function getDomain(path) {
  if (path.startsWith('/api/registration/')) return 'onboarding';
  if (path.startsWith('/api/insight-feedback')) return 'analytics';
  if (path.startsWith('/api/profile')) return 'profile';
  if (path.startsWith('/api/user/')) return 'profile';
  if (path.startsWith('/api/personality-test/')) return 'profile';
  if (path.startsWith('/api/events/')) return 'userEvents';
  if (path === '/api/my-events') return 'userEvents';
  if (path === '/api/my-feedbacks') return 'feedbacks';
  if (path === '/api/my-connections' || path.startsWith('/api/connections/')) return 'connections';
  if (path.startsWith('/api/icebreakers/') || path.startsWith('/api/icebreaker/')) return 'icebreakerGame';
  if (path.startsWith('/api/notifications/') || path === '/api/notifications') return 'notifications';
  if (path.startsWith('/api/invitations/')) return 'referrals';
  if (path.startsWith('/api/referrals/')) return 'referrals';
  if (path.startsWith('/api/admin/events/')) return 'blindBoxEvents';
  if (path.startsWith('/api/admin/blind-box-events/')) return 'blindBoxEvents';
  if (path === '/api/admin/events' || path === '/api/admin/blind-box-events') return 'blindBoxEvents';
  if (path.startsWith('/api/admin/stats') || path === '/api/admin/ops-dashboard') return 'admin';
  if (path.startsWith('/api/admin/users')) return 'admin';
  if (path.startsWith('/api/admin/icebreaker-sessions')) return 'admin';
  if (path.startsWith('/api/admin/subscriptions')) return 'admin';
  if (path.startsWith('/api/admin/coupons')) return 'admin';
  if (path.startsWith('/api/public/')) return 'analytics';
  if (path === '/api/banners') return 'analytics';
  if (path.startsWith('/api/pricing') || path.startsWith('/api/admin/pricing')) return 'payments';
  if (path.startsWith('/api/admin/venues') || path.startsWith('/api/venues/') || path === '/api/venues/match' || path === '/api/venues/select-best') return 'venues';
  if (path.startsWith('/api/admin/event-pools') || path.startsWith('/api/event-pools') || path.startsWith('/api/pool-groups') || path === '/api/my-pool-registrations' || path.startsWith('/api/pool-registrations/')) return 'eventPools';
  if (path.startsWith('/api/admin/finance/')) return 'admin';
  if (path.startsWith('/api/admin/moderation/')) return 'admin';
  if (path.startsWith('/api/admin/insights')) return 'admin';
  if (path.startsWith('/api/admin/feedback')) return 'admin';
  if (path.startsWith('/api/contents/')) return 'admin';
  if (path.startsWith('/api/admin/contents')) return 'admin';
  if (path.startsWith('/api/admin/notifications')) return 'admin';
  if (path.startsWith('/api/matching/')) return 'matching';
  if (path.startsWith('/api/admin/matching')) return 'matching';
  if (path.startsWith('/api/chat-reports')) return 'admin';
  if (path.startsWith('/api/admin/chat-reports')) return 'admin';
  if (path.startsWith('/api/interaction-logs') || path.startsWith('/api/admin/interaction-logs')) return 'admin';
  if (path.startsWith('/api/admin/matching-thresholds') || path.startsWith('/api/admin/matching-logs') || path.startsWith('/api/admin/pools/')) return 'matching';
  if (path.startsWith('/api/ai/')) return 'aiServices';
  if (path.startsWith('/api/inference/')) return 'aiServices';
  if (path.startsWith('/api/admin/evolution/')) return 'aiServices';
  if (path.startsWith('/api/xiaoyue/')) return 'aiServices';
  if (path.startsWith('/api/event-pool-groups/')) return 'matchExplanations';
  if (path.startsWith('/api/admin/kpi/')) return 'analytics';
  if (path.startsWith('/api/assessment/')) return 'assessment';
  if (path.startsWith('/api/share-card/')) return 'assessment';
  if (path.startsWith('/api/dev/')) return 'devTools';
  return 'unknown';
}

const domainGroups = new Map();
for (const route of routes) {
  const domain = getDomain(route.path);
  if (!domainGroups.has(domain)) domainGroups.set(domain, []);
  domainGroups.get(domain).push(route);
}

console.log('Domain groups:');
for (const [domain, domainRoutes] of domainGroups) {
  console.log(`\n${domain} (${domainRoutes.length} routes):`);
  for (const r of domainRoutes) {
    console.log(`  ${r.line+1}: ${r.method.toUpperCase()} ${r.path}`);
  }
}

// Find helper functions and consts between routes
const helpers = [];
for (let i = registerRoutesStart + 1; i < registerRoutesEnd; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // Skip empty lines and comments
  if (!trimmed || trimmed.startsWith('//')) continue;
  
  // Skip app.* calls
  if (trimmed.startsWith('app.')) continue;
  
  // Look for declarations at 2-space indent
  if (line.match(/^  (const |let |function |async function |type |interface )/)) {
    helpers.push({ line: i, text: line.trim().substring(0, 80) });
  }
}

console.log('\n\nHelper definitions found:');
for (const h of helpers) {
  console.log(`  ${h.line+1}: ${h.text}`);
}
