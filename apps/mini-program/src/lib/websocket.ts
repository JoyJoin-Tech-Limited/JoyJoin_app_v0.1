import Taro from '@tarojs/taro'
import type { WSMessage, WSEventType } from '@shared/wsEvents'
import { logInfo, logWarn, logError } from './logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WSListener = (message: WSMessage) => void
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'

type StateChangeListener = (state: ConnectionState) => void

// ---------------------------------------------------------------------------
// MiniProgramWebSocket – headless Taro SocketTask adapter
// ---------------------------------------------------------------------------

export class MiniProgramWebSocket {
  // -- internal state -------------------------------------------------------
  private socketTask: Taro.SocketTask | null = null
  private state: ConnectionState = 'disconnected'
  private stateListeners = new Set<StateChangeListener>()

  // -- listener registries --------------------------------------------------
  /** type-scoped: Map<eventType, Set<listener>> */
  private listeners = new Map<string, Set<WSListener>>()
  /** global listeners that receive every message */
  private globalListeners = new Set<WSListener>()
  /**
   * event-scoped: Map<`${eventId}::${eventType}`, Set<listener>>
   * This allows filtering by both eventId AND eventType efficiently.
   */
  private eventListeners = new Map<string, Set<WSListener>>()

  // -- reconnection ---------------------------------------------------------
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts: number
  private readonly baseReconnectDelay: number
  private readonly maxReconnectDelay = 30_000 // cap at 30 s

  // -- heartbeat ------------------------------------------------------------
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private readonly heartbeatInterval: number

  // -- pending sends --------------------------------------------------------
  /** Messages queued while the socket is still connecting */
  private pendingMessages: string[] = []

  // -- connection URL -------------------------------------------------------
  private readonly url: string

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------
  constructor(
    url: string,
    options?: {
      maxReconnectAttempts?: number
      reconnectDelay?: number
      heartbeatInterval?: number
    },
  ) {
    this.url = url
    this.maxReconnectAttempts = options?.maxReconnectAttempts ?? 5
    this.baseReconnectDelay = options?.reconnectDelay ?? 2_000
    this.heartbeatInterval = options?.heartbeatInterval ?? 30_000
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Open a WebSocket connection via Taro.connectSocket. */
  connect(): void {
    // Avoid duplicate connections
    if (this.state === 'connecting' || this.state === 'connected') {
      logWarn('[WS] connect() called while already connected/connecting', {
        state: this.state,
      })
      return
    }

    this.setState(
      this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting',
    )

    logInfo('[WS] Connecting…', { url: this.url, attempt: this.reconnectAttempts })

    try {
      const task = Taro.connectSocket({
        url: this.url,
        // Taro will invoke the callbacks attached below.
        // Return value is a SocketTask on most mini-program platforms.
        success: () => {
          logInfo('[WS] connectSocket success callback')
        },
        fail: (err) => {
          logError('[WS] connectSocket fail callback', {
            errMsg: (err as any)?.errMsg,
          })
          this.handleError()
        },
      })

      // Taro.connectSocket returns a SocketTask (or PromiseLike wrapping one).
      // Depending on the Taro version, `task` may be a SocketTask directly or
      // wrapped inside a promise-like with `.then()`. We handle both shapes to
      // be safe.
      const bindTask = (socketTask: Taro.SocketTask) => {
        this.socketTask = socketTask

        socketTask.onOpen(() => this.handleOpen())
        socketTask.onMessage((res) => {
          // SocketTask.onMessage passes { data: string | ArrayBuffer }
          const raw = typeof res.data === 'string'
            ? res.data
            : new TextDecoder().decode(res.data as ArrayBuffer)
          this.handleMessage(raw)
        })
        socketTask.onClose(() => this.handleClose())
        socketTask.onError(() => this.handleError())
      }

      // Handle both Promise<SocketTask> and SocketTask returns
      if (task && typeof (task as any).then === 'function') {
        ;(task as any).then((resolved: any) => {
          // Some Taro versions resolve with { socketTask } or the task itself
          const st = resolved?.socketTask ?? resolved
          if (st && typeof st.onOpen === 'function') {
            bindTask(st)
          }
        })
      }
      if (task && typeof (task as any).onOpen === 'function') {
        bindTask(task as unknown as Taro.SocketTask)
      }
    } catch (error) {
      logError('[WS] connectSocket threw', { error: String(error) })
      this.handleError()
    }
  }

  /** Close the socket cleanly and stop all timers. */
  disconnect(): void {
    logInfo('[WS] disconnect() called')

    // Prevent any pending reconnect
    this.clearReconnectTimer()
    this.stopHeartbeat()
    this.reconnectAttempts = 0
    this.pendingMessages = []

    if (this.socketTask) {
      try {
        this.socketTask.close({
          code: 1000,
          reason: 'Client disconnect',
        })
      } catch {
        // Socket may already be closed – ignore
      }
      this.socketTask = null
    }

    this.setState('disconnected')
  }

  // -- Subscriptions --------------------------------------------------------

  /**
   * Subscribe to a specific WSEventType (e.g. `'POOL_MATCHED'`).
   * @returns An unsubscribe function.
   */
  on(eventType: WSEventType | string, listener: WSListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(listener)

    return () => {
      const set = this.listeners.get(eventType)
      if (set) {
        set.delete(listener)
        if (set.size === 0) this.listeners.delete(eventType)
      }
    }
  }

  /**
   * Subscribe to ALL incoming messages regardless of type.
   * @returns An unsubscribe function.
   */
  onAny(listener: WSListener): () => void {
    this.globalListeners.add(listener)
    return () => {
      this.globalListeners.delete(listener)
    }
  }

  /**
   * Subscribe scoped to both an `eventId` AND an `eventType`.
   * Messages must match **both** fields to be delivered.
   * @returns An unsubscribe function.
   */
  onEvent(
    eventId: string,
    eventType: WSEventType | string,
    listener: WSListener,
  ): () => void {
    const key = `${eventId}::${eventType}`
    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, new Set())
    }
    this.eventListeners.get(key)!.add(listener)

    return () => {
      const set = this.eventListeners.get(key)
      if (set) {
        set.delete(listener)
        if (set.size === 0) this.eventListeners.delete(key)
      }
    }
  }

  // -- State ----------------------------------------------------------------

  /** Return the current connection state. */
  getState(): ConnectionState {
    return this.state
  }

  /**
   * Register a listener that fires whenever the connection state changes.
   * @returns An unsubscribe function.
   */
  onStateChange(listener: StateChangeListener): () => void {
    this.stateListeners.add(listener)
    return () => {
      this.stateListeners.delete(listener)
    }
  }

  // -- Send -----------------------------------------------------------------

  /**
   * Send a JSON-serialisable message to the server.
   * Automatically appends a `timestamp` if not present.
   * If the socket is still `connecting`, the message is queued and flushed
   * once the connection opens.
   */
  send(message: Record<string, unknown>): void {
    const payload = JSON.stringify({
      timestamp: new Date().toISOString(),
      ...message,
    })

    if (this.state === 'connected' && this.socketTask) {
      this.doSend(payload)
    } else if (this.state === 'connecting' || this.state === 'reconnecting') {
      // Queue until the socket opens
      this.pendingMessages.push(payload)
    } else {
      logWarn('[WS] send() called while disconnected – message dropped', {
        type: (message as any).type,
      })
    }
  }

  // -------------------------------------------------------------------------
  // Private – message handling
  // -------------------------------------------------------------------------

  private handleMessage(raw: string): void {
    let message: WSMessage
    try {
      message = JSON.parse(raw) as WSMessage
    } catch {
      logWarn('[WS] Failed to parse incoming message', { raw: raw.slice(0, 200) })
      return
    }

    // Silently absorb server PONGs so they don't bubble to listeners
    if (message.type === 'PONG') return

    // 1. Global listeners
    for (const listener of this.globalListeners) {
      try {
        listener(message)
      } catch (err) {
        logError('[WS] Error in global listener', { error: String(err) })
      }
    }

    // 2. Type-scoped listeners
    const typeSet = this.listeners.get(message.type)
    if (typeSet) {
      for (const listener of typeSet) {
        try {
          listener(message)
        } catch (err) {
          logError('[WS] Error in type listener', {
            type: message.type,
            error: String(err),
          })
        }
      }
    }

    // 3. Event-scoped listeners (eventId + eventType)
    if (message.eventId) {
      const key = `${message.eventId}::${message.type}`
      const evtSet = this.eventListeners.get(key)
      if (evtSet) {
        for (const listener of evtSet) {
          try {
            listener(message)
          } catch (err) {
            logError('[WS] Error in event listener', {
              key,
              error: String(err),
            })
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Private – lifecycle handlers
  // -------------------------------------------------------------------------

  private handleOpen(): void {
    logInfo('[WS] Connected')
    this.reconnectAttempts = 0
    this.setState('connected')
    this.startHeartbeat()
    this.flushPendingMessages()
  }

  private handleClose(): void {
    logInfo('[WS] Connection closed')
    this.socketTask = null
    this.stopHeartbeat()

    // Only attempt reconnect if we didn't explicitly disconnect
    if (this.state !== 'disconnected') {
      this.setState('disconnected')
      this.scheduleReconnect()
    }
  }

  private handleError(): void {
    logError('[WS] Socket error')

    // On error the socket will typically also fire `onClose`, but if the
    // connection never opened we need to handle reconnect here as well.
    if (this.state === 'connecting' || this.state === 'reconnecting') {
      this.socketTask = null
      this.stopHeartbeat()
      this.setState('disconnected')
      this.scheduleReconnect()
    }
  }

  // -------------------------------------------------------------------------
  // Private – heartbeat
  // -------------------------------------------------------------------------

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.state === 'connected' && this.socketTask) {
        this.doSend(
          JSON.stringify({
            type: 'PING',
            timestamp: new Date().toISOString(),
          }),
        )
      }
    }, this.heartbeatInterval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // -------------------------------------------------------------------------
  // Private – reconnect
  // -------------------------------------------------------------------------

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logWarn('[WS] Max reconnect attempts reached', {
        attempts: this.reconnectAttempts,
      })
      return
    }

    // Exponential back-off: baseDelay * 2^attempt, capped at maxReconnectDelay
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    )
    logInfo('[WS] Scheduling reconnect', { delay, attempt: this.reconnectAttempts + 1 })

    this.clearReconnectTimer()
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect()
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // -------------------------------------------------------------------------
  // Private – helpers
  // -------------------------------------------------------------------------

  private setState(next: ConnectionState): void {
    if (this.state === next) return
    const prev = this.state
    this.state = next
    logInfo('[WS] State change', { from: prev, to: next })
    for (const listener of this.stateListeners) {
      try {
        listener(next)
      } catch (err) {
        logError('[WS] Error in state listener', { error: String(err) })
      }
    }
  }

  private doSend(payload: string): void {
    try {
      this.socketTask?.send({ data: payload })
    } catch (err) {
      logError('[WS] send failed', { error: String(err) })
    }
  }

  private flushPendingMessages(): void {
    if (this.pendingMessages.length === 0) return
    logInfo('[WS] Flushing pending messages', {
      count: this.pendingMessages.length,
    })
    const queued = this.pendingMessages.splice(0)
    for (const payload of queued) {
      this.doSend(payload)
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let instance: MiniProgramWebSocket | null = null
const DEFAULT_MINI_PROGRAM_WS_BASE_URL = 'http://localhost:5001'

/**
 * Derive the WebSocket URL from `TARO_APP_API_BASE_URL`.
 *
 * Falls back to the same local default as the API transport so pages that use
 * `useWebSocket()` do not crash during render when the env var is omitted in
 * local builds or runtime smoke bundles.
 */
function buildWebSocketUrl(): string {
  const base = (process.env.TARO_APP_API_BASE_URL ?? DEFAULT_MINI_PROGRAM_WS_BASE_URL).replace(/\/$/, '')

  const wsUrl = base
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://')

  return `${wsUrl}/ws`
}

/**
 * Return the singleton `MiniProgramWebSocket` instance.
 * Lazily created on first call using the env-derived URL.
 */
export function getWebSocket(): MiniProgramWebSocket {
  if (!instance) {
    instance = new MiniProgramWebSocket(buildWebSocketUrl())
  }
  return instance
}

/**
 * Tear down the singleton, disconnecting if still open.
 * Useful for logout or app teardown.
 */
export function destroyWebSocket(): void {
  if (instance) {
    instance.disconnect()
    instance = null
  }
}
