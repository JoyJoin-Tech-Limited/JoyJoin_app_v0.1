import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { createCanvas, loadImage } from 'canvas'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sourcePath = path.resolve(__dirname, '../apps/mini-program/assets-source/lovart/mini-program UI:status icons grid/mini-program UI:status icons grid.png')
const baseOut = path.resolve(__dirname, '../apps/mini-program/src/assets/icons')

// 5x5 grid mapping (row, col) -> output tier/name
const grid = [
  // Row 1
  [
    { tier: 'status', name: 'status-alarm-clock', emoji: '⏰' },
    { tier: 'status', name: 'status-megaphone', emoji: '📣' },
    { tier: 'status', name: 'status-bar-chart', emoji: '📊' },
    { tier: 'status', name: 'status-warning', emoji: '⚠️' },
    { tier: 'status', name: 'status-prohibited', emoji: '🚫' },
  ],
  // Row 2
  [
    { tier: 'semantic', name: 'label-cityscape', emoji: '🌆' },
    { tier: 'semantic', name: 'label-map', emoji: '🗺️' },
    { tier: 'semantic', name: 'label-globe-asia', emoji: '🌏' },
    { tier: 'semantic', name: 'label-globe-meridians', emoji: '🌐' },
    { tier: 'semantic', name: 'label-airplane', emoji: '✈️' },
  ],
  // Row 3
  [
    { tier: 'reaction', name: 'reaction-money-bag', emoji: '💰' },
    { tier: 'reaction', name: 'reaction-smirk', emoji: '😏' },
    { tier: 'reaction', name: 'reaction-sunglasses', emoji: '😎' },
    { tier: 'reaction', name: 'reaction-purple-heart', emoji: '💜' },
    { tier: 'reaction', name: 'reaction-sweat', emoji: '😅' },
  ],
  // Row 4
  [
    { tier: 'status', name: 'status-mirror', emoji: '🪞' },
    { tier: 'status', name: 'status-unlocked', emoji: '🔓' },
    { tier: 'status', name: 'status-star', emoji: '🌟' },
    { tier: 'status', name: 'status-close', emoji: '✕' },
    { tier: 'status', name: 'status-check', emoji: '✓' },
  ],
  // Row 5
  [
    { tier: 'reaction', name: 'reaction-devil', emoji: '😈' },
    { tier: 'status', name: 'status-bell', emoji: '🔔' },
    { tier: 'ui', name: 'icon-gift', emoji: '🎁' },
    { tier: 'ui', name: 'icon-search', emoji: '🔍' },
    { tier: 'ui', name: 'icon-memo', emoji: '📝' },
  ],
]

const tierFolder = {
  status: 'status-icons',
  semantic: 'info-labels',
  reaction: 'reaction-icons',
  ui: 'ui',
}

const targetSizes = [96, 192, 288]

async function main() {
  const img = await loadImage(sourcePath)
  const W = img.width
  const H = img.height
  const rows = grid.length
  const cols = grid[0].length

  // Build column / row boundaries (round to nearest pixel, full coverage)
  const xBoundaries = Array.from({ length: cols + 1 }, (_, i) => Math.round((i * W) / cols))
  const yBoundaries = Array.from({ length: rows + 1 }, (_, i) => Math.round((i * H) / rows))

  const report = []
  const verificationCanvas = createCanvas(W, H)
  const vCtx = verificationCanvas.getContext('2d')
  vCtx.drawImage(img, 0, 0)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const meta = grid[r][c]
      const left = xBoundaries[c]
      const right = xBoundaries[c + 1]
      const top = yBoundaries[r]
      const bottom = yBoundaries[r + 1]
      const cellW = right - left
      const cellH = bottom - top

      // Create a temporary canvas for the cell to read pixels
      const cellCanvas = createCanvas(cellW, cellH)
      const cellCtx = cellCanvas.getContext('2d')
      cellCtx.drawImage(img, left, top, cellW, cellH, 0, 0, cellW, cellH)
      const { data } = cellCtx.getImageData(0, 0, cellW, cellH)

      // Find bounding box of non-transparent pixels
      let minX = cellW, minY = cellH, maxX = -1, maxY = -1
      let alphaSumX = 0, alphaSumY = 0, alphaTotal = 0
      for (let y = 0; y < cellH; y++) {
        for (let x = 0; x < cellW; x++) {
          const idx = (y * cellW + x) * 4
          const alpha = data[idx + 3]
          if (alpha > 20) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
            alphaSumX += x * alpha
            alphaSumY += y * alpha
            alphaTotal += alpha
          }
        }
      }

      if (alphaTotal === 0) {
        report.push({ ...meta, row: r, col: c, error: 'empty cell' })
        continue
      }

      const bboxW = maxX - minX + 1
      const bboxH = maxY - minY + 1
      const cx = alphaSumX / alphaTotal
      const cy = alphaSumY / alphaTotal
      const bboxCx = (minX + maxX) / 2
      const bboxCy = (minY + maxY) / 2

      // Square crop centered on centroid, with 12% padding
      let side = Math.max(bboxW, bboxH) * 1.12
      side = Math.min(side, cellW, cellH)
      let cropLeft = Math.round(cx - side / 2)
      let cropTop = Math.round(cy - side / 2)
      // Clip to cell bounds
      if (cropLeft < 0) cropLeft = 0
      if (cropTop < 0) cropTop = 0
      if (cropLeft + side > cellW) cropLeft = Math.round(cellW - side)
      if (cropTop + side > cellH) cropTop = Math.round(cellH - side)
      side = Math.round(side)

      // Crop square from cell
      const cropCanvas = createCanvas(side, side)
      const cropCtx = cropCanvas.getContext('2d')
      cropCtx.drawImage(cellCanvas, cropLeft, cropTop, side, side, 0, 0, side, side)

      // Output to tier folder
      const folder = path.join(baseOut, tierFolder[meta.tier])
      fs.mkdirSync(folder, { recursive: true })

      for (const size of targetSizes) {
        const suffix = size === 96 ? '' : `@${size / 96}x`
        const outPng = path.join(folder, `${meta.name}${suffix}.png`)
        const outWebp = path.join(folder, `${meta.name}${suffix}.webp`)

        const resized = createCanvas(size, size)
        const rCtx = resized.getContext('2d')
        rCtx.imageSmoothingEnabled = true
        rCtx.imageSmoothingQuality = 'high'
        rCtx.drawImage(cropCanvas, 0, 0, size, size)

        const buf = resized.toBuffer('image/png')
        fs.writeFileSync(outPng, buf)

        // Convert PNG to WebP with cwebp
        const quality = size === 96 ? 90 : 85
        execSync(`cwebp -q ${quality} -alpha_q 100 "${outPng}" -o "${outWebp}"`)
        fs.unlinkSync(outPng)
      }

      // Verification overlay on full image
      const vLeft = left + cropLeft
      const vTop = top + cropTop
      vCtx.strokeStyle = 'red'
      vCtx.lineWidth = 2
      vCtx.strokeRect(vLeft, vTop, side, side)
      vCtx.beginPath()
      vCtx.moveTo(vLeft + side / 2, vTop)
      vCtx.lineTo(vLeft + side / 2, vTop + side)
      vCtx.moveTo(vLeft, vTop + side / 2)
      vCtx.lineTo(vLeft + side, vTop + side / 2)
      vCtx.stroke()

      report.push({
        ...meta,
        row: r,
        col: c,
        cell: `${cellW}x${cellH}`,
        bbox: `${bboxW}x${bboxH}`,
        centroidOffset: {
          x: Number((cx - bboxCx).toFixed(2)),
          y: Number((cy - bboxCy).toFixed(2)),
        },
        crop: `${side}x${side}`,
        outputs: targetSizes.map((s) => `${meta.name}${s === 96 ? '' : `@${s / 96}x`}.webp`),
      })
    }
  }

  // Save verification overlay
  const verifPath = path.resolve(__dirname, '../tmp/lovart-grid-crop-verification.png')
  fs.writeFileSync(verifPath, verificationCanvas.toBuffer('image/png'))

  // Save report JSON
  const reportPath = path.resolve(__dirname, '../tmp/lovart-grid-crop-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

  // Console summary
  console.log(`Cropped ${report.filter((r) => !r.error).length}/${rows * cols} icons.`)
  console.log(`Verification overlay saved to: ${verifPath}`)
  console.log(`Report saved to: ${reportPath}`)
  for (const r of report) {
    if (r.error) {
      console.log(`[EMPTY] ${r.emoji} @ row ${r.row}, col ${r.col}`)
    } else {
      const off = r.centroidOffset
      const ok = Math.abs(off.x) <= 4 && Math.abs(off.y) <= 4
      console.log(`${ok ? '✅' : '⚠️'} ${r.emoji} ${r.name} | centroid offset ${off.x},${off.y} | crop ${r.crop}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
