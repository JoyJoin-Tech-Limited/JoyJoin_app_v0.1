import { describe, expect, it } from 'vitest';
import { validateCraft } from '../lib/writingCraftValidator';

const CONDITION_READING =
  '你在人群里的前半小时，看起来像在等什么。你在等的不是话题，是一个人值不值得你把话递过去。让你松下来的，从来不是人多人少，而是有没有一个人，能让你把一句话说完。';

const INSTRUCTION_READING =
  '你一进来，房间里的人先感觉到的是有人在了。下次试着先别急着开口，去观察一圈，再选一个人接一句。';

const ABSTRACT_READING =
  '你一进来，房间里的人先感觉到的是有人在了。话题断了，你会先补一句。相信你能够在关系里找到属于自己的位置。';

const landingIssues = (issues: string[]) => issues.filter((issue) => issue.includes('结尾'));

describe('writingCraftValidator — landing modes', () => {
  it('accepts a condition landing in analysis (interpretation) mode', () => {
    const diag = validateCraft(CONDITION_READING, 'analysis');

    expect(diag.landingIsConditional).toBe(true);
    expect(diag.landingIsAbstractSummary).toBe(false);
    expect(landingIssues(diag.fixableIssues)).toEqual([]);
  });

  it('rejects a condition landing in action mode', () => {
    const diag = validateCraft(CONDITION_READING, 'narrative');

    expect(landingIssues(diag.fixableIssues)).toContain('结尾缺少可执行的具体动作');
  });

  it('rejects an instruction landing in analysis mode', () => {
    const diag = validateCraft(INSTRUCTION_READING, 'analysis');

    expect(diag.landingIsActionable).toBe(true);
    expect(diag.fixableIssues.join('')).toContain('解读体结尾落在动作指令上');
  });

  it('still rejects abstract summaries in analysis mode', () => {
    const diag = validateCraft(ABSTRACT_READING, 'analysis');

    expect(diag.landingIsAbstractSummary).toBe(true);
    expect(diag.fixableIssues).toContain('结尾为抽象总结，落点不够利落');
  });

  it('keeps the action landing unchanged for non-analysis contexts', () => {
    const diag = validateCraft(INSTRUCTION_READING, 'narrative');

    expect(landingIssues(diag.fixableIssues)).toEqual([]);
  });
});

const VERDICT_READING =
  '你是那种一出现，房间的温度就先升半度的人。你一进来，房间里的人先感觉到的是有人在了。冷场对你不构成威胁。让你舒服的，是有来有回的热，不是只有你一个人在托着场。';

describe('writingCraftValidator — verdict beat', () => {
  it('allows the leading verdict sentence in analysis mode', () => {
    const diag = validateCraft(VERDICT_READING, 'analysis');

    expect(diag.bannedWordsFound.join('')).not.toContain('你是...的人');
  });

  it('still bans a type statement after the leading sentence', () => {
    const diag = validateCraft(`${VERDICT_READING}你是一个善于思考的人。`, 'analysis');

    expect(diag.bannedWordsFound.join('')).toContain('你是...的人');
  });

  it('bans the same verdict sentence outside analysis mode', () => {
    const diag = validateCraft(VERDICT_READING, 'narrative');

    expect(diag.bannedWordsFound.join('')).toContain('你是...的人');
  });
});
