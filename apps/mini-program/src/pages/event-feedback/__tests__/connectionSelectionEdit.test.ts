import { describe, expect, it } from 'vitest'
import {
  buildConnectionSelectionEditRequest,
  buildReplaceSelectionWarning,
  buildSelectionAnticipationLine,
  buildSelectionEditedMetadata,
  buildSelectionUpdatedNotice,
  buildSelectionWindowClosedNotice,
  formatRevealMomentLabel,
  isConnectionSelectionEditable,
  readEditableSelectionIds,
  resolveSelectionEditError,
  resolveSelectionEditMode,
  shouldShowSelectionAnticipation,
} from '../connectionSelectionEdit'

// G0 24h mutual-selection edit surface (2026-11-10). These locks cover the
// three things that must never drift: the server-owned window gate, the exact
// PUT wire body, and the fact that no peer identity ever reaches analytics.

describe('selection edit window gate', () => {
  it('offers editing only while the server says the window is open', () => {
    expect(isConnectionSelectionEditable({ state: 'open' })).toBe(true)
  })

  it('hides the affordance for closed / not_open / legacy / unknown states', () => {
    expect(isConnectionSelectionEditable({ state: 'closed' })).toBe(false)
    expect(isConnectionSelectionEditable({ state: 'not_open' })).toBe(false)
    expect(isConnectionSelectionEditable({ state: 'legacy' })).toBe(false)
    expect(isConnectionSelectionEditable({ state: undefined })).toBe(false)
    expect(isConnectionSelectionEditable(null)).toBe(false)
    expect(isConnectionSelectionEditable(undefined)).toBe(false)
  })
})

describe('PUT /api/events/:eventId/connection-selection request', () => {
  it('matches the server contract exactly (selectedUserIds, not connections)', () => {
    const request = buildConnectionSelectionEditRequest('pool-1', ['peer-a', 'peer-b'])

    expect(request.method).toBe('PUT')
    expect(request.path).toBe('/api/events/pool-1/connection-selection')
    expect(request.data).toEqual({ selectedUserIds: ['peer-a', 'peer-b'] })
    expect(Object.keys(request.data)).toEqual(['selectedUserIds'])
  })

  it('sends an explicit empty array when the viewer clears the selection', () => {
    expect(buildConnectionSelectionEditRequest('pool-1', []).data).toEqual({ selectedUserIds: [] })
  })

  it('URL-encodes the event id like every other write in this flow', () => {
    expect(buildConnectionSelectionEditRequest('a/b', []).path).toBe(
      '/api/events/a%2Fb/connection-selection',
    )
  })

  it('copies the array so later selection mutations cannot rewrite an in-flight body', () => {
    const selection = ['peer-a']
    const request = buildConnectionSelectionEditRequest('pool-1', selection)
    selection.push('peer-b')
    expect(request.data.selectedUserIds).toEqual(['peer-a'])
  })
})

describe('edit error mapping', () => {
  it('treats 409 SELECTION_WINDOW_CLOSED as a read-only return and keeps the server copy', () => {
    const resolved = resolveSelectionEditError({
      data: { code: 'SELECTION_WINDOW_CLOSED', message: '本轮互选已经结束' },
    })

    expect(resolved).toEqual({ message: '本轮互选已经结束', windowClosed: true })
  })

  it('falls back to the shared template when the server sent no copy', () => {
    const resolved = resolveSelectionEditError({ data: { code: 'SELECTION_WINDOW_CLOSED' } })
    expect(resolved.windowClosed).toBe(true)
    expect(resolved.message).toContain('互选')
  })

  it('keeps the user on the step for 400 TOO_MANY_SELECTIONS / INVALID_SELECTION', () => {
    expect(
      resolveSelectionEditError({ data: { code: 'TOO_MANY_SELECTIONS', message: '最多只能选 5 位同桌' } }),
    ).toEqual({ message: '最多只能选 5 位同桌', windowClosed: false })
    expect(resolveSelectionEditError({ data: { code: 'INVALID_SELECTION' } }).windowClosed).toBe(false)
  })

  it('never throws on a transport error or a malformed payload', () => {
    expect(resolveSelectionEditError(new Error('network down')).windowClosed).toBe(false)
    expect(resolveSelectionEditError(undefined).message.length).toBeGreaterThan(0)
  })
})

describe('re-entry edit mode (server now returns the caller own selectedUserIds)', () => {
  // `GET /api/events/:eventId/feedback-state` returns
  // `connectionSelection: { state, selectedCount, selectedUserIds, revealAt }`
  // when mutualSelectionV2Enabled is ON. The IDs are the caller's own
  // selections — never names, never other people's choices.
  const entrySummary = {
    state: 'open',
    selectedCount: 3,
    selectedUserIds: ['peer-a', 'peer-b', 'peer-c'],
    revealAt: '2026-11-11T13:00:00.000Z',
  }

  it('prefills on re-entry when the server sent selectedUserIds', () => {
    expect(resolveSelectionEditMode(entrySummary, false)).toBe('prefilled')
    expect(readEditableSelectionIds(entrySummary)).toEqual(['peer-a', 'peer-b', 'peer-c'])
  })

  it('prefills an empty selection honestly (empty array + count 0)', () => {
    const empty = { state: 'open', selectedCount: 0, selectedUserIds: [] }
    expect(resolveSelectionEditMode(empty, false)).toBe('prefilled')
    expect(readEditableSelectionIds(empty)).toEqual([])
    expect(buildReplaceSelectionWarning(0)).toBeUndefined()
  })

  it('falls back to replace when the payload carried no IDs (legacy/partial)', () => {
    const partial = { state: 'open', selectedCount: 3 }
    expect(resolveSelectionEditMode(partial, false)).toBe('replace')
    expect(readEditableSelectionIds(partial)).toBeNull()
    expect(readEditableSelectionIds({ state: 'open', selectedCount: 3, selectedUserIds: [] })).toEqual([])
  })

  it('treats an empty ID array with a positive count as replace (server withheld IDs)', () => {
    expect(resolveSelectionEditMode({ state: 'open', selectedCount: 3, selectedUserIds: [] }, true)).toBe(
      'replace',
    )
  })

  it('keeps the in-session write authoritative when the payload has no IDs', () => {
    expect(resolveSelectionEditMode({ state: 'open', selectedCount: 3 }, true)).toBe('prefilled')
  })

  it('stays hidden for a closed / not_open / legacy window regardless of IDs', () => {
    expect(resolveSelectionEditMode({ ...entrySummary, state: 'closed' }, false)).toBe('hidden')
    expect(resolveSelectionEditMode({ ...entrySummary, state: 'not_open' }, false)).toBe('hidden')
    expect(resolveSelectionEditMode({ selectedUserIds: ['peer-a'] }, false)).toBe('hidden')
  })

  it('warns that a replace removes unselected peers, without naming any', () => {
    const warning = buildReplaceSelectionWarning(3)
    expect(warning).toContain('3')
    expect(warning).toContain('移除')
    expect(warning).not.toContain('peer-')
  })

  it('stays silent when there is nothing to overwrite', () => {
    expect(buildReplaceSelectionWarning(0)).toBeUndefined()
    expect(buildReplaceSelectionWarning(undefined)).toBeUndefined()
  })

  it('saves the edited selection as a full replace, keyed by IDs only', () => {
    const request = buildConnectionSelectionEditRequest('pool-1', ['peer-x'])
    expect(request.data).toEqual({ selectedUserIds: ['peer-x'] })
    expect(JSON.stringify(request.data)).not.toContain('peer-a')
  })

  it('keeps peer IDs out of the re-entry edit telemetry', () => {
    const metadata = buildSelectionEditedMetadata('pool-1', 1, entrySummary.state)
    expect(JSON.stringify(metadata)).not.toContain('peer-x')
    expect(metadata).toEqual({ eventId: 'pool-1', count: 1, windowState: 'open' })
  })
})

describe('analytics privacy', () => {
  it('carries counts and window state only — no peer identity', () => {
    const metadata = buildSelectionEditedMetadata('pool-1', 2, 'open')

    expect(metadata).toEqual({ eventId: 'pool-1', count: 2, windowState: 'open' })
    expect(Object.keys(metadata).sort()).toEqual(['count', 'eventId', 'windowState'])
    // The peer IDs that produced the edit must not survive into telemetry.
    expect(JSON.stringify(metadata)).not.toContain('peer-')
  })

  it('falls back to a legacy window label instead of inventing a state', () => {
    expect(buildSelectionEditedMetadata('pool-1', 0, undefined).windowState).toBe('legacy')
  })
})

describe('post-save confirmation copy', () => {
  it('uses the server reveal instant in Asia/Shanghai when one was sent', () => {
    expect(formatRevealMomentLabel('2026-11-11T13:00:00.000Z')).toBe('11月11日 21:00')
    expect(buildSelectionUpdatedNotice('2026-11-11T13:00:00.000Z')).toBe(
      '选择已更新。11月11日 21:00 回来看看。',
    )
  })

  it('stays deliberately vague without a reveal instant — never a fake countdown', () => {
    const notice = buildSelectionUpdatedNotice(null)
    expect(notice).toBe('选择已更新。明天回来看看。')
    expect(notice).not.toMatch(/\d{1,2}:\d{2}/)
  })

  it('ignores an unparseable reveal instant', () => {
    expect(formatRevealMomentLabel('not-a-date')).toBe('')
    expect(buildSelectionUpdatedNotice('not-a-date')).toBe('选择已更新。明天回来看看。')
  })
})

describe('revealed-screen reveal promise (UIUX P1, 2026-11-10)', () => {
  it('uses the same server reveal instant as the edit save', () => {
    expect(buildSelectionAnticipationLine('2026-11-11T13:00:00.000Z')).toBe(
      '你选的人，如果也选了你，11月11日 21:00 在连接里见',
    )
  })

  it('never invents a timing when the server sent none', () => {
    const line = buildSelectionAnticipationLine(null)
    expect(line).toBe('你选的人，如果也选了你，互选揭晓后在连接里见')
    // The retired hardcoded promise must not come back, and no clock may leak.
    expect(line).not.toContain('第一时间')
    expect(line).not.toMatch(/\d{1,2}:\d{2}/)
    expect(buildSelectionAnticipationLine('not-a-date')).toBe(line)
  })

  it('hides the anticipation once the window is closed (reveal already settled)', () => {
    expect(shouldShowSelectionAnticipation({ state: 'closed' })).toBe(false)
    expect(shouldShowSelectionAnticipation({ state: 'open' })).toBe(true)
    expect(shouldShowSelectionAnticipation({ state: 'not_open' })).toBe(true)
    // Legacy payloads (no summary at all) keep the pre-G0 line.
    expect(shouldShowSelectionAnticipation(null)).toBe(true)
    expect(shouldShowSelectionAnticipation(undefined)).toBe(true)
    expect(shouldShowSelectionAnticipation({})).toBe(true)
  })

  it('states that a window-closed save did not land, using the server copy', () => {
    expect(buildSelectionWindowClosedNotice('本轮互选已经结束')).toBe(
      '本轮互选已经结束，这次修改没有保存。',
    )
    // No double punctuation, and no empty promise if the copy is missing.
    expect(buildSelectionWindowClosedNotice('本轮互选已经结束。')).toBe(
      '本轮互选已经结束，这次修改没有保存。',
    )
    expect(buildSelectionWindowClosedNotice('')).toBe('本轮互选已经结束，这次修改没有保存。')
    expect(buildSelectionWindowClosedNotice(undefined)).toBe('本轮互选已经结束，这次修改没有保存。')
  })
})
