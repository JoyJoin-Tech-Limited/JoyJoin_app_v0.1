/**
 * Rule-template library tests — sprint entry-card-insight-v2 (AC-05/AC-12).
 *
 * The guardrails chain does NOT scan copy text for review-blocked vocabulary,
 * so this suite is the enforcement point: every template and archetype-level
 * observation line must be free of 匹配/社交/灵魂/撮合/AI and emoji.
 */

import { describe, expect, it } from 'vitest';
import {
  MIN_TAGLINE_LINE_CHARS,
  OBSERVATION_INTEREST_TEMPLATES,
  ARCHETYPE_OBSERVATION_LINES,
  ARCHETYPE_RULE_TEMPLATES,
  renderRuleTemplate,
  sanitizeSlotValue,
  type RuleTemplate,
} from '@shared/copy/profileTaglineRuleTemplates';
import { findReviewBlockedVocab } from '@shared/copy/terms';
import { ARCHETYPE_DEFINITIONS, ARCHETYPE_CANONICAL_ORDER } from '@shared/personality/archetypeNames';

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
const SLOT_MARKER_RE = /\{(interest|interest2|priority|answer)\}/g;

function allTemplates(): Array<{ archetype: string; template: RuleTemplate }> {
  return Object.entries(ARCHETYPE_RULE_TEMPLATES).flatMap(([archetype, templates]) =>
    templates.map((template) => ({ archetype, template })),
  );
}

describe('profileTaglineRuleTemplates (AC-12 copy governance)', () => {
  it('covers all 12 archetypes with 3 slotted + 1 slot-free inference safety net each', () => {
    const archetypeIds = ARCHETYPE_DEFINITIONS.map((d) => d.id);
    expect(archetypeIds).toHaveLength(12);
    for (const id of archetypeIds) {
      const templates = ARCHETYPE_RULE_TEMPLATES[id];
      expect(templates, `missing templates for ${id}`).toBeDefined();
      expect(ARCHETYPE_OBSERVATION_LINES[id], `missing observation line for ${id}`).toBeTruthy();

      const slotted = templates.filter((t) => t.requiredSlots.length > 0);
      const slotFreeInference = templates.filter(
        (t) => t.role === 'inference' && t.requiredSlots.length === 0,
      );
      // Contract D5: 3-4 slotted templates per archetype…
      expect(slotted.length, `${id} slotted count`).toBeGreaterThanOrEqual(3);
      // …plus exactly one slot-free inference net so lines never drop below 2
      // when every slot is empty (AC-05 "LLM 双行全灭时 lines 最少 2 行").
      expect(slotFreeInference.length, `${id} slot-free inference count`).toBe(1);
      expect(templates.some((t) => t.role === 'reveal')).toBe(true);
    }
  });

  it('every {slot} marker in a template is declared in requiredSlots (and vice versa)', () => {
    for (const { archetype, template } of allTemplates()) {
      const markers = [...template.text.matchAll(SLOT_MARKER_RE)].map((m) => m[1]);
      expect(
        new Set(markers),
        `${archetype} marker/declaration mismatch in "${template.text}"`,
      ).toEqual(new Set(template.requiredSlots));
    }
    for (const template of OBSERVATION_INTEREST_TEMPLATES) {
      const markers = [...template.text.matchAll(SLOT_MARKER_RE)].map((m) => m[1]);
      expect(new Set(markers)).toEqual(new Set(template.requiredSlots));
    }
  });

  it('no template contains review-blocked vocabulary (匹配/社交/灵魂/撮合/AI)', () => {
    const allTexts = [
      ...allTemplates().map(({ template }) => template.text),
      ...Object.values(ARCHETYPE_OBSERVATION_LINES),
      ...OBSERVATION_INTEREST_TEMPLATES.map((t) => t.text),
    ];
    expect(allTexts.length).toBeGreaterThanOrEqual(12 * 4 + 12 + 2);
    for (const text of allTexts) {
      expect(findReviewBlockedVocab(text), `blocked vocab in "${text}"`).toBeNull();
    }
  });

  it('no template contains emoji', () => {
    const allTexts = [
      ...allTemplates().map(({ template }) => template.text),
      ...Object.values(ARCHETYPE_OBSERVATION_LINES),
      ...OBSERVATION_INTEREST_TEMPLATES.map((t) => t.text),
    ];
    for (const text of allTexts) {
      expect(EMOJI_RE.test(text), `emoji in "${text}"`).toBe(false);
    }
  });

  it('slot-free templates render at ≥ MIN_TAGLINE_LINE_CHARS without any slots', () => {
    for (const { archetype, template } of allTemplates()) {
      if (template.requiredSlots.length > 0) continue;
      const rendered = renderRuleTemplate(template, {});
      expect(rendered, `${archetype} slot-free template failed to render`).not.toBeNull();
      expect(rendered!.length).toBeGreaterThanOrEqual(MIN_TAGLINE_LINE_CHARS);
    }
  });
});

// ─── Amendment A1 (AC-20) copy upgrade ───────────────────────────────────────

describe('AC-20① UIUX-audit line rewrites (verbatim)', () => {
  it('elephant interest-inference line is the audit rewrite', () => {
    const elephant = ARCHETYPE_RULE_TEMPLATES.elephant.find(
      (t) => t.role === 'inference' && t.requiredSlots.includes('interest'),
    );
    expect(elephant?.text).toBe('聊到{interest}你是认真的很——约好的事，你会一直在');
  });

  it('rooster reveal line is the audit rewrite', () => {
    const rooster = ARCHETYPE_RULE_TEMPLATES.rooster.find((t) => t.role === 'reveal');
    expect(rooster?.text).toBe('热闹哪儿都有，你把{priority}放最前面，是想有人接得住你的热');
  });

  it('octopus interest-inference line is the audit rewrite', () => {
    const octopus = ARCHETYPE_RULE_TEMPLATES.octopus.find(
      (t) => t.role === 'inference' && t.requiredSlots.includes('interest'),
    );
    expect(octopus?.text).toBe('一聊{interest}你的点子就停不下来，同桌的人只想听你再讲一个');
  });

  it('observation template one is the audit rewrite', () => {
    expect(OBSERVATION_INTEREST_TEMPLATES[0].text).toBe(
      '{interest}和{interest2}——你舍得为这两件事花时间',
    );
  });
});

describe('AC-20② reveal-frame diversity (防截图穿帮)', () => {
  type RevealFrame = 'biaocheng-zuizaiyi' | 'fang-zuiqian' | 'zuikanzhong';

  function frameOf(text: string): RevealFrame {
    if (text.includes('标成最在意')) return 'biaocheng-zuizaiyi';
    if (text.includes('放在第一位') || text.includes('放最前面')) return 'fang-zuiqian';
    if (text.includes('最看重')) return 'zuikanzhong';
    throw new Error(`reveal template uses an unregistered sentence frame: ${text}`);
  }

  it('uses at least 3 distinct reveal sentence frames across archetypes', () => {
    const frames = ARCHETYPE_CANONICAL_ORDER.map((id) => {
      const reveal = ARCHETYPE_RULE_TEMPLATES[id]?.find((t) => t.role === 'reveal');
      expect(reveal, `missing reveal template for ${id}`).toBeDefined();
      return frameOf(reveal!.text);
    });
    expect(new Set(frames).size).toBeGreaterThanOrEqual(3);
  });

  it('no two adjacent archetypes (canonical order) share the same reveal skeleton', () => {
    const frames = ARCHETYPE_CANONICAL_ORDER.map(
      (id) => frameOf(ARCHETYPE_RULE_TEMPLATES[id].find((t) => t.role === 'reveal')!.text),
    );
    for (let i = 1; i < frames.length; i++) {
      expect(
        frames[i],
        `adjacent reveal frames collide at index ${i} (${ARCHETYPE_CANONICAL_ORDER[i - 1]} → ${ARCHETYPE_CANONICAL_ORDER[i]})`,
      ).not.toBe(frames[i - 1]);
    }
  });
});

describe('renderRuleTemplate (AC-05 drop rules)', () => {
  const template: RuleTemplate = {
    role: 'inference',
    text: '聊到{interest}时你总是第一个举手',
    requiredSlots: ['interest'],
  };

  it('renders when all required slots are filled', () => {
    expect(renderRuleTemplate(template, { interest: '飞盘' })).toBe('聊到飞盘时你总是第一个举手');
  });

  it('returns null when a required slot is missing (slot fill failure → drop line)', () => {
    expect(renderRuleTemplate(template, {})).toBeNull();
    expect(renderRuleTemplate(template, { interest: '   ' })).toBeNull();
  });

  it('returns null when the rendered text is shorter than MIN_TAGLINE_LINE_CHARS', () => {
    const tiny: RuleTemplate = { role: 'inference', text: '你{interest}棒', requiredSlots: ['interest'] };
    expect(renderRuleTemplate(tiny, { interest: '很' })).toBeNull();
  });

  it('returns null when a slot value smuggles review-blocked vocab (SEC-02 defense-in-depth)', () => {
    expect(renderRuleTemplate(template, { interest: '匹配局' })).toBeNull();
  });

  it('returns null when an undeclared slot marker survives rendering', () => {
    const broken: RuleTemplate = {
      role: 'inference',
      text: '你说过「{answer}」之后大家都记住了你',
      requiredSlots: ['answer'],
    };
    expect(renderRuleTemplate(broken, {})).toBeNull();
  });
});

describe('sanitizeSlotValue', () => {
  it('trims, truncates long answer text, and rejects empty values', () => {
    expect(sanitizeSlotValue('  先观察再加入  ')).toBe('先观察再加入');
    const long = '这是一段非常非常长的回答文本超过了限制';
    const truncated = sanitizeSlotValue(long)!;
    expect(truncated.length).toBeLessThanOrEqual(13); // 12 chars + ellipsis
    expect(truncated.endsWith('…')).toBe(true);
    expect(sanitizeSlotValue('')).toBeUndefined();
    expect(sanitizeSlotValue(null)).toBeUndefined();
    expect(sanitizeSlotValue(undefined)).toBeUndefined();
  });
});
