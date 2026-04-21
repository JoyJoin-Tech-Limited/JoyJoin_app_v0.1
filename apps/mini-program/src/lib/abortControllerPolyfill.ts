type AbortListener = (event: { type: "abort" }) => void

class MiniProgramAbortSignal {
  aborted = false
  reason: unknown = undefined
  onabort: AbortListener | null = null
  private listeners = new Set<AbortListener>()

  addEventListener(type: string, listener: AbortListener | null) {
    if (type === "abort" && listener) {
      this.listeners.add(listener)
    }
  }

  removeEventListener(type: string, listener: AbortListener | null) {
    if (type === "abort" && listener) {
      this.listeners.delete(listener)
    }
  }

  dispatchEvent(event?: { type?: string }) {
    if (event?.type !== "abort") {
      return true
    }

    const abortEvent = { type: "abort" as const }
    for (const listener of this.listeners) {
      listener(abortEvent)
    }
    this.onabort?.(abortEvent)
    return true
  }

  throwIfAborted() {
    if (!this.aborted) {
      return
    }

    throw this.reason instanceof Error ? this.reason : new Error("This operation was aborted")
  }
}

class MiniProgramAbortController {
  readonly signal = new MiniProgramAbortSignal()

  abort(reason?: unknown) {
    if (this.signal.aborted) {
      return
    }

    this.signal.aborted = true
    this.signal.reason = reason
    this.signal.dispatchEvent({ type: "abort" })
  }
}

type MiniProgramGlobal = {
  AbortSignal?: any
  AbortController?: any
}

const miniProgramGlobal = globalThis as MiniProgramGlobal

export function ensureMiniProgramAbortController() {
  if (typeof miniProgramGlobal.AbortSignal === "undefined") {
    miniProgramGlobal.AbortSignal = MiniProgramAbortSignal
  }

  if (typeof miniProgramGlobal.AbortController === "undefined") {
    miniProgramGlobal.AbortController = MiniProgramAbortController
  }
}

ensureMiniProgramAbortController()
