import { describe, expect, it } from 'vitest';
import {
  validateWechatContactId,
  WECHAT_CONTACT_ID_MAX_LENGTH,
} from '../wechatContactId';

describe('validateWechatContactId', () => {
  it('accepts compliant IDs', () => {
    expect(validateWechatContactId('abcde1')).toEqual({ ok: true, value: 'abcde1' });
    expect(validateWechatContactId('JoyJoin_2026')).toEqual({ ok: true, value: 'JoyJoin_2026' });
    expect(validateWechatContactId('a-b_c-2')).toEqual({ ok: true, value: 'a-b_c-2' });
    // 20 chars exactly (letter + 19)
    expect(validateWechatContactId('a1234567890123456789')).toEqual({
      ok: true,
      value: 'a1234567890123456789',
    });
  });

  it('trims surrounding whitespace', () => {
    expect(validateWechatContactId('  abcde1  ')).toEqual({ ok: true, value: 'abcde1' });
  });

  it('rejects digit-first IDs', () => {
    expect(validateWechatContactId('1abcde')).toEqual({ ok: false, reason: 'format' });
  });

  it('rejects too-short and too-long IDs', () => {
    expect(validateWechatContactId('abcde')).toEqual({ ok: false, reason: 'format' });
    expect(validateWechatContactId('a12345678901234567890')).toEqual({
      ok: false,
      reason: 'format',
    });
  });

  it('rejects illegal characters (Chinese, spaces, phone numbers, plus signs)', () => {
    expect(validateWechatContactId('微信号abc')).toEqual({ ok: false, reason: 'format' });
    expect(validateWechatContactId('abc de1')).toEqual({ ok: false, reason: 'format' });
    expect(validateWechatContactId('13800138000')).toEqual({ ok: false, reason: 'format' });
    expect(validateWechatContactId('+8613800138000')).toEqual({ ok: false, reason: 'format' });
  });

  it('rejects wxid_ system identifiers (unsearchable dead IDs), case-insensitively', () => {
    expect(validateWechatContactId('wxid_abc123')).toEqual({ ok: false, reason: 'wxid-prefix' });
    expect(validateWechatContactId('WXID_abc123')).toEqual({ ok: false, reason: 'wxid-prefix' });
    // A user-set ID that merely contains "wxid" later is fine.
    expect(validateWechatContactId('mywxid_2026')).toEqual({ ok: true, value: 'mywxid_2026' });
  });

  it('rejects empty input', () => {
    expect(validateWechatContactId('')).toEqual({ ok: false, reason: 'format' });
    expect(validateWechatContactId('   ')).toEqual({ ok: false, reason: 'format' });
  });

  it('max length constant matches the regex ceiling', () => {
    expect(WECHAT_CONTACT_ID_MAX_LENGTH).toBe(20);
  });
});
