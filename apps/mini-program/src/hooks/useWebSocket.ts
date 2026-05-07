import { useState, useEffect, useCallback, useRef } from 'react'
import { useDidShow, useDidHide } from '@tarojs/taro'
import type { WSMessage, WSEventType } from '@shared/wsEvents'
import {
  getWebSocket,
  type ConnectionState,
} from '../lib/api/websocket'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type WebSocketState = ConnectionState

export interface UseWebSocketOptions {
  /**
   * Auto-connect on mount and disconnect on unmount.
   * @default true
   */
  autoConnect?: boolean

  /**
   * Event types to subscribe to. If omitted, no type-scoped subscriptions
   * are created (you can still use `onMessage` to receive everything).
   */
  eventTypes?: WSEventType[]

  /**
   * When provided together with `eventTypes`, subscriptions are scoped to
   * messages that carry this `eventId` AND one of the given `eventTypes`.
   */
  eventId?: string

  /**
   * Callback invoked for every message that matches the subscription filters.
   * If no `eventTypes` are specified this receives ALL messages.
   */
  onMessage?: (message: WSMessage) => void
}

export interface UseWebSocketResult {
  /** Current connection state */
  state: WebSocketState
  /** Manually open the connection */
  connect: () => void
  /** Manually close the connection */
  disconnect: () => void
  /** Send a JSON-serialisable message to the server */
  send: (message: Record<string, unknown>) => void
  /** The last message received (matching the active subscription) */
  lastMessage: WSMessage | null
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketResult {
  const {
    autoConnect = true,
    eventTypes,
    eventId,
    onMessage,
  } = options

  // -- State ----------------------------------------------------------------
  const [state, setState] = useState<WebSocketState>(() => getWebSocket().getState())
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null)

  // Keep a stable ref to the latest `onMessage` so we never need it in deps
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  // Track whether the socket was connected when the mini-program hid, so we
  // can decide whether to reconnect on `useDidShow`.
  const wasConnectedRef = useRef(false)

  // -- Stable callbacks -----------------------------------------------------

  const connect = useCallback(() => {
    getWebSocket().connect()
  }, [])

  const disconnect = useCallback(() => {
    getWebSocket().disconnect()
  }, [])

  const send = useCallback((message: Record<string, unknown>) => {
    getWebSocket().send(message)
  }, [])

  // -- Connection state tracking --------------------------------------------

  useEffect(() => {
    const ws = getWebSocket()

    // Sync initial state
    setState(ws.getState())

    const unsub = ws.onStateChange((next) => {
      setState(next)
    })

    return unsub
  }, [])

  // -- Auto-connect lifecycle -----------------------------------------------

  useEffect(() => {
    if (!autoConnect) return

    const ws = getWebSocket()
    if (ws.getState() === 'disconnected') {
      ws.connect()
    }

    return () => {
      // Only disconnect on unmount when autoConnect is true.
      // This ensures the socket stays alive for other consumers if the hook is
      // used in multiple places simultaneously – the singleton handles ref
      // counting implicitly (last disconnect wins).
      ws.disconnect()
    }
  }, [autoConnect])

  // -- Mini-program foreground / background ---------------------------------

  useDidShow(() => {
    // Reconnect if we were connected before hiding
    if (wasConnectedRef.current) {
      const ws = getWebSocket()
      if (ws.getState() === 'disconnected') {
        ws.connect()
      }
    }
  })

  useDidHide(() => {
    const ws = getWebSocket()
    const currentState = ws.getState()
    wasConnectedRef.current =
      currentState === 'connected' ||
      currentState === 'connecting' ||
      currentState === 'reconnecting'

    // Disconnect to conserve battery / network when in background.
    // The socket will reconnect automatically via useDidShow when the user
    // returns to the mini-program.
    if (wasConnectedRef.current) {
      ws.disconnect()
    }
  })

  // -- Message subscriptions ------------------------------------------------

  useEffect(() => {
    const ws = getWebSocket()
    const unsubs: Array<() => void> = []

    /**
     * Shared handler: forwards to onMessage ref, updates lastMessage state.
     */
    const handler = (msg: WSMessage) => {
      setLastMessage(msg)
      onMessageRef.current?.(msg)
    }

    if (eventTypes && eventTypes.length > 0) {
      // Subscribe each eventType, optionally scoped by eventId
      for (const eventType of eventTypes) {
        if (eventId) {
          unsubs.push(ws.onEvent(eventId, eventType, handler))
        } else {
          unsubs.push(ws.on(eventType, handler))
        }
      }
    } else {
      // No specific types requested – subscribe globally
      unsubs.push(ws.onAny(handler))
    }

    return () => {
      for (const unsub of unsubs) {
        unsub()
      }
    }
    // We deliberately use a JSON-serialised key for eventTypes so that the
    // effect re-runs only when the actual list contents change, not on every
    // render where a new array reference is passed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, JSON.stringify(eventTypes)])

  // -------------------------------------------------------------------------

  return {
    state,
    connect,
    disconnect,
    send,
    lastMessage,
  }
}
