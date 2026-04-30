import fs from 'fs';
import path from 'path';

const ROUTES_FILE = 'apps/server/src/routes.ts';
const DOMAINS_DIR = 'apps/server/src/routes/domains';

// Read routes.ts
const content = fs.readFileSync(ROUTES_FILE, 'utf8');
const lines = content.split('\n');

// Find registerRoutes boundaries
let registerRoutesStart = -1;
let registerRoutesEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export async function registerRoutes')) {
    registerRoutesStart = i;
  }
}
registerRoutesEnd = lines.length - 1; // Last line is closing brace

// Parse imports from top of file
const importLines = [];
let importBlockEnd = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('import ') || lines[i].startsWith('import\t') || lines[i].startsWith('import{') || lines[i].startsWith('import type')) {
    importLines.push({ line: i, text: lines[i] });
    importBlockEnd = i;
  }
}

// Build map of symbol -> import line
const symbolToImport = new Map();
for (const imp of importLines) {
  const text = imp.text;
  // Extract imported symbols
  const namedMatch = text.match(/import\s*\{([^}]+)\}\s*from/);
  const defaultMatch = text.match(/import\s+(\w+)\s+from/);
  const namespaceMatch = text.match(/import\s*\*\s+as\s+(\w+)\s+from/);
  
  if (namedMatch) {
    const symbols = namedMatch[1].split(',').map(s => s.trim().replace(/^type\s+/, '').replace(/\s+as\s+\w+/, '').trim());
    for (const sym of symbols) {
      if (sym) symbolToImport.set(sym, imp.text);
    }
  }
  if (defaultMatch) {
    symbolToImport.set(defaultMatch[1], imp.text);
  }
  if (namespaceMatch) {
    symbolToImport.set(namespaceMatch[1], imp.text);
  }
}

// Also handle multi-line imports
let currentImport = '';
let currentSymbols = [];
for (let i = 0; i <= importBlockEnd; i++) {
  const line = lines[i];
  if (line.startsWith('import ')) {
    currentImport = line;
    currentSymbols = [];
  } else if (currentImport) {
    currentImport += '\n' + line;
  }
  
  const namedMatch = line.match(/\b(\w+):/g);
  if (namedMatch) {
    for (const m of namedMatch) {
      const sym = m.replace(':', '').trim();
      if (sym && !['type', 'typeof'].includes(sym)) {
        currentSymbols.push(sym);
      }
    }
  }
}

console.log('Found', symbolToImport.size, 'imported symbols');
console.log('registerRoutes spans lines', registerRoutesStart + 1, 'to', registerRoutesEnd + 1);

// Find section headers within registerRoutes
const sections = [];
for (let i = registerRoutesStart + 1; i < registerRoutesEnd; i++) {
  const line = lines[i];
  // Match section headers like // ============ ... ============
  if (line.match(/^\s*\/\/\s*={5,}/) || line.match(/^\s*\/\/\s*-{5,}/)) {
    sections.push({ start: i, header: line.trim() });
  }
}

// Add end boundaries
for (let i = 0; i < sections.length; i++) {
  if (i < sections.length - 1) {
    sections[i].end = sections[i + 1].start;
  } else {
    sections[i].end = registerRoutesEnd;
  }
}

console.log('Found', sections.length, 'sections');
for (const s of sections.slice(0, 10)) {
  console.log(`Lines ${s.start+1}-${s.end}: ${s.header.substring(0, 80)}`);
}

// Define target files for each section
const sectionTargets = {
  'AI Chat Registration Routes': { file: 'onboarding.ts', extend: true },
  'Registration Session Telemetry Routes': { file: 'onboarding.ts', extend: true },
  'Insight Feedback API': { file: 'analytics.ts', extend: true },
  'Interest Signal Boost endpoints': { file: 'profile.ts', extend: true },
  'ATTENDANCE STATUS ROUTES': { file: 'blindBoxEvents.ts', extend: true },
  'ADMIN BLIND BOX EVENT ROUTES': { file: 'blindBoxEvents.ts', extend: true },
  'In-Event Icebreaker Card Game Endpoints': { file: 'icebreakerGame.ts', extend: true },
  'INVITATION SYSTEM ROUTES': { file: 'referrals.ts', extend: false },
  'User Referral System API': { file: 'referrals.ts', extend: false },
  'AUTH MIDDLEWARE': { file: null, keepInRoutes: true },
  'PUBLIC STATS': { file: 'analytics.ts', extend: true },
  'PROMOTION BANNERS': { file: 'analytics.ts', extend: true },
  'PRICING MANAGEMENT': { file: 'payments.ts', extend: true },
  'VENUE DEALS API': { file: 'venues.ts', extend: false },
  'Emergency Venue Migration': { file: 'venues.ts', extend: false },
  'Venue Time Slots Management': { file: 'venues.ts', extend: false },
  'EVENT POOLS': { file: 'eventPools.ts', extend: true },
  'USER EVENT POOLS': { file: 'eventPools.ts', extend: true },
  'ADMIN FEEDBACK MANAGEMENT': { file: 'admin.ts', extend: true },
  'CONTENT MANAGEMENT': { file: 'admin.ts', extend: true },
  'ADMIN NOTIFICATION MANAGEMENT': { file: 'admin.ts', extend: true },
  'VENUE MATCHING': { file: 'venues.ts', extend: false },
  'MATCHING ALGORITHM ENDPOINTS': { file: 'matching.ts', extend: false },
  'CHAT REPORTS & MODERATION ROUTES': { file: 'admin.ts', extend: true },
  'INTERACTION LOGS ROUTES': { file: 'admin.ts', extend: true },
  'REALTIME MATCHING CONFIGURATION ROUTES': { file: 'matching.ts', extend: false },
  'AI 时刻 API': { file: 'aiServices.ts', extend: false },
  '推断引擎API': { file: 'aiServices.ts', extend: false },
  '专家评估系统 API': { file: 'aiServices.ts', extend: false },
  '小悦进化系统 API': { file: 'aiServices.ts', extend: false },
  'Match Explanation & Ice-Breaker API': { file: 'matchExplanations.ts', extend: false },
  'KPI Dashboard API': { file: 'analytics.ts', extend: true },
  'V4 Adaptive Personality Assessment API': { file: 'assessmentV4.ts', extend: true },
  'Unified Assessment Result Endpoint': { file: 'assessment.ts', extend: true },
  'Assessment Feedback Endpoint': { file: 'assessment.ts', extend: true },
  'Share Card Data Endpoint': { file: 'assessment.ts', extend: true },
  'Xiaoyue AI Analysis Endpoint': { file: 'aiServices.ts', extend: false },
  'Development Tools API Endpoints': { file: 'devTools.ts', extend: false },
  'Pre-event Attendance (Blind Box)': { file: 'blindBoxEvents.ts', extend: true },
};

// Map sections to targets
for (const section of sections) {
  const headerText = section.header;
  let matched = false;
  for (const [key, target] of Object.entries(sectionTargets)) {
    if (headerText.includes(key)) {
      section.targetFile = target.file;
      section.extend = target.extend;
      section.keepInRoutes = target.keepInRoutes || false;
      matched = true;
      break;
    }
  }
  if (!matched) {
    section.targetFile = null;
    section.keepInRoutes = true;
  }
}

console.log('\nSection mapping:');
for (const s of sections) {
  console.log(`${s.start+1}-${s.end}: ${s.header.substring(0, 50)} -> ${s.targetFile || 'KEEP'}${s.extend ? ' (extend)' : ''}`);
}

// We also need to handle the code BEFORE the first section header (lines 248-249)
// and the code BETWEEN section headers that doesn't have its own header
// This is mostly the user core routes between line 248 and 1912

console.log('\nDone with analysis.');
