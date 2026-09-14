/**
 * Monte Carlo group-formation harness — synthetic population + fixed profiles.
 *
 * Extracted verbatim from run-group-monte-carlo.ts (behaviour-preserving).
 */
import { findBestMatchingArchetypesV2 } from '../../../packages/shared/src/personality/matcherV2';
import { archetypePrototypes } from '../../../packages/shared/src/personality/prototypes';
import type { TraitKey } from '../../../packages/shared/src/personality/types';
import { INTEREST_TAXONOMY } from '../../../packages/shared/src/interests';
import { mulberry32, streamSeed } from './persona-utils';
import { sampleTrait } from './monte-carlo-rng';
import {
  ALL_TRAITS,
  CENTROID_MIXTURE_WEIGHT,
  CENTROID_TRAIT_SD,
  GENERAL_TRAIT_MEAN,
  GENERAL_TRAIT_SD,
} from './monte-carlo-constants';

// ── Synthetic Population (Item 6 mixture) ────────────────────────────

interface SyntheticRespondent {
  id: string;
  index: number;
  source: 'centroid_mixture' | 'general';
  sourceCentroid: string | null;
  trueTraits: Record<TraitKey, number>;
  trueArchetype: string;
}

function generatePopulation(n: number, seed: number): SyntheticRespondent[] {
  const rng = mulberry32(streamSeed(seed, 0, 'population'));
  const centroidIds = Object.keys(archetypePrototypes);
  const respondents: SyntheticRespondent[] = [];

  for (let i = 0; i < n; i++) {
    const isCentroidArm = rng() < CENTROID_MIXTURE_WEIGHT;
    const trueTraits = {} as Record<TraitKey, number>;
    let sourceCentroid: string | null = null;

    if (isCentroidArm) {
      sourceCentroid = centroidIds[Math.floor(rng() * centroidIds.length)];
      const centroid = archetypePrototypes[sourceCentroid].traitProfile;
      for (const trait of ALL_TRAITS) {
        trueTraits[trait] = sampleTrait(rng, centroid[trait], CENTROID_TRAIT_SD);
      }
    } else {
      for (const trait of ALL_TRAITS) {
        trueTraits[trait] = sampleTrait(rng, GENERAL_TRAIT_MEAN, GENERAL_TRAIT_SD);
      }
    }

    const trueMatch = findBestMatchingArchetypesV2(trueTraits);
    respondents.push({
      id: `P${String(i + 1).padStart(5, '0')}`,
      index: i,
      source: isCentroidArm ? 'centroid_mixture' : 'general',
      sourceCentroid,
      trueTraits,
      trueArchetype: trueMatch[0]?.archetype ?? '',
    });
  }

  return respondents;
}

// ── Fixed profile fields (identical across flag arms) ────────────────

interface SyntheticProfile {
  gender: string;
  birthdate: string;
  industryNiche: string;
  industryNicheLabel: string;
  industryCategoryLabel: string;
  educationLevel: string;
  lifeStage: string;
  preferredLanguages: string[];
  eventIntent: string[];
  interests: { topics: string[]; heatMap: Record<string, number> };
}

const INDUSTRIES: Array<[string, string, string]> = [
  ['saas', 'SaaS', '互联网'],
  ['ecommerce', '电商', '互联网'],
  ['finance', '金融', '金融'],
  ['consulting', '咨询', '专业服务'],
  ['healthcare', '医疗', '医疗健康'],
  ['education', '教育', '教育培训'],
  ['media', '媒体', '文化传媒'],
  ['manufacturing', '制造', '先进制造'],
];
const EDUCATION: Array<[string, number]> = [['大专', 0.1], ['本科', 0.6], ['硕士', 0.25], ['博士', 0.05]];
const LIFE_STAGES: Array<[string, number]> = [['学生党', 0.1], ['职场新人', 0.25], ['职场老手', 0.45], ['创业中', 0.1], ['自由职业', 0.1]];
const INTENTS = ['networking', 'friends', 'explore', 'romance'];

function pickWeighted<T>(rng: () => number, table: Array<[T, number]>): T {
  let roll = rng();
  for (const [value, weight] of table) {
    if (roll < weight) return value;
    roll -= weight;
  }
  return table[table.length - 1][0];
}

const ACTIVE_TOPICS = INTEREST_TAXONOMY.filter((t) => t.active !== false).map((t) => t.id);

function generateProfile(respondentIndex: number, seed: number): SyntheticProfile {
  const rng = mulberry32(streamSeed(seed, respondentIndex, 'profile'));

  const genderRoll = rng();
  const gender = genderRoll < 0.475 ? '男性' : genderRoll < 0.95 ? '女性' : '不透露';
  const birthYear = 1988 + Math.floor(rng() * 17); // age ~21–37 in 2026
  const birthdate = `${birthYear}-${String(1 + Math.floor(rng() * 12)).padStart(2, '0')}-15`;

  const [industryNiche, industryNicheLabel, industryCategoryLabel] =
    INDUSTRIES[Math.floor(rng() * INDUSTRIES.length)];

  const intentCount = rng() < 0.7 ? 1 : 2;
  const eventIntent: string[] = [];
  while (eventIntent.length < intentCount) {
    const candidate = INTENTS[Math.floor(rng() * INTENTS.length)];
    if (!eventIntent.includes(candidate)) eventIntent.push(candidate);
  }

  const topicCount = 3 + Math.floor(rng() * 3); // 3–5 topics
  const topics: string[] = [];
  const heatMap: Record<string, number> = {};
  while (topics.length < topicCount) {
    const topic = ACTIVE_TOPICS[Math.floor(rng() * ACTIVE_TOPICS.length)];
    if (!topics.includes(topic)) {
      topics.push(topic);
      heatMap[topic] = rng() < 0.3 ? 25 : 10;
    }
  }

  return {
    gender,
    birthdate,
    industryNiche,
    industryNicheLabel,
    industryCategoryLabel,
    educationLevel: pickWeighted(rng, EDUCATION),
    lifeStage: pickWeighted(rng, LIFE_STAGES),
    preferredLanguages: rng() < 0.85 ? ['中文'] : ['中文', 'English'],
    eventIntent,
    interests: { topics, heatMap },
  };
}

export type {
  SyntheticRespondent,
  SyntheticProfile,
};

export {
  generatePopulation,
  generateProfile,
};
