#!/usr/bin/env node

/**
 * mock-beta-env.mjs — Beta QA Environment Mock Script
 *
 * Creates mock users, runs pool matching, and simulates icebreaker sessions
 * for beta QA testing. All operations use HTTP API calls against a running
 * local server.
 *
 * Usage:
 *   node scripts/mock/mock-beta-env.mjs --smoke          # 12 users, full pipeline
 *   node scripts/mock/mock-beta-env.mjs --stress         # 50 users, full pipeline
 *   node scripts/mock/mock-beta-env.mjs --seed-only --users 20   # users + pool only
 *   node scripts/mock/mock-beta-env.mjs --icebreaker-only --pool-id <id> --tier breeze --vibe chat
 *   node scripts/mock/mock-beta-env.mjs --help
 *
 * Prerequisites:
 *   - Server running with NODE_ENV=development, ENABLE_DEV_AUTH_TOOLS=1
 *   - ADMIN_CREATE_SECRET_KEY set in environment
 *   - BASE_URL (default http://localhost:5000)
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── Configuration ──────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const TMP_DIR = resolve(REPO_ROOT, 'tmp');
const MANIFEST_PATH = resolve(TMP_DIR, 'mock-users.json');

// ─── Archetype definitions ──────────────────────────────────────────────────

const ARCHETYPES = [
  { id: 'corgi',           name: '社牛柯基',    traitProfile: { A: 60, C: 50, E: 60, O: 65, X: 95, P: 85 } },
  { id: 'rooster',         name: '小太阳鸡',    traitProfile: { A: 70, C: 78, E: 88, O: 55, X: 78, P: 92 } },
  { id: 'hamster_praise',  name: '夸夸仓鼠',    traitProfile: { A: 95, C: 50, E: 65, O: 62, X: 82, P: 88 } },
  { id: 'fox',             name: '寻宝狐',      traitProfile: { A: 40, C: 50, E: 60, O: 92, X: 78, P: 58 } },
  { id: 'dolphin_calm',    name: '机灵海豚',    traitProfile: { A: 70, C: 70, E: 85, O: 65, X: 65, P: 68 } },
  { id: 'spider',          name: '人脉蛛',      traitProfile: { A: 70, C: 85, E: 65, O: 70, X: 60, P: 60 } },
  { id: 'koala',           name: '树洞考拉',    traitProfile: { A: 90, C: 65, E: 80, O: 60, X: 48, P: 70 } },
  { id: 'octopus',         name: '脑洞章鱼',    traitProfile: { A: 50, C: 28, E: 55, O: 95, X: 52, P: 70 } },
  { id: 'owl',             name: '好奇猫头鹰',  traitProfile: { A: 45, C: 80, E: 75, O: 88, X: 40, P: 50 } },
  { id: 'elephant',        name: '靠谱大象',    traitProfile: { A: 70, C: 90, E: 86, O: 50, X: 40, P: 60 } },
  { id: 'turtle',          name: '慢热龟',      traitProfile: { A: 55, C: 90, E: 82, O: 58, X: 28, P: 45 } },
  { id: 'cat',             name: '小透明猫',    traitProfile: { A: 40, C: 55, E: 65, O: 72, X: 22, P: 42 } },
];

const CITIES = ['深圳', '广州', '北京', '上海'];
const GENDERS = ['男性', '女性'];
const INTERESTS_POOL = ['编程', '旅游', '美食', '音乐', '电影', '运动', '读书', '摄影', '游戏', '咖啡', '设计', '滑雪'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(arr, n) {
  return shuffle(arr).slice(0, n);
}

async function die(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

// ─── Cookie management ──────────────────────────────────────────────────────

class CookieJar {
  constructor() { this.jar = new Map(); }

  setFromResponse(res) {
    const raw = res.headers.getSetCookie?.() || res.headers.get('set-cookie');
    if (!raw) return;
    const headers = Array.isArray(raw) ? raw : [raw];
    for (const h of headers) {
      const [nameVal] = h.split(';');
      const eqIdx = nameVal.indexOf('=');
      if (eqIdx > 0) this.jar.set(nameVal.slice(0, eqIdx), nameVal.slice(eqIdx + 1));
    }
  }

  get cookieHeader() {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function api(path, opts = {}) {
  const { method = 'GET', body, cookies } = opts;
  const headers = { 'Content-Type': 'application/json' };
  if (cookies) headers['Cookie'] = cookies.cookieHeader;
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
  } catch (err) {
    return { res: null, data: null, text: err.message, status: 0, ok: false, error: err };
  }
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  return { res, data, text, status: res.status, ok: res.ok };
}

// ─── Build test answers targeting an archetype ──────────────────────────────

function buildTestAnswers(archetype) {
  const { traitProfile: target } = archetype;
  const traits = ['A', 'C', 'E', 'O', 'X', 'P'];
  // Compute required sum(deltas) so that 50 + sum reaches the target
  const targetDeltas = {};
  for (const t of traits) targetDeltas[t] = target[t] - 50;

  // Spread across 8 answers
  const answerCount = 8;
  const answers = [];
  for (let i = 0; i < answerCount; i++) {
    const traitScores = {};
    for (const t of traits) {
      // Distribute the target delta evenly, with slight random variation
      const base = targetDeltas[t] / answerCount;
      const jitter = (Math.random() - 0.5) * 2; // ±1
      traitScores[t] = Math.round(base + jitter);
    }
    answers.push({
      questionId: `v4_mock_q${i + 1}`,
      selectedOption: `option_${(i % 4) + 1}`,
      traitScores,
    });
  }

  // Adjust the last answer to make the total sum exactly match the target
  const currentSums = {};
  for (const t of traits) currentSums[t] = 0;
  for (let i = 0; i < answerCount - 1; i++) {
    for (const t of traits) currentSums[t] += answers[i].traitScores[t] || 0;
  }
  const lastScores = {};
  for (const t of traits) {
    lastScores[t] = targetDeltas[t] - currentSums[t];
  }
  answers[answerCount - 1].traitScores = lastScores;

  return answers;
}

// ─── Phase 1: Create admin ──────────────────────────────────────────────────

async function setupAdmin() {
  log('🔑', 'Setting up admin account...');
  const adminPhone = '+8613900000000';
  const adminPass = 'admin123';

  // Create admin via dev endpoint
  const createRes = await api('/api/dev/admin/create', {
    method: 'POST',
    body: { phoneNumber: adminPhone, password: adminPass, secretKey: SECRET_KEY },
  });
  if (!createRes.ok) {
    await die(`Failed to create admin: ${createRes.status} — ${createRes.text}`);
  }
  log('  ✓', `Admin user ready (userId: ${createRes.data.userId})`);

  // Login as admin
  const adminJar = new CookieJar();
  const loginRes = await api('/api/auth/admin-login', {
    method: 'POST',
    body: { phoneNumber: adminPhone, password: adminPass },
    cookies: adminJar,
  });
  adminJar.setFromResponse(loginRes.res);
  if (!loginRes.ok) {
    await die(`Admin login failed: ${loginRes.status} — ${loginRes.text}`);
  }
  log('  ✓', 'Admin logged in');

  return { adminJar, adminPhone, adminUserId: createRes.data.userId };
}

// ─── Phase 2: Create pool ───────────────────────────────────────────────────

async function createPool(adminJar) {
  log('🏊', 'Creating test event pool...');
  const now = new Date();
  const deadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const eventDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const poolRes = await api('/api/admin/event-pools', {
    method: 'POST',
    cookies: adminJar,
    body: {
      title: `Beta QA Test Pool — ${now.toISOString().slice(0, 10)}`,
      description: 'Auto-generated test pool for beta QA',
      eventType: '其他',
      city: '深圳',
      dateTime: eventDate.toISOString(),
      registrationDeadline: deadline.toISOString(),
      minGroupSize: 4,
      maxGroupSize: 6,
      targetGroups: 3,
    },
  });
  if (!poolRes.ok) {
    await die(`Failed to create pool: ${poolRes.status} — ${poolRes.text}`);
  }
  log('  ✓', `Pool created: ${poolRes.data.id}`);
  return poolRes.data.id;
}

// ─── Phase 3: Create mock users ─────────────────────────────────────────────

async function createMockUser(index, archetype, adminJar) {
  const userNum = String(index).padStart(3, '0');
  const wechatCode = `mock_beta_user_${userNum}`;
  const displayName = `测试${archetype.name}${userNum}`;
  const gender = GENDERS[index % 2];
  const city = CITIES[index % CITIES.length];
  const age = 22 + (index % 17);
  const interests = pick(INTERESTS_POOL, 3 + (index % 4)).join(',');

  // Step 1: WeChat mock login to create user + get session
  const userJar = new CookieJar();
  const testAnswers = buildTestAnswers(archetype);
  const loginRes = await api('/api/auth/wechat/login-with-test', {
    method: 'POST',
    body: { code: wechatCode, testAnswers },
    cookies: userJar,
  });
  userJar.setFromResponse(loginRes.res);

  if (!loginRes.ok) {
    console.error(`  ✗ User ${userNum} login failed: ${loginRes.status} — ${loginRes.text}`);
    return null;
  }

  const userId = loginRes.data.user?.id;
  if (!userId) {
    console.error(`  ✗ User ${userNum}: No userId in login response`);
    return null;
  }

  // Step 2: Complete onboarding to set profile
  const onboardingRes = await api('/api/auth/complete-onboarding', {
    method: 'POST',
    cookies: userJar,
    body: {
      displayName,
      gender,
      currentCity: city,
      intent: ['社交', '拓展圈子'],
      birthYear: 2026 - age,
      relationshipStatus: '单身',
    },
  });
  if (!onboardingRes.ok) {
    console.error(`  ✗ User ${userNum} onboarding failed: ${onboardingRes.status}`);
    return null;
  }

  // Step 3: Admin grants subscription so user can register in pool
  const subRes = await api('/api/admin/subscriptions', {
    method: 'POST',
    cookies: adminJar,
    body: { userId, planType: 'monthly', durationMonths: 1 },
  });
  if (!subRes.ok) {
    console.error(`  ✗ User ${userNum} subscription failed: ${subRes.status} — ${subRes.text}`);
    return null;
  }

  return {
    phone: wechatCode, // WeChat login doesn't use phone; store wechatCode as identifier
    userId,
    displayName,
    archetype: archetype.name,
    gender,
    city,
    age,
    interests,
    jar: userJar,
  };
}

async function createUsers(count, adminJar) {
  log('👥', `Creating ${count} mock users...`);
  const users = [];
  for (let i = 0; i < count; i++) {
    const archetype = ARCHETYPES[i % ARCHETYPES.length];
    const user = await createMockUser(i + 1, archetype, adminJar);
    if (user) {
      users.push(user);
      log('  ✓', `User ${i + 1}/${count}: ${user.displayName} (${user.archetype})`);
    } else {
      console.error(`  ✗ Failed to create user ${i + 1}`);
    }
  }
  log('  🎉', `Created ${users.length}/${count} users successfully`);
  return users;
}

// ─── Phase 4: Register users in pool ────────────────────────────────────────

async function registerUsersInPool(users, poolId) {
  log('📝', 'Registering users in pool...');
  let registered = 0;
  for (const user of users) {
    const regRes = await api(`/api/event-pools/${poolId}/register`, {
      method: 'POST',
      cookies: user.jar,
      body: {
        eventIntent: '社交',
        preferredLanguages: ['中文'],
        budgetRange: 'mid',
      },
    });
    if (regRes.ok) {
      registered++;
      log('  ✓', `Registered: ${user.displayName}`);
    } else {
      console.error(`  ✗ Registration failed for ${user.displayName}: ${regRes.status} — ${regRes.text?.slice(0, 200)}`);
    }
  }
  log('  🎉', `Registered ${registered}/${users.length} users`);
  return registered;
}

// ─── Phase 5: Run matching ──────────────────────────────────────────────────

async function runMatching(poolId, adminJar) {
  log('🔀', 'Running pool matching...');
  const matchRes = await api(`/api/admin/event-pools/${poolId}/match`, {
    method: 'POST',
    cookies: adminJar,
  });
  if (!matchRes.ok) {
    console.error(`  ✗ Matching failed: ${matchRes.status} — ${matchRes.text}`);
    return null;
  }
  log('  ✓', `Matching complete: ${matchRes.data.groupCount} groups, ${matchRes.data.totalMatched} matched`);
  if (matchRes.data.groups) {
    matchRes.data.groups.forEach((g, i) => {
      log('    ', `Group ${i + 1}: ${g.memberCount} members, score ${g.overallScore}`);
    });
  }

  // Fetch group details
  const groupsRes = await api(`/api/admin/event-pools/${poolId}/groups`, {
    cookies: adminJar,
  });
  if (groupsRes.ok && Array.isArray(groupsRes.data)) {
    log('  📊', 'Group compositions:');
    for (const group of groupsRes.data) {
      const members = (group.members || []).map(m => `${m.userName || m.userId}(${m.userArchetype || '?'})`).join(', ');
      log('    ', `Group #${group.groupNumber}: [${members}]`);
    }
  }

  return matchRes.data;
}

// ─── Phase 6: Icebreaker simulation ─────────────────────────────────────────

async function simulateIcebreaker(users, poolId, adminJar, tier, vibe) {
  log('🧊', `Simulating icebreaker (tier=${tier}, vibe=${vibe})...`);

  // Get groups to find the first group
  const groupsRes = await api(`/api/admin/event-pools/${poolId}/groups`, { cookies: adminJar });
  if (!groupsRes.ok || !Array.isArray(groupsRes.data) || groupsRes.data.length === 0) {
    console.error('  ✗ No groups found for icebreaker');
    return;
  }

  const firstGroup = groupsRes.data[0];
  const memberIds = (firstGroup.members || []).map(m => m.userId);
  log('  📍', `Using group #${firstGroup.groupNumber} with ${memberIds.length} members`);

  // Find the first member to act as host
  const hostUser = users.find(u => memberIds.includes(u.userId));
  if (!hostUser) {
    console.error('  ✗ No mock user found in first group to act as host');
    return;
  }
  log('  👑', `Host: ${hostUser.displayName} (${hostUser.userId})`);

  const sessionId = `beta-qa-${Date.now()}`;
  const startRes = await api('/api/social-icebreaker/start', {
    method: 'POST',
    cookies: hostUser.jar,
    body: {
      sessionId,
      displayName: hostUser.displayName,
      eventType: '活动',
      eventTier: tier,
      vibe,
    },
  });
  if (!startRes.ok) {
    console.error(`  ✗ Start session failed: ${startRes.status} — ${startRes.text}`);
    return;
  }
  const socialSessionId = startRes.data.socialSessionId;
  log('  ✓', `Session started: ${socialSessionId}`);

  // Join other group members as participants
  for (const memberId of memberIds) {
    if (memberId === hostUser.userId) continue;
    const participant = users.find(u => u.userId === memberId);
    if (!participant) continue;
    const joinRes = await api('/api/social-icebreaker/start', {
      method: 'POST',
      cookies: participant.jar,
      body: {
        sessionId,
        displayName: participant.displayName,
        eventType: '活动',
        eventTier: tier,
        vibe,
      },
    });
    if (joinRes.ok) {
      log('  ✓', `Joined: ${participant.displayName}`);
    } else {
      console.error(`  ✗ Join failed for ${participant.displayName}: ${joinRes.status}`);
    }
  }

  // Generate warmup topics
  const topicsRes = await api(`/api/social-icebreaker/${socialSessionId}/topics`, {
    method: 'POST',
    cookies: hostUser.jar,
    body: { mood: '轻松', eventType: '活动', participantCount: memberIds.length },
  });
  if (topicsRes.ok) {
    log('  ✓', `Topics generated: ${(topicsRes.data.topics || []).length} topics`);
  }

  // Mark all participants ready for warmup
  for (const memberId of memberIds) {
    const participant = users.find(u => u.userId === memberId);
    if (!participant) continue;
    await api(`/api/social-icebreaker/${socialSessionId}/warmup/ready`, {
      method: 'POST',
      cookies: participant.jar,
      body: { ready: true },
    });
  }
  log('  ✓', 'All participants marked ready');

  // Advance from warmup → next phase
  const adv1Res = await api(`/api/social-icebreaker/${socialSessionId}/advance`, {
    method: 'POST',
    cookies: hostUser.jar,
    body: { currentPhase: 'warmup' },
  });
  if (adv1Res.ok) {
    log('  ✓', `Advanced warmup → ${adv1Res.data.nextPhase}`);
  } else {
    console.error(`  ✗ Warmup advance failed: ${adv1Res.status} — ${adv1Res.text}`);
  }

  // Continue advancing through a few more phases
  let nextPhase = adv1Res.data?.nextPhase;
  let advanceCount = 0;
  while (nextPhase && nextPhase !== 'recap' && advanceCount < 8) {
    // For micro_challenge, mark challenges complete
    if (nextPhase === 'micro_challenge') {
      for (const memberId of memberIds) {
        const participant = users.find(u => u.userId === memberId);
        if (!participant) continue;
        await api(`/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {
          method: 'POST',
          cookies: participant.jar,
          body: {},
        });
      }
    }

    // Try to advance
    const advRes = await api(`/api/social-icebreaker/${socialSessionId}/advance`, {
      method: 'POST',
      cookies: hostUser.jar,
      body: { currentPhase: nextPhase },
    });
    if (advRes.ok) {
      nextPhase = advRes.data.nextPhase;
      advanceCount++;
      log('  ✓', `Advanced → ${nextPhase}`);
    } else {
      log('  ⚠', `Could not advance from ${nextPhase}: ${advRes.status} — ${advRes.data?.error || advRes.text?.slice(0, 100)}`);
      break;
    }
  }

  log('  🎉', 'Icebreaker simulation complete');
}

// ─── Main pipeline ──────────────────────────────────────────────────────────

const SECRET_KEY = process.env.ADMIN_CREATE_SECRET_KEY;

async function ensureSecretKey() {
  if (!SECRET_KEY) {
    console.error('❌ ADMIN_CREATE_SECRET_KEY must be set in environment');
    process.exit(1);
  }
}

async function fullPipeline({ userCount, tier, vibe, icebreakerOnly, poolId: existingPoolId, seedOnly }) {
  ensureSecretKey();
  const startTime = Date.now();
  log('🚀', 'Starting beta QA mock pipeline');
  log('   ', `BASE_URL: ${BASE_URL}`);
  log('   ', `Mode: ${seedOnly ? 'seed-only' : icebreakerOnly ? 'icebreaker-only' : 'full'}`);

  let adminJar, poolId, users;

  if (!icebreakerOnly) {
    // Setup admin
    const admin = await setupAdmin();
    adminJar = admin.adminJar;

    // Create pool
    poolId = existingPoolId || await createPool(adminJar);

    // Create users
    users = await createUsers(userCount, adminJar);

    // Register users in pool
    await registerUsersInPool(users, poolId);

    // Run matching (skip in seed-only mode? No, match it so groups exist for icebreaker)
    if (!seedOnly) {
      const matchResult = await runMatching(poolId, adminJar);
      if (!matchResult) return;
    } else {
      log('⏭️', 'Seed-only mode: skipping matching and icebreaker');
    }

    // Save manifest
    mkdirSync(TMP_DIR, { recursive: true });
    const manifest = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      admin: { phone: admin.adminPhone, userId: admin.adminUserId },
      poolId,
      userCount: users.length,
      users: users.map(u => ({
        phone: u.phone,
        userId: u.userId,
        displayName: u.displayName,
        archetype: u.archetype,
        gender: u.gender,
        city: u.city,
        age: u.age,
        interests: u.interests,
      })),
    };
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
    log('📄', `Manifest saved to ${MANIFEST_PATH}`);
  }

  // Icebreaker
  if (!seedOnly && !icebreakerOnly) {
    await simulateIcebreaker(users, poolId, adminJar, tier, vibe);
  }

  if (icebreakerOnly) {
    // Setup admin
    const admin = await setupAdmin();
    adminJar = admin.adminJar;
    poolId = existingPoolId;

    // Try to load users from manifest
    let manifestUsers = [];
    if (existsSync(MANIFEST_PATH)) {
      try {
        manifestUsers = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')).users || [];
      } catch { /* ignore */ }
    }

    if (manifestUsers.length === 0) {
      await die('No mock users found in manifest. Run --smoke or --seed-only first.');
    }

    // Re-create sessions for users via WeChat login
    log('🔑', 'Re-establishing user sessions...');
    users = [];
    for (const mu of manifestUsers) {
      const userNum = String(manifestUsers.indexOf(mu) + 1).padStart(3, '0');
      const userJar = new CookieJar();
      const loginRes = await api('/api/auth/wechat/login', {
        method: 'POST',
        body: { code: mu.phone }, // phone field stores the wechatCode
        cookies: userJar,
      });
      userJar.setFromResponse(loginRes.res);
      if (loginRes.ok) {
        users.push({ ...mu, jar: userJar });
      }
    }
    log('  ✓', `Re-established ${users.length}/${manifestUsers.length} sessions`);

    await simulateIcebreaker(users, poolId, adminJar, tier, vibe);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log('✅', `Pipeline complete in ${elapsed}s`);
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
mock-beta-env.mjs — Beta QA Environment Mock Script

USAGE:
  node scripts/mock/mock-beta-env.mjs [OPTIONS]

OPTIONS:
  --smoke                Full pipeline with 12 users (one per archetype)
  --stress               Full pipeline with 50 users
  --seed-only            Create users + pool only (no matching or icebreaker)
    --users <N>           Number of users to create (requires --seed-only or explicit)
  --icebreaker-only      Run icebreaker on existing pool
    --pool-id <id>        Pool ID (required with --icebreaker-only)
    --tier <tier>         breeze | glow | blaze (default: breeze)
    --vibe <vibe>         deep_chat | balanced | play_fun | 深聊 | 均衡 | 暢玩 (default: balanced)
  --help                 Show this help message

ENVIRONMENT:
  BASE_URL                Server base URL (default: http://localhost:5000)
  ADMIN_CREATE_SECRET_KEY Required. Must match server's ADMIN_CREATE_SECRET_KEY.

PREREQUISITES:
  - Server running with NODE_ENV=development
  - Server running with ENABLE_DEV_AUTH_TOOLS=1
  - ADMIN_CREATE_SECRET_KEY set in both server and this script's environment
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { smoke: false, stress: false, seedOnly: false, icebreakerOnly: false, users: 0, poolId: null, tier: 'breeze', vibe: 'balanced', help: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--smoke':          opts.smoke = true; break;
      case '--stress':         opts.stress = true; break;
      case '--seed-only':      opts.seedOnly = true; break;
      case '--icebreaker-only': opts.icebreakerOnly = true; break;
      case '--users':          opts.users = parseInt(args[++i], 10); break;
      case '--pool-id':        opts.poolId = args[++i]; break;
      case '--tier':           opts.tier = args[++i]; break;
      case '--vibe':           opts.vibe = args[++i]; break;
      case '--help':           opts.help = true; break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        printHelp();
        process.exit(1);
    }
  }

  return opts;
}

async function main() {
  const opts = parseArgs();
  if (opts.help) { printHelp(); process.exit(0); }

  const exclusiveCount = [opts.smoke, opts.stress, opts.seedOnly, opts.icebreakerOnly].filter(Boolean).length;
  if (exclusiveCount > 1) {
    console.error('❌ --smoke, --stress, --seed-only, and --icebreaker-only are mutually exclusive');
    process.exit(1);
  }
  if (exclusiveCount === 0) {
    console.error('❌ Specify one of: --smoke, --stress, --seed-only, --icebreaker-only');
    printHelp();
    process.exit(1);
  }

  let userCount = 12;
  if (opts.stress) userCount = 50;
  if (opts.users > 0) userCount = opts.users;

  if (opts.icebreakerOnly && !opts.poolId) {
    console.error('❌ --icebreaker-only requires --pool-id');
    process.exit(1);
  }

  if (!['breeze', 'glow', 'blaze'].includes(opts.tier)) {
    console.error(`❌ Invalid tier: ${opts.tier}. Must be breeze, glow, or blaze`);
    process.exit(1);
  }

  const vibeInputMap = {
    'deep_chat': 'chat', 'chat': 'chat',
    'balanced': 'balanced', 'mixed': 'balanced',
    'play_fun': 'game', 'competitive': 'game',
    '深聊': 'chat', '均衡': 'balanced', '暢玩': 'game',
  };
  const resolvedVibe = vibeInputMap[opts.vibe] ?? 'balanced';
  const validVibes = Object.keys(vibeInputMap);
  if (!validVibes.includes(opts.vibe)) {
    console.error(`❌ Invalid vibe: ${opts.vibe}. Must be one of: ${validVibes.join(', ')}`);
    process.exit(1);
  }

  await fullPipeline({
    userCount,
    tier: opts.tier,
    vibe: resolvedVibe,
    icebreakerOnly: opts.icebreakerOnly,
    poolId: opts.poolId,
    seedOnly: opts.seedOnly,
  });
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
