/**
 * Experiment: Can Granite embeddings match free-text occupation input
 * to the standard JoyJoin occupation taxonomy?
 *
 * For each of 164 occupations, generates ~6 simulated free-text queries.
 * Measures precision@1 / @3 / @5 across 1000 queries.
 */

import { embeddingClient } from '../src/embeddingClient.js';
import { OCCUPATIONS } from '@shared/occupations';

interface VecEntry { id: string; name: string; vector: number[] }

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function rank(vec: number[], index: VecEntry[]): Array<{ id: string; name: string; score: number }> {
  return index.map(e => ({ id: e.id, name: e.name, score: cosine(vec, e.vector) })).sort((a, b) => b.score - a.score);
}

const INDUSTRY_LABELS: Record<string, string[]> = {
  tech: ['科技', '互联网'], internet: ['互联网', '科技'], finance: ['金融', '投资'],
  medical: ['医疗', '医药', '健康'], education: ['教育', '培训'], design: ['设计', '创意'],
  media: ['媒体', '传媒', '娱乐'], legal: ['法律', '法务'], consulting: ['咨询', '顾问'],
  manufacturing: ['制造', '工厂', '工业'], realestate: ['地产', '房地产'],
  retail: ['零售', '电商'], government: ['政府', '公务员'], self_employed: ['自由职业', '创业'],
};

const COMPANIES = ['腾讯', '阿里', '字节', '美团', '华为', '百度', '京东', '小红书', 'B站', '网易'];

async function main() {
  console.log('=== Occupation Free-Text Search Experiment ===\n');
  console.log(`Endpoint: ${process.env.EMBEDDING_BASE_URL || '(not set)'}`);
  console.log(`Occupations in taxonomy: ${OCCUPATIONS.length}\n`);

  // ── Phase 1: Build vector index ──
  console.log('--- Phase 1: Building occupation vector index ---');
  const index: VecEntry[] = [];
  for (let i = 0; i < OCCUPATIONS.length; i++) {
    const o = OCCUPATIONS[i];
    const doc = [o.displayName, ...(o.synonyms ?? []), ...(o.keywords ?? [])].filter(Boolean).join(' ');
    const r = await embeddingClient.embed(doc);
    if (!r) { console.error(`  FAIL: ${o.id}`); continue; }
    index.push({ id: o.id, name: o.displayName, vector: r.vector });
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${OCCUPATIONS.length}`);
  }
  console.log(`  Index: ${index.length} vectors x ${index[0]?.vector.length} dims\n`);

  // ── Phase 2: Generate test queries ──
  console.log('--- Phase 2: Generating queries ---');
  const queries: Array<{ text: string; type: string; targetId: string }> = [];
  for (const o of OCCUPATIONS) {
    const q = (t: string, tp: string) => queries.push({ text: t, type: tp, targetId: o.id });
    q(o.displayName, 'exact');
    for (const s of (o.synonyms ?? []).slice(0, 3)) q(s, 'synonym');
    // Casual descriptions
    const casual = [`做${o.displayName}的`, `我是${o.displayName}`];
    for (const k of (o.keywords ?? []).filter(k => k.length >= 2).slice(0, 2)) {
      casual.push(`我擅长${k}`);
    }
    for (const c of casual) q(c, 'casual');
    // Industry-qualified
    for (const ind of (INDUSTRY_LABELS[o.industryId] ?? [o.industryId])) {
      q(`${ind}${o.displayName}`, 'qualified');
    }
    // Company prefix
    const co = COMPANIES[Math.floor(Math.random() * COMPANIES.length)];
    q(`${co}的${o.displayName}`, 'company');
  }
  while (queries.length < 1000) {
    const o = OCCUPATIONS[queries.length % OCCUPATIONS.length];
    queries.push({ text: `${o.displayName}相关岗位`, type: 'padded', targetId: o.id });
  }
  const test = queries.slice(0, 1000);
  const typeCounts: Record<string, number> = {};
  for (const q of test) typeCounts[q.type] = (typeCounts[q.type] ?? 0) + 1;
  console.log(`  ${test.length} queries:`);
  for (const [t, c] of Object.entries(typeCounts)) console.log(`    ${t}: ${c}`);

  // ── Phase 3: Run search & record all results ──
  console.log('\n--- Phase 3: Running search ---');
  const results: Array<{
    text: string; type: string; targetId: string;
    top5: Array<{ id: string; name: string; score: number }>;
    timing: number;
  }> = [];

  for (let i = 0; i < test.length; i++) {
    const q = test[i];
    const t0 = performance.now();
    const qv = await embeddingClient.embed(q.text);
    const timing = performance.now() - t0;
    if (!qv) { console.error(`  FAIL embed: ${q.text.slice(0, 40)}`); continue; }
    results.push({ text: q.text, type: q.type, targetId: q.targetId, top5: rank(qv.vector, index).slice(0, 5), timing });
    if ((i + 1) % 250 === 0) {
      const h = results.filter(r => r.top5[0].id === r.targetId).length;
      console.log(`  ${i + 1}/${test.length} — interim P@1: ${(h / results.length * 100).toFixed(1)}%`);
    }
  }

  // ── Phase 4: Analysis ──
  console.log('\n═══════════════════════════════════════');
  console.log('           RESULTS');
  console.log('═══════════════════════════════════════');

  const n = results.length;
  const p1 = results.filter(r => r.top5[0].id === r.targetId).length / n;
  const p3 = results.filter(r => r.top5.slice(0, 3).some(x => x.id === r.targetId)).length / n;
  const p5 = results.filter(r => r.top5.slice(0, 5).some(x => x.id === r.targetId)).length / n;

  const timings = results.map(r => r.timing).sort((a, b) => a - b);
  const avgMs = timings.reduce((s, v) => s + v, 0) / timings.length;

  console.log(`\nTotal queries:  ${n}`);
  console.log(`Precision@1:    ${(p1 * 100).toFixed(1)}% (${results.filter(r => r.top5[0].id === r.targetId).length}/${n})`);
  console.log(`Precision@3:    ${(p3 * 100).toFixed(1)}%`);
  console.log(`Precision@5:    ${(p5 * 100).toFixed(1)}%`);
  console.log(`Latency:        avg=${avgMs.toFixed(0)}ms  p50=${timings[Math.floor(n * 0.5)].toFixed(0)}ms  p95=${timings[Math.floor(n * 0.95)].toFixed(0)}ms`);

  // By type
  const byType: Record<string, { t: number; h: number }> = {};
  for (const r of results) {
    if (!byType[r.type]) byType[r.type] = { t: 0, h: 0 };
    byType[r.type].t++;
    if (r.top5[0].id === r.targetId) byType[r.type].h++;
  }
  console.log('\n--- By query type (top-1) ---');
  for (const [tp, v] of Object.entries(byType).sort((a, b) => b[1].t - a[1].t)) {
    console.log(`  ${tp.padEnd(10)} ${(v.h / v.t * 100).toFixed(1)}% (${v.h}/${v.t})`);
  }

  // Top 15 misses
  const misses = results.filter(r => r.top5[0].id !== r.targetId);
  console.log(`\n--- Top 15 misses (of ${misses.length} total) ---`);
  for (const m of misses.slice(0, 15)) {
    const expected = OCCUPATIONS.find(o => o.id === m.targetId)?.displayName ?? m.targetId;
    console.log(`  "${m.text}" (${m.type})`);
    console.log(`    expected: ${expected}`);
    console.log(`    got:      ${m.top5[0].name} (${m.top5[0].score.toFixed(3)})`);
    const correctInTop5 = m.top5.find(x => x.id === m.targetId);
    if (correctInTop5) {
      console.log(`    rank ${m.top5.indexOf(correctInTop5) + 1} (score ${correctInTop5.score.toFixed(3)})`);
    }
  }

  // 5 high-confidence correct examples
  const confident = results.filter(r => r.top5[0].id === r.targetId && r.top5[0].score > 0.85);
  console.log(`\n--- High-confidence correct examples (score > 0.85, ${confident.length} total) ---`);
  for (const c of confident.slice(0, 5)) {
    console.log(`  "${c.text}" (${c.type}) → ${c.top5[0].name} (${c.top5[0].score.toFixed(3)}) ✅`);
  }

  // Score distribution of correct top-1
  const correctScores = results.filter(r => r.top5[0].id === r.targetId).map(r => r.top5[0].score).sort((a, b) => a - b);
  if (correctScores.length > 0) {
    const median = correctScores[Math.floor(correctScores.length * 0.5)];
    const lowPct = correctScores.filter(s => s < 0.7).length / correctScores.length;
    const highPct = correctScores.filter(s => s >= 0.85).length / correctScores.length;
    console.log(`\n--- Correct-match score distribution ---`);
    console.log(`  median: ${median.toFixed(3)}`);
    console.log(`  % < 0.70: ${(lowPct * 100).toFixed(1)}%`);
    console.log(`  % ≥ 0.85: ${(highPct * 100).toFixed(1)}%`);
  }

  // Verdict
  console.log('\n═══════════════════════════════════════');
  const p1pct = p1 * 100;
  if (p1pct >= 85) {
    console.log(`✅ PASS (P@1=${p1pct.toFixed(1)}%). Granite is production-ready for occupation search.`);
    process.exit(0);
  } else if (p1pct >= 70) {
    console.log(`⚠️  WARN (P@1=${p1pct.toFixed(1)}%). Usable with synonym fallback.`);
    process.exit(0);
  } else {
    console.log(`❌ FAIL (P@1=${p1pct.toFixed(1)}%). Not accurate enough for production.`);
    process.exit(1);
  }
}

main();
