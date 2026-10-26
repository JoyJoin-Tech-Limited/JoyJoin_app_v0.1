import { useCallback, useState } from 'react'
import type { RegisterForPoolResponse } from '@shared/api'

import { getDuoBindingNotice } from '../lib/duo/duoCopy'
import { useResetOnShow } from './useResetOnShow'

export interface UseDuoBindingNoticeOptions {
  inviterDisplayName?: string | null
  /** A landing 404/410 already has its own feedback and clears attribution. */
  duoInviteInvalid: boolean
}

/**
 * Transient explanation derived exclusively from the latest registration
 * response. It never enters storage or a query cache and is cleared on a new
 * submit or whenever this page returns to the top of the WeChat page stack.
 */
export function useDuoBindingNotice(options: UseDuoBindingNoticeOptions) {
  const { inviterDisplayName, duoInviteInvalid } = options
  const [duoBindingNotice, setDuoBindingNotice] = useState<string | null>(null)

  const clearDuoBindingNotice = useCallback(() => setDuoBindingNotice(null), [])
  useResetOnShow(clearDuoBindingNotice)

  const applyDuoBindingResponse = useCallback(
    (response: RegisterForPoolResponse) => {
      const duoBinding = response.duoBinding
      setDuoBindingNotice(
        duoInviteInvalid
          ? null
          : getDuoBindingNotice({
              state: duoBinding?.state,
              reason: duoBinding?.reason,
              inviterDisplayName,
            }),
      )
    },
    [duoInviteInvalid, inviterDisplayName],
  )

  return {
    duoBindingNotice,
    applyDuoBindingResponse,
    clearDuoBindingNotice,
  }
}
