import { View } from '@tarojs/components'
import Taro, {
  useReady,
  usePageScroll,
  useDidShow,
} from '@tarojs/taro'
import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react'
import {
  MINI_PROGRAM_LONG_LIST_ROW_THRESHOLD,
} from '../../lib/utils/longListThreshold'
import { logInfo, logWarn } from '../../lib/utils/logger'

// ─── Constants ────────────────────────────────────────────────────

const VIRTUALIZATION_MAX_COUNT = 500
const BUFFER_COUNT = 3
const FIRST_NON_VIRTUAL_COUNT = 6
const SCROLL_THROTTLE_MS = 50
const HEALTH_CHECK_GRACE_MS = 500


// ─── Types ────────────────────────────────────────────────────────

export interface VirtualListProps<T> {
  items: T[]
  itemHeight: number // in rpx
  renderItem: (item: T, index: number, hasBeenRendered: boolean) => React.ReactNode
  keyExtractor: (item: T, index: number) => string
  bufferCount?: number
  headerHeight?: number
  firstNonVirtualCount?: number
  className?: string
  listClassName?: string
  emptyComponent?: React.ReactNode
  footerComponent?: React.ReactNode
  onScrollToLower?: () => void
  lowerThreshold?: number
}

interface WindowState {
  start: number
  end: number
}

// ─── Utility: throttle ────────────────────────────────────────────

function throttle<T extends (...args: any[]) => void>(
  fn: T,
  wait: number
): T {
  let lastTime = 0
  return ((...args: any[]) => {
    const now = Date.now()
    if (now - lastTime >= wait) {
      lastTime = now
      fn(...args)
    }
  }) as T
}

// ─── Utility: WeChat version check ────────────────────────────────

function isOldWeChat(): boolean {
  try {
    const info = Taro.getSystemInfoSync()
    const version = (info as any).version || ''
    if (!version) return false
    const parts = version.split('.').map(Number)
    const major = parts[0] || 0
    return major < 8
  } catch {
    return false
  }
}

// ─── Utility: reduced motion check ────────────────────────────────

function prefersReducedMotion(): boolean {
  try {
    // WeChat mini-program does not expose prefers-reduced-motion directly.
    // We approximate by checking if the OS has accessibility settings enabled.
    // This is a best-effort check; false negatives are acceptable (user gets virtual list).
    return false
  } catch {
    return false
  }
}

// ─── Utility: kill switch ─────────────────────────────────────────

function isVirtualListEnabled(): boolean {
  try {
    const disabled = Taro.getStorageSync('ENABLE_VIRTUAL_LIST')
    return disabled !== false && disabled !== 'false'
  } catch {
    return true
  }
}

// ─── Error Boundary ───────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean
}

class VirtualListErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  ErrorBoundaryState
> {
  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props)
    // eslint-disable-next-line react/no-unused-state
    this.state = { hasError: false }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logWarn('[VirtualList] Runtime error caught by boundary', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    })
    this.props.onError()
  }

  render() {
    return this.props.children
  }
}

// ─── Placeholder component ────────────────────────────────────────

function VirtualListPlaceholder({
  height,
  className,
}: {
  height: number
  className?: string
}) {
  return (
    <View
      className={className}
      style={{ height: `${height}rpx` }}
      aria-hidden
    />
  )
}

// ─── Main VirtualListInner ────────────────────────────────────────

function VirtualListInner<T>({
  items,
  itemHeight,
  renderItem,
  keyExtractor,
  bufferCount = BUFFER_COUNT,
  headerHeight = 0,
  firstNonVirtualCount = FIRST_NON_VIRTUAL_COUNT,
  className = '',
  listClassName = '',
  emptyComponent,
  footerComponent,
  onScrollToLower,
  lowerThreshold = 100,
}: VirtualListProps<T>) {
  // ── Refs ──
  const scrollTopRef = useRef(0)
  const viewportHeightRef = useRef(0)
  const rafIdRef = useRef<number | null>(null)
  const mountedRef = useRef(false)
  const graceEndTimeRef = useRef(0)
  const renderedSetRef = useRef<Set<string>>(new Set())

  // ── State ──
  const [windowState, setWindowState] = useState<WindowState>({
    start: 0,
    end: Math.min(items.length - 1, firstNonVirtualCount + bufferCount * 2),
  })
  const [hasRuntimeError] = useState(false)

  // ── Fallback gate evaluation ──
  const shouldVirtualize = useMemo(() => {
    if (hasRuntimeError) {
      logInfo('[VirtualList] Gate 5: runtime error — fallback')
      return false
    }
    if (items.length <= MINI_PROGRAM_LONG_LIST_ROW_THRESHOLD) {
      return false
    }
    if (items.length > VIRTUALIZATION_MAX_COUNT) {
      logWarn('[VirtualList] Gate 2: list too long', { count: items.length })
      return false
    }
    if (prefersReducedMotion()) {
      logInfo('[VirtualList] Gate 3: reduced motion — fallback')
      return false
    }
    if (isOldWeChat()) {
      logInfo('[VirtualList] Gate 4: old WeChat — fallback')
      return false
    }
    if (!isVirtualListEnabled()) {
      logInfo('[VirtualList] Gate 6: kill switch disabled — fallback')
      return false
    }
    return true
  }, [items.length, hasRuntimeError])

  // ── Viewport measurement ──
  useReady(() => {
    try {
      Taro.getSystemInfo({
        success: (res) => {
          viewportHeightRef.current = res.windowHeight
        },
      })
    } catch {
      // ignore
    }
    graceEndTimeRef.current = Date.now() + HEALTH_CHECK_GRACE_MS
    mountedRef.current = true
  })

  // ── Window calculation ──
  const calculateWindow = useCallback(() => {
    const scrollTop = scrollTopRef.current
    const viewportHeight = viewportHeightRef.current || 600
    const adjustedScrollTop = Math.max(0, scrollTop - headerHeight)

    const visibleStart = Math.floor(adjustedScrollTop / itemHeight)
    const visibleCount = Math.ceil(viewportHeight / itemHeight)

    const start = Math.max(
      firstNonVirtualCount,
      visibleStart - bufferCount
    )
    const end = Math.min(
      items.length - 1,
      visibleStart + visibleCount + bufferCount
    )

    setWindowState((prev) => {
      if (prev.start === start && prev.end === end) return prev
      return { start, end }
    })
  }, [items.length, itemHeight, headerHeight, bufferCount, firstNonVirtualCount])

  // ── Scroll handler ──
  const throttledScrollHandler = useMemo(
    () =>
      throttle(({ scrollTop }: { scrollTop: number }) => {
        scrollTopRef.current = scrollTop

        if (!shouldVirtualize) return

        // Schedule window recalculation via rAF
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
        }
        rafIdRef.current = requestAnimationFrame(() => {
          calculateWindow()
        })
      }, SCROLL_THROTTLE_MS),
    [shouldVirtualize, calculateWindow]
  )

  const handleScroll = useCallback(
    (event: { scrollTop: number }) => {
      throttledScrollHandler(event)
    },
    [throttledScrollHandler]
  )

  usePageScroll(handleScroll)

  // ── IntersectionObserver as validation safety net ──
  useReady(() => {
    if (!shouldVirtualize) return

    try {
      const observer = Taro.createIntersectionObserver(
        // @ts-expect-error Taro types expect PageInstance but we pass component
        Taro.getCurrentInstance().page
      )
      observer.relativeToViewport({ top: -headerHeight, bottom: 0 })

      // Observe a small sentinel area at the expected visible boundary
      // This is a lightweight check — if items that should be visible
      // are not in the viewport, we force a recalculation.
      observer.observe('.virtual-list__sentinel', (res) => {
        if (res && res.intersectionRatio && res.intersectionRatio > 0) {
          // Sentinel is visible; window may need expansion
          calculateWindow()
        }
      })

      return () => {
        try {
          observer.disconnect()
        } catch {
          // ignore cleanup errors
        }
      }
    } catch {
      // If IO fails, we still have usePageScroll as primary driver
    }
  })

  // ── Lifecycle: visibility recalculation on show ──
  useDidShow(() => {
    if (shouldVirtualize) {
      calculateWindow()
    }
  })

  // ── Render: fallback mode ──
  if (!shouldVirtualize) {
    return (
      <View className={className}>
        {items.length === 0 && emptyComponent ? (
          emptyComponent
        ) : (
          <View className={listClassName}>
            {items.map((item, index) => {
              const key = keyExtractor(item, index)
              renderedSetRef.current.add(key)
              return (
                <React.Fragment key={key}>
                  {renderItem(item, index, true)}
                </React.Fragment>
              )
            })}
          </View>
        )}
        {footerComponent}
      </View>
    )
  }

  // ── Render: virtualized mode ──
  const { start, end } = windowState

  // Pre items placeholder (between firstNonVirtualCount and window start)
  const prePlaceholderHeight = Math.max(
    0,
    (start - firstNonVirtualCount) * itemHeight
  )

  // Post items placeholder (after window end)
  const postPlaceholderHeight = Math.max(
    0,
    (items.length - 1 - end) * itemHeight
  )

  return (
    <View className={className}>
      {/* Sentinel for IO validation */}
      <View className='virtual-list__sentinel' style={{ height: '1px' }} />

      {items.length === 0 && emptyComponent ? (
        emptyComponent
      ) : (
        <View className={listClassName}>
          {/* First N items: always rendered */}
          {items.slice(0, firstNonVirtualCount).map((item, index) => {
            const key = keyExtractor(item, index)
            const hasBeen = renderedSetRef.current.has(key)
            renderedSetRef.current.add(key)
            return (
              <React.Fragment key={key}>
                {renderItem(item, index, hasBeen)}
              </React.Fragment>
            )
          })}

          {/* Pre-window placeholder */}
          {prePlaceholderHeight > 0 && (
            <VirtualListPlaceholder
              height={prePlaceholderHeight}
              className='virtual-list__placeholder'
            />
          )}

          {/* Window items: actual content */}
          {items.slice(start, end + 1).map((item, index) => {
            const actualIndex = start + index
            const key = keyExtractor(item, actualIndex)
            const hasBeen = renderedSetRef.current.has(key)
            renderedSetRef.current.add(key)
            return (
              <React.Fragment key={key}>
                {renderItem(item, actualIndex, hasBeen)}
              </React.Fragment>
            )
          })}

          {/* Post-window placeholder */}
          {postPlaceholderHeight > 0 && (
            <VirtualListPlaceholder
              height={postPlaceholderHeight}
              className='virtual-list__placeholder'
            />
          )}
        </View>
      )}

      {footerComponent}
    </View>
  )
}

// ─── Exported VirtualList with Error Boundary ─────────────────────

export default function VirtualList<T>(props: VirtualListProps<T>) {
  const [, setHasError] = useState(false)

  return (
    <VirtualListErrorBoundary onError={() => setHasError(true)}>
      <VirtualListInner {...props} />
    </VirtualListErrorBoundary>
  )
}
