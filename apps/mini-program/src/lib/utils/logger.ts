import Taro from '@tarojs/taro'

type LogContext = Record<string, unknown>

function getRealtimeLogManagerSafely() {
  try {
    return typeof Taro.getRealtimeLogManager === 'function'
      ? Taro.getRealtimeLogManager()
      : null
  } catch {
    // Logging is diagnostic-only. Unsupported or partially initialized WeChat
    // runtimes must never prevent a user action from reaching the API.
    return null
  }
}

const realtimeLogManager = getRealtimeLogManagerSafely()

function serializeContext(context?: LogContext): string {
  if (!context) return ''

  try {
    return JSON.stringify(context)
  } catch {
    return '[unserializable-context]'
  }
}

export function logInfo(message: string, context?: LogContext) {
  try {
    realtimeLogManager?.info?.(message, serializeContext(context))
  } catch {
    // Best-effort only.
  }
}

export function logWarn(message: string, context?: LogContext) {
  try {
    realtimeLogManager?.warn?.(message, serializeContext(context))
  } catch {
    // Best-effort only.
  }
}

export function logError(message: string, context?: LogContext) {
  try {
    realtimeLogManager?.error?.(message, serializeContext(context))
  } catch {
    // Best-effort only.
  }
}
