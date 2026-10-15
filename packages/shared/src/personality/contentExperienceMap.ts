/**
 * Content Experience Map — P0 guardrail metadata (PR1, 2026-10-14).
 *
 * Sidecar registry for the V4 question bank: domain + motif tags consumed ONLY by
 * `contentExperienceGuardrail.test.ts` (tagging completeness, guaranteed-spine domain
 * coverage, spine motif cap, bank-wide motif ratchet). Deliberately NOT part of
 * `AdaptiveQuestion` — no engine code reads this file.
 *
 * Taxonomy source of truth: docs/design/2026-10-14-personality-test-content-refresh-pr1.md §5.
 * Domains describe the life area; motifs describe the decision structure (template-level,
 * not raw-situation level) so template clusters — e.g. the 2026-10 invite-family cluster —
 * cannot silently regrow.
 */

export type ContentDomain =
  | 'social_initiation'
  | 'community'
  | 'family'
  | 'work'
  | 'friendship'
  | 'play_learning'
  | 'digital_life'
  | 'competition'
  | 'travel'
  | 'solo_passion'
  | 'values'
  | 'money'
  | 'imagination'
  | 'nature_city';

export const CONTENT_DOMAINS: readonly ContentDomain[] = [
  'social_initiation',
  'community',
  'family',
  'work',
  'friendship',
  'play_learning',
  'digital_life',
  'competition',
  'travel',
  'solo_passion',
  'values',
  'money',
  'imagination',
  'nature_city',
];

/** Closed allowlist — the guardrail test fails on any tag outside this union. */
export type ContentMotif =
  | 'spontaneous_invite_join'
  | 'plan_vs_social_invite'
  | 'stranger_approach_response'
  | 'new_group_entry'
  | 'group_activity_choice'
  | 'group_game_learning'
  | 'group_photo_role'
  | 'optimization_disclosure'
  | 'gift_choice'
  | 'competition_response'
  | 'travel_mishap_recovery'
  | 'support_giving'
  | 'social_energy_recovery'
  | 'group_chat_dynamics'
  | 'content_sharing'
  | 'opinion_disagreement'
  | 'social_media_moment'
  | 'practical_help'
  | 'friction_forgiveness'
  | 'creative_generation'
  | 'novelty_exploration'
  | 'plan_disruption_response'
  | 'mood_resilience'
  | 'positivity_outlook'
  | 'self_reflection'
  | 'attention_check'
  | 'energy_dial'
  | 'conflict_instinct'
  | 'self_view_calibration'
  | 'money_splitting'
  | 'group_inclusion'
  | 'relationship_maintenance'
  | 'knowledge_pursuit'
  | 'learning_style'
  | 'commitment_planning'
  | 'work_collaboration'
  | 'problem_solving'
  | 'joy_celebration'
  | 'awkward_moment_response'
  | 'spotlight_response'
  | 'initiating_contact'
  | 'cultural_taste'
  | 'secret_handling';

export const CONTENT_MOTIFS: readonly ContentMotif[] = [
  'spontaneous_invite_join',
  'plan_vs_social_invite',
  'stranger_approach_response',
  'new_group_entry',
  'group_activity_choice',
  'group_game_learning',
  'group_photo_role',
  'optimization_disclosure',
  'gift_choice',
  'competition_response',
  'travel_mishap_recovery',
  'support_giving',
  'social_energy_recovery',
  'group_chat_dynamics',
  'content_sharing',
  'opinion_disagreement',
  'social_media_moment',
  'practical_help',
  'friction_forgiveness',
  'creative_generation',
  'novelty_exploration',
  'plan_disruption_response',
  'mood_resilience',
  'positivity_outlook',
  'self_reflection',
  'attention_check',
  'energy_dial',
  'conflict_instinct',
  'self_view_calibration',
  'money_splitting',
  'group_inclusion',
  'relationship_maintenance',
  'knowledge_pursuit',
  'learning_style',
  'commitment_planning',
  'work_collaboration',
  'problem_solving',
  'joy_celebration',
  'awkward_moment_response',
  'spotlight_response',
  'initiating_contact',
  'cultural_taste',
  'secret_handling',
];

export interface ContentExperience {
  domain: ContentDomain;
  motifs: readonly ContentMotif[];
}

export const CONTENT_EXPERIENCE_MAP: Record<string, ContentExperience> = {
  // ── L1 foundation (Q1–Q15) ─────────────────────────────────────────
  Q1: { domain: 'community', motifs: ['spontaneous_invite_join'] },
  Q2: { domain: 'work', motifs: ['group_activity_choice'] },
  Q3: { domain: 'friendship', motifs: ['plan_vs_social_invite'] },
  Q4: { domain: 'play_learning', motifs: ['group_game_learning'] },
  Q5: { domain: 'family', motifs: ['group_photo_role'] },
  Q6: { domain: 'digital_life', motifs: ['optimization_disclosure'] },
  Q7: { domain: 'friendship', motifs: ['gift_choice'] },
  Q8: { domain: 'competition', motifs: ['competition_response'] },
  Q9: { domain: 'digital_life', motifs: ['opinion_disagreement'] },
  Q10: { domain: 'social_initiation', motifs: ['plan_disruption_response'] },
  Q11: { domain: 'social_initiation', motifs: ['spotlight_response'] },
  Q12: { domain: 'play_learning', motifs: ['plan_disruption_response'] },
  Q13: { domain: 'social_initiation', motifs: ['new_group_entry'] },
  Q14: { domain: 'friendship', motifs: ['group_activity_choice'] },
  Q15: { domain: 'friendship', motifs: ['relationship_maintenance'] },

  // ── L2 core exploration (Q16–Q54, incl. pure calibration) ──────────
  Q16: { domain: 'friendship', motifs: ['support_giving'] },
  Q17: { domain: 'nature_city', motifs: ['novelty_exploration'] },
  Q18: { domain: 'social_initiation', motifs: ['social_energy_recovery'] },
  Q19: { domain: 'digital_life', motifs: ['practical_help'] },
  Q20: { domain: 'friendship', motifs: ['opinion_disagreement'] },
  Q21: { domain: 'play_learning', motifs: ['group_game_learning'] },
  Q21_v1: { domain: 'digital_life', motifs: ['optimization_disclosure'] },
  Q22: { domain: 'friendship', motifs: ['opinion_disagreement'] },
  Q22_v1: { domain: 'friendship', motifs: ['opinion_disagreement'] },
  Q23: { domain: 'money', motifs: ['money_splitting'] },
  Q23_v1: { domain: 'money', motifs: ['money_splitting'] },
  Q24: { domain: 'friendship', motifs: ['group_activity_choice'] },
  Q25: { domain: 'play_learning', motifs: ['practical_help'] },
  Q26: { domain: 'values', motifs: ['self_reflection'] },
  Q27: { domain: 'work', motifs: ['creative_generation'] },
  Q28: { domain: 'digital_life', motifs: ['group_chat_dynamics'] },
  Q29: { domain: 'friendship', motifs: ['joy_celebration'] },
  Q30: { domain: 'digital_life', motifs: ['group_chat_dynamics'] },
  Q31: { domain: 'friendship', motifs: ['group_activity_choice'] },
  Q32: { domain: 'play_learning', motifs: ['group_game_learning'] },
  Q33: { domain: 'community', motifs: ['friction_forgiveness'] },
  Q34: { domain: 'digital_life', motifs: ['content_sharing'] },
  Q35: { domain: 'play_learning', motifs: ['plan_disruption_response'] },
  Q36: { domain: 'play_learning', motifs: ['novelty_exploration'] },
  Q37: { domain: 'friendship', motifs: ['support_giving'] },
  Q38: { domain: 'social_initiation', motifs: ['social_energy_recovery'] },
  Q39: { domain: 'work', motifs: ['spotlight_response'] },
  Q40: { domain: 'community', motifs: ['relationship_maintenance'] },
  Q41: { domain: 'friendship', motifs: ['cultural_taste'] },
  Q42: { domain: 'social_initiation', motifs: ['group_inclusion'] },
  Q43: { domain: 'social_initiation', motifs: ['social_energy_recovery'] },
  Q44: { domain: 'friendship', motifs: ['practical_help'] },
  Q45: { domain: 'play_learning', motifs: ['creative_generation'] },
  Q46: { domain: 'social_initiation', motifs: ['opinion_disagreement'] },
  Q47: { domain: 'digital_life', motifs: ['joy_celebration'] },
  Q48: { domain: 'solo_passion', motifs: ['knowledge_pursuit'] },
  Q49: { domain: 'nature_city', motifs: ['novelty_exploration'] },
  Q50: { domain: 'friendship', motifs: ['secret_handling'] },
  Q51_PureX: { domain: 'social_initiation', motifs: ['stranger_approach_response'] },
  Q52_PureO: { domain: 'solo_passion', motifs: ['knowledge_pursuit'] },
  Q53_PureC: { domain: 'friendship', motifs: ['commitment_planning'] },
  Q54_PureP: { domain: 'play_learning', motifs: ['positivity_outlook'] },

  // ── Extended (Q78–Q83, Q51–Q74) ────────────────────────────────────
  Q78: { domain: 'social_initiation', motifs: ['spontaneous_invite_join'] },
  Q79: { domain: 'play_learning', motifs: ['creative_generation'] },
  Q80: { domain: 'social_initiation', motifs: ['initiating_contact'] },
  Q81: { domain: 'friendship', motifs: ['support_giving'] },
  Q82: { domain: 'social_initiation', motifs: ['initiating_contact'] },
  Q83: { domain: 'friendship', motifs: ['opinion_disagreement'] },
  Q51: { domain: 'values', motifs: ['self_reflection'] },
  Q52: { domain: 'values', motifs: ['self_reflection'] },
  Q53: { domain: 'values', motifs: ['self_reflection'] },
  Q54: { domain: 'values', motifs: ['self_reflection'] },
  Q55: { domain: 'values', motifs: ['self_reflection'] },
  Q56: { domain: 'friendship', motifs: ['support_giving'] },
  Q57: { domain: 'friendship', motifs: ['awkward_moment_response'] },
  Q58: { domain: 'friendship', motifs: ['support_giving'] },
  Q59: { domain: 'values', motifs: ['self_reflection'] },
  Q60: { domain: 'values', motifs: ['self_reflection'] },
  Q61: { domain: 'social_initiation', motifs: ['spontaneous_invite_join'] },
  Q62: { domain: 'digital_life', motifs: ['social_media_moment'] },
  Q63: { domain: 'social_initiation', motifs: ['mood_resilience'] },
  Q64: { domain: 'social_initiation', motifs: ['plan_disruption_response'] },
  Q65: { domain: 'play_learning', motifs: ['mood_resilience'] },
  Q66: { domain: 'work', motifs: ['work_collaboration'] },
  Q67: { domain: 'work', motifs: ['spotlight_response'] },
  Q68: { domain: 'solo_passion', motifs: ['learning_style'] },
  Q70: { domain: 'play_learning', motifs: ['novelty_exploration'] },
  Q71: { domain: 'play_learning', motifs: ['group_game_learning'] },
  Q72: { domain: 'play_learning', motifs: ['spotlight_response'] },
  Q73: { domain: 'friendship', motifs: ['joy_celebration'] },
  Q74: { domain: 'friendship', motifs: ['positivity_outlook'] },

  // ── Extended part 2 (E/P precision + bridges + consistency) ────────
  Q136: { domain: 'social_initiation', motifs: ['mood_resilience'] },
  Q137: { domain: 'social_initiation', motifs: ['mood_resilience'] },
  Q138: { domain: 'work', motifs: ['mood_resilience'] },
  Q139: { domain: 'friendship', motifs: ['mood_resilience'] },
  Q140: { domain: 'social_initiation', motifs: ['mood_resilience'] },
  Q141: { domain: 'solo_passion', motifs: ['positivity_outlook'] },
  Q142: { domain: 'solo_passion', motifs: ['positivity_outlook'] },
  Q143: { domain: 'play_learning', motifs: ['positivity_outlook'] },
  Q144: { domain: 'solo_passion', motifs: ['positivity_outlook'] },
  Q145: { domain: 'friendship', motifs: ['positivity_outlook'] },
  Q146: { domain: 'social_initiation', motifs: ['mood_resilience'] },
  Q147: { domain: 'social_initiation', motifs: ['mood_resilience'] },
  Q148: { domain: 'solo_passion', motifs: ['mood_resilience'] },
  Q149: { domain: 'solo_passion', motifs: ['positivity_outlook'] },
  Q150: { domain: 'travel', motifs: ['travel_mishap_recovery'] },
  Q151: { domain: 'friendship', motifs: ['friction_forgiveness'] },
  Q152: { domain: 'work', motifs: ['friction_forgiveness'] },
  Q153: { domain: 'social_initiation', motifs: ['friction_forgiveness'] },
  Q166: { domain: 'friendship', motifs: ['commitment_planning'] },
  Q167: { domain: 'solo_passion', motifs: ['knowledge_pursuit'] },

  // ── Advanced (O dimension + forced choice + confusion pairs) ───────
  Q69: { domain: 'values', motifs: ['attention_check'] },
  Q75: { domain: 'imagination', motifs: ['novelty_exploration'] },
  Q76: { domain: 'imagination', motifs: ['cultural_taste'] },
  Q77: { domain: 'travel', motifs: ['novelty_exploration'] },
  Q84: { domain: 'friendship', motifs: ['group_activity_choice'] },
  Q85: { domain: 'social_initiation', motifs: ['social_energy_recovery'] },
  Q86: { domain: 'friendship', motifs: ['support_giving'] },
  Q87: { domain: 'work', motifs: ['work_collaboration'] },
  Q88: { domain: 'social_initiation', motifs: ['group_inclusion'] },
  Q89: { domain: 'values', motifs: ['mood_resilience'] },
  Q90: { domain: 'social_initiation', motifs: ['awkward_moment_response'] },
  Q91: { domain: 'imagination', motifs: ['creative_generation'] },
  Q92: { domain: 'friendship', motifs: ['support_giving'] },
  Q93: { domain: 'friendship', motifs: ['practical_help'] },
  Q94: { domain: 'solo_passion', motifs: ['learning_style'] },
  Q95: { domain: 'values', motifs: ['problem_solving'] },
  Q96: { domain: 'work', motifs: ['problem_solving'] },
  Q97: { domain: 'friendship', motifs: ['joy_celebration'] },
  Q98: { domain: 'social_initiation', motifs: ['group_activity_choice'] },
  Q99: { domain: 'community', motifs: ['spontaneous_invite_join'] },
  Q100: { domain: 'work', motifs: ['creative_generation'] },
  Q101: { domain: 'solo_passion', motifs: ['knowledge_pursuit'] },
  Q102: { domain: 'friendship', motifs: ['spotlight_response'] },

  // ── Attractor (confusion pairs + playful closings + meta) ──────────
  Q103: { domain: 'friendship', motifs: ['creative_generation'] },
  Q104: { domain: 'social_initiation', motifs: ['opinion_disagreement'] },
  Q105: { domain: 'solo_passion', motifs: ['social_energy_recovery'] },
  Q106: { domain: 'solo_passion', motifs: ['problem_solving'] },
  Q107: { domain: 'social_initiation', motifs: ['social_energy_recovery'] },
  Q108: { domain: 'social_initiation', motifs: ['group_activity_choice'] },
  Q109: { domain: 'friendship', motifs: ['joy_celebration'] },
  Q110: { domain: 'social_initiation', motifs: ['group_inclusion'] },
  Q111: { domain: 'friendship', motifs: ['self_reflection'] },
  Q112: { domain: 'friendship', motifs: ['support_giving'] },
  Q113: { domain: 'social_initiation', motifs: ['group_inclusion'] },
  Q114: { domain: 'friendship', motifs: ['support_giving'] },
  Q115: { domain: 'social_initiation', motifs: ['social_energy_recovery'] },
  Q116: { domain: 'work', motifs: ['work_collaboration'] },
  Q117: { domain: 'imagination', motifs: ['creative_generation'] },
  Q118: { domain: 'social_initiation', motifs: ['creative_generation'] },
  Q119: { domain: 'social_initiation', motifs: ['spontaneous_invite_join'] },
  Q120: { domain: 'social_initiation', motifs: ['plan_disruption_response'] },
  Q121: { domain: 'work', motifs: ['support_giving'] },
  Q122: { domain: 'friendship', motifs: ['joy_celebration'] },
  Q123: { domain: 'friendship', motifs: ['support_giving'] },
  Q124: { domain: 'friendship', motifs: ['group_inclusion'] },
  Q125: { domain: 'work', motifs: ['support_giving'] },
  Q126: { domain: 'solo_passion', motifs: ['positivity_outlook'] },
  Q127: { domain: 'digital_life', motifs: ['opinion_disagreement'] },
  Q128: { domain: 'social_initiation', motifs: ['spontaneous_invite_join'] },
  Q129: { domain: 'solo_passion', motifs: ['social_energy_recovery'] },
  Q130: { domain: 'friendship', motifs: ['support_giving'] },
  Q131: { domain: 'work', motifs: ['support_giving'] },
  Q132: { domain: 'friendship', motifs: ['group_activity_choice'] },
  Q133: { domain: 'imagination', motifs: ['creative_generation'] },
  Q134: { domain: 'travel', motifs: ['commitment_planning'] },
  Q135: { domain: 'friendship', motifs: ['joy_celebration'] },
  Q_PLAYFUL_SLIDER: { domain: 'solo_passion', motifs: ['energy_dial'] },
  Q_PLAYFUL_EMOJI: { domain: 'social_initiation', motifs: ['conflict_instinct'] },
  Q168: { domain: 'values', motifs: ['self_view_calibration'] },

  // ── Ipsative (flag-gated, ships dark) ──────────────────────────────
  Q154: { domain: 'social_initiation', motifs: ['awkward_moment_response'] },
  Q155: { domain: 'social_initiation', motifs: ['group_inclusion'] },
  Q156: { domain: 'travel', motifs: ['commitment_planning'] },
  Q157: { domain: 'friendship', motifs: ['joy_celebration'] },
  Q158: { domain: 'solo_passion', motifs: ['plan_disruption_response'] },
  Q159: { domain: 'solo_passion', motifs: ['commitment_planning'] },
  Q160: { domain: 'solo_passion', motifs: ['positivity_outlook'] },
  Q161: { domain: 'solo_passion', motifs: ['positivity_outlook'] },
  Q162: { domain: 'solo_passion', motifs: ['learning_style'] },
  Q163: { domain: 'friendship', motifs: ['novelty_exploration'] },
  Q164: { domain: 'solo_passion', motifs: ['commitment_planning'] },
  Q165: { domain: 'solo_passion', motifs: ['commitment_planning'] },
};
