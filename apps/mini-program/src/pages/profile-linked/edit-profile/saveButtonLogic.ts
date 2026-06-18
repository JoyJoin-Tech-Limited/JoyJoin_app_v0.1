export interface EditProfileSaveButtonParams {
  isSaving: boolean
  displayName: string
  gender: string
  birthYear: number
  currentCity: string
  bio: string
  originalBio: string
  hasChanges: boolean
  redesignEnabled: boolean
}

/**
 * Determines whether the edit-profile save button should be disabled.
 *
 * Bio is optional: a user who previously had a bio may clear it (pending clear),
 * which counts as a valid save action. A user who never had a bio and leaves the
 * input empty is a no-op and should keep save disabled.
 */
export function isEditProfileSaveDisabled(params: EditProfileSaveButtonParams): boolean {
  const {
    isSaving,
    displayName,
    gender,
    birthYear,
    currentCity,
    bio,
    originalBio,
    hasChanges,
    redesignEnabled,
  } = params

  const trimmedBio = bio.trim()
  const isBioEffectivelyChanged = redesignEnabled && trimmedBio !== originalBio.trim()
  const isPendingClear = redesignEnabled && originalBio.trim().length > 0 && trimmedBio.length === 0
  const isBioOverLimit = redesignEnabled && trimmedBio.length > 100

  return (
    isSaving ||
    !displayName.trim() ||
    !gender ||
    !birthYear ||
    !currentCity.trim() ||
    isBioOverLimit ||
    (!hasChanges && !isBioEffectivelyChanged && !isPendingClear)
  )
}
