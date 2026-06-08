import Taro from '@tarojs/taro'
import { formatHSLAsRGBA, type ArchetypeHSL } from '@shared/archetypeColors'
import { logWarn } from './logger'

/**
 * Convert any CSS color string (hsl, hsla, #hex, rgba, rgb) to `rgba()`.
 *
 * WeChat canvas addColorStop silently drops hsl/hsla strings on older
 * base library versions. This normalises every color to rgba so canvas
 * drawing always works. It also prevents the bug where appending hex
 * alpha digits (e.g. `${accentColor}88`) to an hsl string produces
 * invalid `"hsl(25, 48%, 60%)88"`.
 */
export function toCanvasRGBA(color: string, alpha = 1): string {
  const rgbaMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbaMatch) {
    const [, r, g, b] = rgbaMatch
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  const hexMatch = color.match(/^#([0-9a-fA-F]{3,8})$/)
  if (hexMatch) {
    let hex = hexMatch[1]
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  const hslaMatch = color.match(/^hsla?\(\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)%?\s*,\s*(\d+\.?\d*)%?\s*(?:,\s*([\d.]+))?\s*\)/)
  if (hslaMatch) {
    const h = parseFloat(hslaMatch[1])
    const s = parseFloat(hslaMatch[2])
    const l = parseFloat(hslaMatch[3])
    return formatHSLAsRGBA({ h, s, l } as ArchetypeHSL, alpha)
  }
  if (alpha < 1) {
    logWarn('[canvasHelpers] toCanvasRGBA: unknown format, alpha ignored', { color, alpha })
  }
  return color
}

/**
 * Resolve image path with pre-flight validation and timeout.
 * For canvas drawImage, we need a resolved local path via getImageInfo.
 */
export async function resolveImagePath(src: string, timeoutMs = 5000): Promise<string> {
  if (!src) return ''

  const result = await Promise.race([
    Taro.getImageInfo({ src }).then(info => info.path || ''),
    new Promise<string>((resolve) =>
      setTimeout(() => {
        logWarn('[canvasHelpers] resolveImagePath: timeout', { src, timeoutMs })
        resolve('')
      }, timeoutMs)
    ),
  ])

  return result
}

/**
 * Clamp a percentage value to 0–100, rounded.
 */
export function clampPercent(value: number): number {
  return Math.max(0, Math.min(Math.round(value), 100))
}

/**
 * Create a metallic gold linear gradient for borders and stamps.
 */
export function createMetallicGold(ctx: Taro.CanvasContext, x1: number, y1: number, x2: number, y2: number): Taro.CanvasGradient {
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2)
  gradient.addColorStop(0, '#bf953f')
  gradient.addColorStop(0.25, '#fcf6ba')
  gradient.addColorStop(0.5, '#b38728')
  gradient.addColorStop(0.75, '#fbf5b7')
  gradient.addColorStop(1, '#aa771c')
  return gradient
}

/**
 * Draw a rounded rect path (does not fill or stroke).
 */
export function drawRoundedRect(ctx: Taro.CanvasContext, x: number, y: number, width: number, height: number, radius: number): void {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + safeRadius, y)
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius)
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius)
  ctx.arcTo(x, y + height, x, y, safeRadius)
  ctx.arcTo(x, y, x + width, y, safeRadius)
  ctx.closePath()
}

export function fillRoundedRect(ctx: Taro.CanvasContext, x: number, y: number, width: number, height: number, radius: number, fillStyle: string | Taro.CanvasGradient): void {
  ctx.save()
  drawRoundedRect(ctx, x, y, width, height, radius)
  ctx.setFillStyle(fillStyle)
  ctx.fill()
  ctx.restore()
}

export function strokeRoundedRect(ctx: Taro.CanvasContext, x: number, y: number, width: number, height: number, radius: number, strokeStyle: string, lineWidth: number): void {
  ctx.save()
  drawRoundedRect(ctx, x, y, width, height, radius)
  ctx.setStrokeStyle(strokeStyle)
  ctx.setLineWidth(lineWidth)
  ctx.stroke()
  ctx.restore()
}

export function clipRoundedRect(ctx: Taro.CanvasContext, x: number, y: number, width: number, height: number, radius: number): void {
  drawRoundedRect(ctx, x, y, width, height, radius)
  ctx.clip()
}

/**
 * Draw a badge (rounded rect with centered text).
 */
export function drawBadge(ctx: Taro.CanvasContext, options: {
  text: string
  x: number
  y: number
  width: number
  fill: string | Taro.CanvasGradient
  color: string
  fontSize?: number
  radius?: number
  height?: number
}): void {
  const fontSize = options.fontSize ?? 20
  const radius = options.radius ?? (options.height ?? 42) / 2
  const height = options.height ?? 42
  fillRoundedRect(ctx, options.x, options.y, options.width, height, radius, options.fill)
  ctx.save()
  ctx.setFillStyle(options.color)
  ctx.setFontSize(fontSize)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(options.text, options.x + options.width / 2, options.y + height / 2)
  ctx.restore()
}

/**
 * Split text into lines respecting CJK/Latin width differences.
 */
export function splitText(text: string, maxCharsPerLine: number, maxLines = 2): string[] {
  const normalized = text.trim()
  if (!normalized) return []

  const chars = Array.from(normalized)
  const lines: string[] = []
  let currentLine = ''
  let currentWeight = 0

  chars.forEach((char) => {
    const weight = /[A-Za-z0-9]/.test(char) ? 0.72 : 1
    if (currentWeight + weight > maxCharsPerLine && currentLine) {
      lines.push(currentLine)
      currentLine = char
      currentWeight = weight
      return
    }
    currentLine += char
    currentWeight += weight
  })

  if (currentLine) lines.push(currentLine)

  if (lines.length <= maxLines) return lines

  const limited = lines.slice(0, maxLines)
  const lastLine = limited[maxLines - 1] ?? ''
  limited[maxLines - 1] = `${lastLine.slice(0, Math.max(lastLine.length - 1, 1))}…`
  return limited
}

/**
 * Draw a text block with automatic line splitting.
 */
export function drawTextBlock(ctx: Taro.CanvasContext, options: {
  text: string
  x: number
  y: number
  maxCharsPerLine: number
  maxLines?: number
  lineHeight: number
  fontSize: number
  color: string
  align?: 'left' | 'center' | 'right'
}): number {
  const lines = splitText(options.text, options.maxCharsPerLine, options.maxLines)
  ctx.save()
  ctx.setFontSize(options.fontSize)
  ctx.setFillStyle(options.color)
  ctx.setTextAlign(options.align ?? 'left')
  ctx.setTextBaseline('top')
  lines.forEach((line, index) => {
    ctx.fillText(line, options.x, options.y + index * options.lineHeight)
  })
  ctx.restore()
  return lines.length * options.lineHeight
}

/**
 * Export canvas to temp file with DPR-aware retry.
 * Capped at DPR 2 universally for memory safety on
 * mid-range devices (1080×1920 at DPR 3 ≈ 74MB backing store).
 */
export async function exportCanvasWithRetry(
  canvasId: string,
  width: number,
  height: number,
): Promise<string> {
  const dprValues = [2, 1]

  for (let attempt = 0; attempt < dprValues.length; attempt++) {
    const dpr = dprValues[attempt]
    try {
      const output = await Taro.canvasToTempFilePath({
        canvasId,
        x: 0,
        y: 0,
        width,
        height,
        destWidth: Math.round(width * dpr),
        destHeight: Math.round(height * dpr),
        fileType: 'png',
        quality: 1,
      })

      setTimeout(() => {
        try {
          const fs = Taro.getFileSystemManager()
          fs.unlinkSync(output.tempFilePath)
        } catch {}
      }, 60000)

      return output.tempFilePath
    } catch (error) {
      if (attempt === dprValues.length - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  throw new Error('canvasToTempFilePath failed after all DPR fallback attempts')
}