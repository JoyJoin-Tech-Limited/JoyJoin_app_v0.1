import { describe, expect, it } from 'vitest';
import {
  POOL_INCLUSION_TILES,
  type PoolInclusionTileCopy,
} from '../poolRegistrationInclusionsCopy';
import { getIconMapping } from '../../iconSystem/emojiToIconMap';

/**
 * 费用包含 strip copy contract (PM + commercialization approved 2026-08-31).
 * The four tiles and their copy are LOCKED — a failing assertion here means
 * someone changed approved copy or broke the icon swap contract without
 * copy-owner sign-off.
 */
describe('pool registration inclusions copy (费用包含)', () => {
  it('ships exactly the four locked tiles in order', () => {
    expect(POOL_INCLUSION_TILES.map((t) => t.id)).toEqual([
      'icebreaker_hosting',
      'curated_tablemates',
      'smart_venue',
      'full_refund_guarantee',
    ]);
  });

  it('matches the locked PM-approved copy verbatim', () => {
    const pairs = POOL_INCLUSION_TILES.map((t) => [t.title, t.subtitle]);
    expect(pairs).toEqual([
      ['破冰带玩', '五重玩法可深可浅'],
      ['合拍同桌', '6维偏好精算排桌'],
      ['智能选场', '餐厅酒吧自动安排'],
      ['未成行全退', '平台原因自动退款'],
    ]);
  });

  it('every glyph icon resolves to a proprietary JoyJoinIcon mapping', () => {
    for (const tile of POOL_INCLUSION_TILES) {
      if (tile.icon.kind !== 'glyph') continue;
      const mapping = getIconMapping(tile.icon.emoji, tile.icon.tier);
      expect(
        mapping,
        `no icon mapping for ${tile.id} (${tile.icon.emoji} / ${tile.icon.tier})`,
      ).toBeDefined();
    }
  });

  it('icon swap contract: image entries carry src + alt', () => {
    for (const tile of POOL_INCLUSION_TILES as readonly PoolInclusionTileCopy[]) {
      if (tile.icon.kind === 'image') {
        expect(tile.icon.src).toBeTruthy();
        expect(tile.icon.alt).toBeTruthy();
      }
    }
  });

  it('Lovart art: every tile points at a bundled included-strip webp', () => {
    for (const tile of POOL_INCLUSION_TILES) {
      expect(tile.icon.kind).toBe('image');
      if (tile.icon.kind !== 'image') continue;
      expect(tile.icon.src).toMatch(
        /^\/assets\/icons\/included-strip\/included-[a-z-]+\.webp$/,
      );
      expect(tile.icon.alt).toBe(tile.title);
    }
  });
});
