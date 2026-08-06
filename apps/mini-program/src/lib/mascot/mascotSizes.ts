/**
 * Xiaoyue mascot size ramp — the single source of truth for standard mascot
 * dimensions (avatar sprites, static portraits, empty-state mascots).
 *
 * Adopt these tokens for NEW usages. Existing call sites with off-ramp sizes
 * (e.g. XiaoyueChatBubble wide/vertical 120rpx, personality-test 152rpx,
 * letter card 120rpx, loading shell 200/240rpx, farewell 96rpx) keep their
 * local literals — the ramp adoption must never alter a rendered pixel.
 */
export const MASCOT_SIZE = { sm: '96rpx', md: '160rpx', lg: '200rpx', xl: '240rpx' } as const

/** Numeric (rpx) aliases of the same ramp, for computed layouts (e.g. halo sizing). */
export const MASCOT_SIZE_RPX = { sm: 96, md: 160, lg: 200, xl: 240 } as const
