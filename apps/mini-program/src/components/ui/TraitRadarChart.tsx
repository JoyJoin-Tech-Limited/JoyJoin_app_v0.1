import { Canvas, View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'

interface TraitRadarChartProps {
  /** Six trait values (0–100) in order: 亲和力, 开放性, 责任心, 稳定感, 外向度, 快乐值 */
  values: number[]
  /** Six labels matching the values */
  labels?: string[]
  /** Canvas display size in rpx (default 360) */
  size?: number
  /** Primary accent color for polygon stroke / dots (default #8B5CF6) */
  accentColor?: string
  /** Fill color for polygon (default rgba(139, 92, 246, 0.15)) */
  fillColor?: string
  /** Grid line color (default rgba(139, 92, 246, 0.12)) */
  gridColor?: string
}

const DEFAULT_LABELS = ['亲和力', '开放性', '责任心', '稳定感', '外向度', '快乐值']

/**
 * TraitRadarChart — RPG-style hexagonal radar chart (六维图).
 *
 * Renders a canvas-based 6-axis polygon chart with concentric hexagon grids,
 * ideal for personality trait visualization on the result page.
 *
 * Taro notes:
 * - Uses Canvas 2D API (WeChat base lib ≥2.9.0).
 * - Falls back to a simple stat grid if canvas init fails.
 */
export default function TraitRadarChart({
  values,
  labels = DEFAULT_LABELS,
  size = 360,
  accentColor = '#8B5CF6',
  fillColor,
  gridColor = 'rgba(139, 92, 246, 0.12)',
}: TraitRadarChartProps) {
  const canvasIdRef = useRef(`radar-${Math.random().toString(36).slice(2, 9)}`)
  const canvasId = canvasIdRef.current
  const [canvasError, setCanvasError] = useState(false)
  const mountedRef = useRef(true)

  const resolvedFillColor = fillColor || 'rgba(139, 92, 246, 0.15)'

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      drawChart()
    }, 50)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.join(','), accentColor, resolvedFillColor, gridColor, size])

  const drawChart = () => {
    try {
      const sysInfo = Taro.getSystemInfoSync()
      const dpr = sysInfo.pixelRatio || 2
      const winWidth = sysInfo.windowWidth || 375

      const query = Taro.createSelectorQuery()
      query
        .select(`#${canvasId}`)
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!mountedRef.current) return
          if (!res?.[0]?.node) {
            setCanvasError(true)
            return
          }
          const canvas = res[0].node as any
          const ctx = canvas.getContext('2d') as any
          if (!ctx) {
            setCanvasError(true)
            return
          }

          const cssSize = size
          const pxSize = cssSize * (winWidth / 750)
          canvas.width = Math.floor(pxSize * dpr)
          canvas.height = Math.floor(pxSize * dpr)
          ctx.scale(dpr, dpr)

          const W = pxSize
          const H = pxSize
          const cx = W / 2
          const cy = H / 2
          // Leave generous margin so labels don't clip
          const maxRadius = pxSize * 0.26
          const labelRadius = maxRadius + pxSize * 0.10
          const levels = 5

          ctx.clearRect(0, 0, W, H)

          // Helper: get point for axis i at radius r
          const getPoint = (i: number, r: number) => {
            const angle = (Math.PI * 2 / 6) * i - Math.PI / 2
            return {
              x: cx + r * Math.cos(angle),
              y: cy + r * Math.sin(angle),
            }
          }

          // ── Draw concentric hexagon grids ──
          ctx.strokeStyle = gridColor
          ctx.lineWidth = 1
          for (let level = 1; level <= levels; level++) {
            const radius = (maxRadius / levels) * level
            ctx.beginPath()
            for (let i = 0; i < 6; i++) {
              const p = getPoint(i, radius)
              if (i === 0) ctx.moveTo(p.x, p.y)
              else ctx.lineTo(p.x, p.y)
            }
            ctx.closePath()
            ctx.stroke()
          }

          // ── Draw axis lines ──
          ctx.beginPath()
          for (let i = 0; i < 6; i++) {
            const p = getPoint(i, maxRadius)
            ctx.moveTo(cx, cy)
            ctx.lineTo(p.x, p.y)
          }
          ctx.stroke()

          // ── Draw data polygon ──
          ctx.beginPath()
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i - Math.PI / 2
            const value = Math.min(100, Math.max(0, values[i] || 0))
            const radius = (value / 100) * maxRadius
            const x = cx + radius * Math.cos(angle)
            const y = cy + radius * Math.sin(angle)
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.closePath()
          ctx.fillStyle = resolvedFillColor
          ctx.fill()
          ctx.strokeStyle = accentColor
          ctx.lineWidth = 2.5
          ctx.lineJoin = 'round'
          ctx.stroke()

          // ── Draw vertex dots ──
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i - Math.PI / 2
            const value = Math.min(100, Math.max(0, values[i] || 0))
            const radius = (value / 100) * maxRadius
            const x = cx + radius * Math.cos(angle)
            const y = cy + radius * Math.sin(angle)
            ctx.beginPath()
            ctx.arc(x, y, 3.5, 0, Math.PI * 2)
            ctx.fillStyle = accentColor
            ctx.fill()
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 2
            ctx.stroke()
          }

          // ── Draw labels ──
          const fontSize = Math.max(9, pxSize * 0.06)
          ctx.font = `bold ${fontSize}px PingFang SC, -apple-system, sans-serif`
          ctx.fillStyle = '#4b5563'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i - Math.PI / 2
            const x = cx + labelRadius * Math.cos(angle)
            const y = cy + labelRadius * Math.sin(angle)
            ctx.fillText(labels[i] || '', x, y)
          }
        })
    } catch {
      if (mountedRef.current) {
        setCanvasError(true)
      }
    }
  }

  // ── Fallback: simple 2×3 stat grid if canvas fails ──
  if (canvasError) {
    return (
      <View
        className='trait-radar-fallback'
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16rpx',
          width: `${size}rpx`,
          padding: '24rpx',
        }}
      >
        {values.map((v, i) => (
          <View
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8rpx',
              padding: '16rpx 8rpx',
              borderRadius: '16rpx',
              background: 'rgba(139, 92, 246, 0.06)',
            }}
          >
            <Text style={{ fontSize: '22rpx', color: '#6b7280', fontWeight: 600 }}>
              {labels[i]}
            </Text>
            <Text style={{ fontSize: '32rpx', color: accentColor, fontWeight: 900 }}>
              {Math.round(v)}
            </Text>
          </View>
        ))}
      </View>
    )
  }

  return (
    <Canvas
      type='2d'
      id={canvasId}
      style={{ width: `${size}rpx`, height: `${size}rpx` }}
    />
  )
}
