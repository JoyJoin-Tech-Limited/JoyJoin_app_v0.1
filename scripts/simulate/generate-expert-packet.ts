#!/usr/bin/env node
/**
 * Expert Review Packet Generator
 * Consumes simulation JSON artifact and produces human-readable markdown
 *
 * Usage:
 *   tsx scripts/simulate/generate-expert-packet.ts --in=sim-results.json --out=expert-review.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { archetypeRegistry } from '../../packages/shared/src/personality/archetypeRegistry';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SimulationArtifact {
  meta: {
    timestamp: string;
    personaFilter: string;
    noise: string;
    retest: number;
    isolationOnly: boolean;
    personaCount: number;
  };
  isolation: Array<{
    personaId: string;
    personaLabel: string;
    expectedArchetype: string;
    assignedArchetype: string;
    confidence: number;
    confidenceGap: number;
    isExactMatch: boolean;
    top3Matches: Array<{ archetype: string; score: number }>;
  }>;
  endToEnd: Array<{
    personaId: string;
    personaLabel: string;
    expectedArchetype: string;
    assignedArchetype: string | null;
    secondaryArchetype: string | null;
    confidence: number;
    confidenceGap: number;
    isExactMatch: boolean;
    isSimilarMatch: boolean;
    questionsAsked: number;
    l3DisambiguationTriggered: boolean;
    top3Matches: Array<{ archetype: string; score: number }>;
  }>;
}

function getArchetypeName(id: string): string {
  return archetypeRegistry[id as keyof typeof archetypeRegistry]?.name ?? id;
}

function formatTraitProfile(profile?: Record<string, number>): string {
  if (!profile) return '—';
  return `A=${profile.A} C=${profile.C} E=${profile.E} O=${profile.O} X=${profile.X} P=${profile.P}`;
}

function generatePacket(artifact: SimulationArtifact): string {
  const lines: string[] = [];
  const date = new Date().toISOString().slice(0, 10);

  // Header
  lines.push(`# 性格测试准确度专家评审包`);
  lines.push(`**生成日期:** ${date}`);
  lines.push(`**测试配置:** ${artifact.meta.noise} noise, ${artifact.meta.retest} retest runs`);
  lines.push(``);

  // Quick stats
  const isolationExact = artifact.isolation.filter((r) => r.isExactMatch).length;
  const endToEndExact = artifact.endToEnd.filter((r) => r.isExactMatch).length;
  const endToEndSimilar = artifact.endToEnd.filter((r) => r.isSimilarMatch).length;

  lines.push(`## 📊 快速统计`);
  lines.push(`| 指标 | 数值 |`);
  lines.push(`|------|------|`);
  lines.push(`| Matcher 隔离精确匹配 | ${isolationExact}/${artifact.isolation.length} (${((isolationExact / artifact.isolation.length) * 100).toFixed(1)}%) |`);
  lines.push(`| 端到端精确匹配 | ${endToEndExact}/${artifact.endToEnd.length} (${((endToEndExact / artifact.endToEnd.length) * 100).toFixed(1)}%) |`);
  lines.push(`| 端到端相似+精确 | ${endToEndSimilar}/${artifact.endToEnd.length} (${((endToEndSimilar / artifact.endToEnd.length) * 100).toFixed(1)}%) |`);
  lines.push(`| 平均问题数 | ${(artifact.endToEnd.reduce((s, r) => s + r.questionsAsked, 0) / artifact.endToEnd.length).toFixed(1)} |`);
  lines.push(`| 平均置信度 | ${(artifact.endToEnd.reduce((s, r) => s + r.confidence, 0) / artifact.endToEnd.length).toFixed(3)} |`);
  lines.push(`| L3消解题触发率 | ${((artifact.endToEnd.filter((r) => r.l3DisambiguationTriggered).length / artifact.endToEnd.length) * 100).toFixed(1)}% |`);
  lines.push(` `);

  // Persona catalog
  lines.push(`## 👤 人物画像目录`);
  lines.push(``);
  lines.push(`> **评审说明:** 请为每个人物画像评估「系统分配的原型」是否与其「特质配置」匹配。`);
  lines.push(`> `);
  lines.push(`> **评分标准:**`);
  lines.push(`> - 5分 = 完全匹配，毫无疑问`);
  lines.push(`> - 4分 = 高度匹配， minor quibbles`);
  lines.push(`> - 3分 = 基本匹配，但有明显偏向其他原型的特征`);
  lines.push(`> - 2分 = 偏差较大，更像另一个原型`);
  lines.push(`> - 1分 = 完全错误，原型分配不合理`);
  lines.push(` `);

  // Group by persona (deduplicate retest runs)
  const personaMap = new Map<string, typeof artifact.endToEnd[0][]>();
  for (const r of artifact.endToEnd) {
    if (!personaMap.has(r.personaId)) personaMap.set(r.personaId, []);
    personaMap.get(r.personaId)!.push(r);
  }

  for (const [personaId, runs] of personaMap) {
    const first = runs[0];
    const isBoundary = personaId.startsWith('boundary');
    const isolation = artifact.isolation.find((i) => i.personaId === personaId);

    lines.push(`### ${first.personaLabel}`);
    lines.push(`**ID:** \`${personaId}\` | **类别:** ${isBoundary ? '边界案例' : '中心案例'}`);
    lines.push(` `);
    lines.push(`**期望原型:** ${getArchetypeName(first.expectedArchetype)}`);
    lines.push(`**系统分配 (端到端):** ${first.assignedArchetype ? getArchetypeName(first.assignedArchetype) : '—'}`);
    lines.push(`**系统分配 (Matcher隔离):** ${isolation ? getArchetypeName(isolation.assignedArchetype) : '—'}`);
    lines.push(` `);

    if (runs.length > 1) {
      const consistent = runs.every((r) => r.assignedArchetype === first.assignedArchetype);
      lines.push(`**重测一致性:** ${consistent ? '✅ 一致' : '❌ 不一致'} (${runs.length} 次运行)`);
      lines.push(` `);
    }

    lines.push(`**Top-3 匹配:**`);
    for (const m of first.top3Matches) {
      lines.push(`- ${getArchetypeName(m.archetype)}: ${m.score.toFixed(3)}`);
    }
    lines.push(` `);
    lines.push(`**置信度:** ${first.confidence.toFixed(3)} | **置信 gap:** ${first.confidenceGap.toFixed(3)}`);
    lines.push(`**问题数:** ${first.questionsAsked} | **L3消解题:** ${first.l3DisambiguationTriggered ? '是' : '否'}`);
    lines.push(` `);

    // Review rubric
    lines.push(`#### 评审表`);
    lines.push(`| 评审项 | 评分 (1-5) | 备注 |`);
    lines.push(`|--------|-----------|------|`);
    lines.push(`| 原型匹配度 | __ | 分配的原型是否符合此人物画像？ |`);
    lines.push(`| 置信度合理性 | __ | top-1 vs top-2 的 gap 是否合理？ |`);
    lines.push(`| 边界区分度 | __ | 如果是边界案例，区分是否足够清晰？ |`);
    lines.push(` `);
    lines.push(`**开放意见:**`);
    lines.push(` `);
    lines.push(`---`);
    lines.push(` `);
  }

  // Confusion pair deep-dives
  lines.push(`## 🔍 混淆对深度分析`);
  lines.push(` `);

  // Collect boundary personas by pair
  const pairGroups = new Map<string, typeof artifact.endToEnd>();
  for (const r of artifact.endToEnd) {
    if (!r.personaId.startsWith('boundary')) continue;
    const meta = artifact.isolation.find((i) => i.personaId === r.personaId);
    const pair = meta?.personaLabel?.split('↔')[0];
    if (!pair) continue;
    // Better: use the metadata from the persona file
    // For now, skip detailed pair grouping in packet; the persona catalog covers it
  }

  lines.push(`> 详细混淆对分析见上方「人物画像目录」中的边界案例。`);
  lines.push(` `);

  // Footer
  lines.push(`---`);
  lines.push(`*Generated by JoyJoin Personality Simulation Suite*`);

  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const inFile = args.find((a) => a.startsWith('--in='))?.slice(5) || '';
  const outFile = args.find((a) => a.startsWith('--out='))?.slice(6) || `expert-review-${new Date().toISOString().slice(0, 10)}.md`;

  if (!inFile) {
    console.error('Usage: tsx scripts/simulate/generate-expert-packet.ts --in=sim-results.json [--out=expert-review.md]');
    process.exit(1);
  }

  const inPath = path.resolve(inFile);
  if (!fs.existsSync(inPath)) {
    console.error(`❌ File not found: ${inPath}`);
    process.exit(1);
  }

  const artifact: SimulationArtifact = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const packet = generatePacket(artifact);

  const outPath = path.resolve(outFile);
  fs.writeFileSync(outPath, packet, 'utf8');
  console.log(`✅ Generated expert review packet: ${outPath}`);
}

main();
