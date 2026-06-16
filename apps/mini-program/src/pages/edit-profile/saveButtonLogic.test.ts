import { describe, expect, it } from 'vitest'
import { isEditProfileSaveDisabled } from './saveButtonLogic'

const baseParams = {
  isSaving: false,
  displayName: '悦仔',
  gender: '男性',
  birthYear: 1995,
  currentCity: '深圳',
  bio: '',
  originalBio: '',
  hasChanges: false,
  redesignEnabled: true,
}

describe('isEditProfileSaveDisabled', () => {
  it('disables save when there are no changes and bio was always empty', () => {
    expect(isEditProfileSaveDisabled(baseParams)).toBe(true)
  })

  it('enables save when the user clears a previously existing bio', () => {
    expect(
      isEditProfileSaveDisabled({
        ...baseParams,
        bio: '',
        originalBio: ' previously had a bio ',
        hasChanges: true,
      }),
    ).toBe(false)
  })

  it('enables save when the user trims a previously existing bio to whitespace', () => {
    expect(
      isEditProfileSaveDisabled({
        ...baseParams,
        bio: '   ',
        originalBio: 'previously had a bio',
        hasChanges: true,
      }),
    ).toBe(false)
  })

  it('honours hasChanges for non-bio edits even when bio remains empty', () => {
    expect(
      isEditProfileSaveDisabled({
        ...baseParams,
        bio: '',
        originalBio: '',
        hasChanges: true,
      }),
    ).toBe(false)
  })

  it('enables save when a never-bio user types a bio', () => {
    expect(
      isEditProfileSaveDisabled({
        ...baseParams,
        bio: 'new bio',
        originalBio: '',
        hasChanges: true,
      }),
    ).toBe(false)
  })

  it('enables save when a user edits an existing bio', () => {
    expect(
      isEditProfileSaveDisabled({
        ...baseParams,
        bio: 'updated bio',
        originalBio: 'original bio',
        hasChanges: true,
      }),
    ).toBe(false)
  })

  it('disables save when bio exceeds 100 characters', () => {
    expect(
      isEditProfileSaveDisabled({
        ...baseParams,
        bio: 'a'.repeat(101),
        originalBio: '',
        hasChanges: true,
      }),
    ).toBe(true)
  })

  it('allows save when bio is exactly 100 characters', () => {
    expect(
      isEditProfileSaveDisabled({
        ...baseParams,
        bio: 'a'.repeat(100),
        originalBio: '',
        hasChanges: true,
      }),
    ).toBe(false)
  })

  it('disables save while a save is in flight', () => {
    expect(
      isEditProfileSaveDisabled({
        ...baseParams,
        isSaving: true,
        bio: 'new bio',
        hasChanges: true,
      }),
    ).toBe(true)
  })

  it('disables save when required fields are missing regardless of bio changes', () => {
    expect(
      isEditProfileSaveDisabled({
        ...baseParams,
        displayName: '',
        bio: 'new bio',
        originalBio: '',
        hasChanges: true,
      }),
    ).toBe(true)
  })

  it('ignores bio rules when redesign is disabled', () => {
    expect(
      isEditProfileSaveDisabled({
        ...baseParams,
        redesignEnabled: false,
        bio: 'a'.repeat(200),
        originalBio: '',
        hasChanges: false,
      }),
    ).toBe(true)
  })

  it('enables save for other field changes when bio is unchanged and empty', () => {
    expect(
      isEditProfileSaveDisabled({
        ...baseParams,
        currentCity: '上海',
        hasChanges: true,
      }),
    ).toBe(false)
  })
})
