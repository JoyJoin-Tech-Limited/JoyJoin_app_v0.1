import Taro from '@tarojs/taro'

type LogContext = Record<string, unknown>

const realtimeLogManager =
  typeof Taro.getRealtimeLogManager === 'function'
    ? Taro.getRealtimeLogManager()
    : null

function serializeContext(context?: LogContext): string {
  if (!context) return ''

  try {
    return JSON.stringify(context)
  } catch {
    return '[unserializable-context]'
  }
}

export function logInfo(message: string, context?: LogContext) {
  realtimeLogManager?.info?.(message, serializeContext(context))
}

export function logWarn(message: string, context?: LogContext) {
  realtimeLogManager?.warn?.(message, serializeContext(context))
}

export function logError(message: string, context?: LogContext) {
  realtimeLogManager?.error?.(message, serializeContext(context))
}
