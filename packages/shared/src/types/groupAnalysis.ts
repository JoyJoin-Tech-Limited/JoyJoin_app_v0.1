export type OverallChemistry = 'fire' | 'warm' | 'mild' | 'cold';

export interface PairExplanation {
  pairKey: string;
  explanation: string;
  chemistryScore: number;
  sharedInterests: string[];
  connectionPoints: string[];
}

export interface GroupAnalysisResponse {
  groupId: string;
  overallChemistry: OverallChemistry;
  groupDynamics: string;
  iceBreakers: string[];
  pairExplanations: PairExplanation[];
  fromCache: boolean;
  generatedAt: string;
}
