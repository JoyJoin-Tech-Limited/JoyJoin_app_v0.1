import { XIAOYUE_PERSONA, GENDER_NEUTRAL, GENDER_ADAPTATION } from './persona';
import { 
  XIAOYUE_PHRASES, 
  RESPONSE_TECHNIQUES, 
  PROFESSION_RESPONSES, 
  PROFESSION_FOLLOWUP, 
  DIALECT_PHRASES 
} from './phrases';
import { 
  SAFETY_GUARDRAILS, 
  PRIVACY_PROTECTION, 
  CONVERSATION_BOUNDARIES, 
  OUTPUT_RULES 
} from './governance';
import { 
  REASONING_SCRATCHPAD, 
  SMART_INFERENCE_PROMPT, 
  CHAIN_OF_THOUGHT_HIDDEN 
} from './reasoning';

export interface PromptModules {
  persona: string;
  genderNeutral: string;
  genderAdaptation: string;
  phrases: string;
  responseTechniques: string;
  professionResponses: string;
  professionFollowup: string;
  dialectPhrases: string;
  safetyGuardrails: string;
  privacyProtection: string;
  conversationBoundaries: string;
  outputRules: string;
  reasoningScratchpad: string;
  smartInferencePrompt: string;
  chainOfThoughtHidden: string;
}

export const promptModules: PromptModules = {
  persona: XIAOYUE_PERSONA,
  genderNeutral: GENDER_NEUTRAL,
  genderAdaptation: GENDER_ADAPTATION,
  phrases: XIAOYUE_PHRASES,
  responseTechniques: RESPONSE_TECHNIQUES,
  professionResponses: PROFESSION_RESPONSES,
  professionFollowup: PROFESSION_FOLLOWUP,
  dialectPhrases: DIALECT_PHRASES,
  safetyGuardrails: SAFETY_GUARDRAILS,
  privacyProtection: PRIVACY_PROTECTION,
  conversationBoundaries: CONVERSATION_BOUNDARIES,
  outputRules: OUTPUT_RULES,
  reasoningScratchpad: REASONING_SCRATCHPAD,
  smartInferencePrompt: SMART_INFERENCE_PROMPT,
  chainOfThoughtHidden: CHAIN_OF_THOUGHT_HIDDEN,
};

export function buildSystemPrompt(options: {
  includeReasoning?: boolean;
  includeGovernance?: boolean;
  includeFullPhrases?: boolean;
} = {}): string {
  const { 
    includeReasoning = false, 
    includeGovernance = true,
    includeFullPhrases = true 
  } = options;

  const sections: string[] = [
    '你是"小悦"，悦聚平台的AI社交助手。你的任务是通过轻松愉快的对话，帮助新用户完成注册信息收集。',
    '',
    XIAOYUE_PERSONA,
    '',
    XIAOYUE_PHRASES,
    '',
    GENDER_ADAPTATION,
  ];

  if (includeFullPhrases) {
    sections.push('', RESPONSE_TECHNIQUES);
    sections.push('', PROFESSION_RESPONSES);
    sections.push('', PROFESSION_FOLLOWUP);
    sections.push('', DIALECT_PHRASES);
  }

  if (includeGovernance) {
    sections.push('', SAFETY_GUARDRAILS);
    sections.push('', PRIVACY_PROTECTION);
    sections.push('', CONVERSATION_BOUNDARIES);
    sections.push('', OUTPUT_RULES);
  }

  if (includeReasoning) {
    sections.push('', REASONING_SCRATCHPAD);
    sections.push('', SMART_INFERENCE_PROMPT);
    sections.push('', CHAIN_OF_THOUGHT_HIDDEN);
  }

  return sections.join('\n');
}

export function getPersonaModule(): string {
  return XIAOYUE_PERSONA;
}

export function getGovernanceModules(): string {
  return [
    SAFETY_GUARDRAILS,
    PRIVACY_PROTECTION,
    CONVERSATION_BOUNDARIES,
    OUTPUT_RULES
  ].join('\n\n');
}

export function getPhrasesModules(): string {
  return [
    XIAOYUE_PHRASES,
    RESPONSE_TECHNIQUES,
    PROFESSION_RESPONSES,
    PROFESSION_FOLLOWUP,
    DIALECT_PHRASES
  ].join('\n\n');
}

export function getReasoningModules(): string {
  return [
    REASONING_SCRATCHPAD,
    SMART_INFERENCE_PROMPT,
    CHAIN_OF_THOUGHT_HIDDEN
  ].join('\n\n');
}

export {
  XIAOYUE_PERSONA,
  GENDER_NEUTRAL,
  GENDER_ADAPTATION,
  XIAOYUE_PHRASES,
  RESPONSE_TECHNIQUES,
  PROFESSION_RESPONSES,
  PROFESSION_FOLLOWUP,
  DIALECT_PHRASES,
  SAFETY_GUARDRAILS,
  PRIVACY_PROTECTION,
  CONVERSATION_BOUNDARIES,
  OUTPUT_RULES,
  REASONING_SCRATCHPAD,
  SMART_INFERENCE_PROMPT,
  CHAIN_OF_THOUGHT_HIDDEN,
};
