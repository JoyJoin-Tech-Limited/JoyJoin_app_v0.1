/**
 * Training Data Collector for Confusion Pair Classifier
 * Collects top-2 match snapshots from simulation runs
 */

import { TraitKey } from './types';

export interface MatchSnapshot {
  userId: number;
  traits: Record<TraitKey, number>;
  top1: {
    archetype: string;
    score: number;
  };
  top2: {
    archetype: string;
    score: number;
  };
  scoreGap: number;
  trueArchetype: string;
  isCorrect: boolean;
  isSimilarMatch: boolean;
  confusionPair: string | null;
  isPersistentConfusionPair: boolean;
}

export interface TrainingDataset {
  totalSamples: number;
  confusionPairSamples: number;
  persistentPairSamples: number;
  snapshots: MatchSnapshot[];
  confusionPairBreakdown: Record<string, {
    total: number;
    correct: number;
    accuracy: number;
  }>;
}

const PERSISTENT_PAIRS = [
  ['太阳鸡', '淡定海豚'],
  ['沉思猫头鹰', '稳如龟'],
  ['淡定海豚', '暖心熊'],
];

export class TrainingDataCollector {
  private snapshots: MatchSnapshot[] = [];

  reset(): void {
    this.snapshots = [];
  }

  addSnapshot(snapshot: MatchSnapshot): void {
    this.snapshots.push(snapshot);
  }

  collectFromResult(
    userId: number,
    traits: Record<TraitKey, number>,
    top1Archetype: string,
    top1Score: number,
    top2Archetype: string,
    top2Score: number,
    trueArchetype: string,
    isSimilarMatch: boolean
  ): void {
    const isCorrect = top1Archetype === trueArchetype;
    const scoreGap = top1Score - top2Score;
    
    const sortedPair = [top1Archetype, top2Archetype].sort();
    const confusionPair = top1Archetype !== top2Archetype 
      ? sortedPair.join(',') 
      : null;
    
    const isPersistentConfusionPair = PERSISTENT_PAIRS.some(
      ([a, b]) => 
        (top1Archetype === a && top2Archetype === b) ||
        (top1Archetype === b && top2Archetype === a)
    );

    this.addSnapshot({
      userId,
      traits: { ...traits },
      top1: { archetype: top1Archetype, score: top1Score },
      top2: { archetype: top2Archetype, score: top2Score },
      scoreGap,
      trueArchetype,
      isCorrect,
      isSimilarMatch,
      confusionPair,
      isPersistentConfusionPair,
    });
  }

  getDataset(): TrainingDataset {
    const confusionPairBreakdown: Record<string, { total: number; correct: number; accuracy: number }> = {};
    
    let confusionPairSamples = 0;
    let persistentPairSamples = 0;

    for (const snapshot of this.snapshots) {
      if (snapshot.confusionPair) {
        confusionPairSamples++;
        
        if (!confusionPairBreakdown[snapshot.confusionPair]) {
          confusionPairBreakdown[snapshot.confusionPair] = { total: 0, correct: 0, accuracy: 0 };
        }
        confusionPairBreakdown[snapshot.confusionPair].total++;
        if (snapshot.isCorrect) {
          confusionPairBreakdown[snapshot.confusionPair].correct++;
        }
      }
      
      if (snapshot.isPersistentConfusionPair) {
        persistentPairSamples++;
      }
    }

    for (const pair of Object.keys(confusionPairBreakdown)) {
      const data = confusionPairBreakdown[pair];
      data.accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    }

    return {
      totalSamples: this.snapshots.length,
      confusionPairSamples,
      persistentPairSamples,
      snapshots: this.snapshots,
      confusionPairBreakdown,
    };
  }

  getConfusionPairSnapshots(): MatchSnapshot[] {
    return this.snapshots.filter(s => s.isPersistentConfusionPair);
  }

  getPersistentPairSnapshots(): MatchSnapshot[] {
    return this.snapshots.filter(s => s.isPersistentConfusionPair && s.scoreGap < 0.1);
  }

  exportToJSON(): string {
    return JSON.stringify(this.getDataset(), null, 2);
  }
}

export const trainingDataCollector = new TrainingDataCollector();
