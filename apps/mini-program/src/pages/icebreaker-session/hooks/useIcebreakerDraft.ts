import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ICEBREAKER_DRAFT_DEBOUNCE_MS,
  clearIcebreakerDraft,
  readIcebreakerDraft,
  writeIcebreakerDraft,
} from '../viewModels/draftPersistence'

export interface IcebreakerDraftHandle {
  /** Synchronous one-shot restore — call inside a useState initializer. */
  readDraft: () => string | null
  /** Latest-wins debounced write (≤ ICEBREAKER_DRAFT_DEBOUNCE_MS). */
  writeDraftDebounced: (serialized: string) => void
  /** Cancel any pending write and remove the stored draft. */
  clearDraft: () => void
}

/**
 * P0 E1 (2026-10-20): per-(session, phase, user) draft handle.
 *
 * Unmount semantics: the phase views live under the phase shell's
 * `key={phase}`, so unmount == phase switch (WeChat page-hide does NOT
 * unmount) — the cleanup cancels the pending write and drops the stored
 * draft, which is the spec's "phase 切换清理". An app kill runs no cleanup,
 * so the draft survives and restores on re-entry.
 */
export function useIcebreakerDraft(draftKey: string | null): IcebreakerDraftHandle {
  const keyRef = useRef(draftKey)
  keyRef.current = draftKey
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = undefined
    }
  }, [])

  const readDraft = useCallback((): string | null => {
    const key = keyRef.current
    return key ? readIcebreakerDraft(key) : null
  }, [])

  const writeDraftDebounced = useCallback(
    (serialized: string) => {
      const key = keyRef.current
      if (!key) return
      cancelPending()
      timerRef.current = setTimeout(() => {
        timerRef.current = undefined
        writeIcebreakerDraft(key, serialized)
      }, ICEBREAKER_DRAFT_DEBOUNCE_MS)
    },
    [cancelPending],
  )

  const clearDraft = useCallback(() => {
    cancelPending()
    const key = keyRef.current
    if (key) clearIcebreakerDraft(key)
  }, [cancelPending])

  // Phase switch (unmount) or key change: cancel the pending write and drop
  // the stored draft — it is meaningless once the table has moved on. The
  // closure captures THIS effect's key, so a key change clears the old key.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = undefined
      }
      if (draftKey) clearIcebreakerDraft(draftKey)
    }
  }, [draftKey])

  return useMemo(
    () => ({ readDraft, writeDraftDebounced, clearDraft }),
    [readDraft, writeDraftDebounced, clearDraft],
  )
}
