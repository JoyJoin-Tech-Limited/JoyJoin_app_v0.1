import { describe, expect, it } from 'vitest'
import { findAdoptedQuipChip, resolveQuipChipTapAction } from '../viewModels/quipChipModel'
import { pickQuipInspirationChips } from '@shared/copy/quipInspirationChips'

// P2 #6 (2026-10-20, spec 规格二 §4/§5) — chip tap 填入决策与 adopted 判定。

describe('resolveQuipChipTapAction', () => {
  const chips = pickQuipInspirationChips('sess-1', 'prompt-1', 'user-1')

  it('fills directly when the box is empty (incl. whitespace-only)', () => {
    expect(resolveQuipChipTapAction('', chips)).toBe('fill')
    expect(resolveQuipChipTapAction('   ', chips)).toBe('fill')
  })

  it('replaces directly when the current value is exactly one of this prompt’s chips', () => {
    expect(resolveQuipChipTapAction(chips[0].text, chips)).toBe('fill')
    expect(resolveQuipChipTapAction(chips[2].text, chips)).toBe('fill')
  })

  it('asks for confirmation when the current value is hand-typed', () => {
    expect(resolveQuipChipTapAction('我自己写的一句神回复', chips)).toBe('confirm-replace')
    // A chip text that was edited afterwards is hand-typed content again.
    expect(resolveQuipChipTapAction(`${chips[0].text}，加长版`, chips)).toBe('confirm-replace')
  })

  it('does not treat another prompt’s chip text as replaceable content here', () => {
    const other = pickQuipInspirationChips('sess-1', 'prompt-2', 'user-1')
    const foreign = other.find((chip) => !chips.some((c) => c.id === chip.id))
    if (!foreign) return // subsets identical — nothing to prove
    expect(resolveQuipChipTapAction(foreign.text, chips)).toBe('confirm-replace')
  })
})

describe('findAdoptedQuipChip', () => {
  it('returns the chip whose original text prefixes the submitted answer', () => {
    const chips = pickQuipInspirationChips('sess-9', 'prompt-7', 'user-3')
    const adopted = findAdoptedQuipChip('sess-9', 'prompt-7', 'user-3', `${chips[1].text}真的发生了`)
    expect(adopted?.id).toBe(chips[1].id)
  })

  it('counts an exact chip-text submit as adopted', () => {
    const chips = pickQuipInspirationChips('sess-9', 'prompt-7', 'user-3')
    const adopted = findAdoptedQuipChip('sess-9', 'prompt-7', 'user-3', chips[0].text)
    expect(adopted?.id).toBe(chips[0].id)
  })

  it('returns null for hand-typed answers and empty input', () => {
    expect(findAdoptedQuipChip('sess-9', 'prompt-7', 'user-3', '全手打，没有任何起手式')).toBeNull()
    expect(findAdoptedQuipChip('sess-9', 'prompt-7', 'user-3', '')).toBeNull()
  })

  it('is seed-stable: a different user/prompt/session sees a different verdict set', () => {
    const chips = pickQuipInspirationChips('sess-9', 'prompt-7', 'user-3')
    const answer = `${chips[0].text}的后续`
    expect(findAdoptedQuipChip('sess-9', 'prompt-7', 'user-3', answer)?.id).toBe(chips[0].id)
    // Another table-mate with a different subset must not inherit this verdict
    // (unless their subset coincidentally carries the same chip).
    const mateChips = pickQuipInspirationChips('sess-9', 'prompt-7', 'user-4')
    const mateVerdict = findAdoptedQuipChip('sess-9', 'prompt-7', 'user-4', answer)
    if (mateChips.some((c) => c.id === chips[0].id)) {
      expect(mateVerdict?.id).toBe(chips[0].id)
    } else {
      expect(mateVerdict).toBeNull()
    }
  })

  it('fails closed on missing identifiers', () => {
    expect(findAdoptedQuipChip('', 'prompt-7', 'user-3', 'x')).toBeNull()
    expect(findAdoptedQuipChip('sess-9', '', 'user-3', 'x')).toBeNull()
    expect(findAdoptedQuipChip('sess-9', 'prompt-7', '', 'x')).toBeNull()
  })
})
