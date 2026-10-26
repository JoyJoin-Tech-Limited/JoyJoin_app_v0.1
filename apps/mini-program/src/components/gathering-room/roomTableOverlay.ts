/**
 * Foreground table layer extracted from `room-composite-v2.webp`.
 *
 * The room art is a single flat image, so every seat used to paint on top of
 * the table surface — the back-centre seat visibly "stood on" the tablecloth.
 * This overlay repeats only the table pixels and is stacked between the back
 * row and the front row, so a seated avatar is genuinely occluded by furniture
 * instead of floating above it.
 *
 * The numbers are design-space (750 x 960) facts copied from the generated
 * asset. `roomTableOverlay.test.ts` keeps them inside the scene and catches an
 * accidental replacement with a full-scene rectangle.
 */
export const ROOM_TABLE_OVERLAY = {
  path: '/pages/gathering-room/assets/room-table-overlay.webp',
  designBox: { x: 60, y: 330, width: 530, height: 360 },
  scene: { width: 750, height: 960 },
  /** Share of pixels with alpha > 0. Partial alpha counts once. */
  alphaCoverage: 0.72990566,
} as const

const toPercent = (value: number, total: number): string =>
  `${((value / total) * 100).toFixed(4)}%`

export const ROOM_TABLE_OVERLAY_STYLE = {
  left: toPercent(ROOM_TABLE_OVERLAY.designBox.x, ROOM_TABLE_OVERLAY.scene.width),
  top: toPercent(ROOM_TABLE_OVERLAY.designBox.y, ROOM_TABLE_OVERLAY.scene.height),
  width: toPercent(
    ROOM_TABLE_OVERLAY.designBox.width,
    ROOM_TABLE_OVERLAY.scene.width,
  ),
  height: toPercent(
    ROOM_TABLE_OVERLAY.designBox.height,
    ROOM_TABLE_OVERLAY.scene.height,
  ),
} as const
