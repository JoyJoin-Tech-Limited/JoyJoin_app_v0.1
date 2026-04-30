/**
 * Canvas poster palette — token bridge for personality result card export.
 *
 * These colors are tuned for high-DPI canvas rendering (1080×1920 @ 2–3× DPR).
 * Where a color aligns with a design-system token, the SCSS equivalent is
 * documented so the two surfaces stay in sync during brand updates.
 *
 * SCSS token reference (apps/mini-program/src/styles/_variables.scss):
 *   $color-primary:        #8B5CF6
 *   $color-primary-dark:   #7C3AED
 *   $color-primary-light:  #EDE9FE
 *   $color-secondary:      #FF6B9D
 *   $color-text-primary:   #2D3142
 *   $color-text-secondary: #6B7280
 *   $color-text-muted:     #9CA3AF
 *   $color-text-white:     #FFFFFF
 *   $color-bg:             #FAFAFA
 *   $color-surface:        #FFFFFF
 */

export const CANVAS_PALETTE = {
  // ── Page background (custom poster gradient) ────────────────────
  pageBgStart: '#fff8fb',
  pageBgMid: '#fff3ea',
  pageBgEnd: '#f6ecff',

  // ── Card chrome ─────────────────────────────────────────────────
  cardFill: '#fffdfa',
  cardBorder: '#f5c86b',
  cardInnerBorder: 'rgba(255, 255, 255, 0.95)',
  shadowPurple: 'rgba(91, 53, 178, 0.14)',
  shadowOrange: 'rgba(255, 177, 87, 0.25)',

  // ── Neutral base ────────────────────────────────────────────────
  /** SCSS: $color-text-white */
  white: '#ffffff',

  // ── Hero image shell ────────────────────────────────────────────
  heroGlowEnd: '#ffcf7d',
  heroImageShell: '#fff7ee',
  heroImageBorder: 'rgba(255, 255, 255, 0.85)',

  // ── Typography (custom dark purple spectrum for poster contrast) ──
  /** SCSS: $color-text-primary (tuned darker for print) */
  textDark: '#201533',
  /** SCSS: $color-text-secondary (tuned purple for print) */
  textMuted: '#6f5a8e',
  textSecondary: '#46355f',
  textTertiary: '#6b5a7f',
  textBody: '#2b1b41',
  traitLabel: '#5d4c78',
  /** SCSS: $color-primary-light (near match) */
  traitTrack: '#f4ebff',

  // ── Badges ──────────────────────────────────────────────────────
  badgeDarkFill: '#23123d',
  badgeDarkText: '#fff7d6',
  badgeConfidenceFill: '#fff1cc',
  badgeConfidenceText: '#7a4a00',
  badgeRarityFill: '#f0e7ff',
  badgeRarityText: '#5d35b2',
  badgeMatchFill: '#fff7db',
  badgeMatchText: '#815900',

  // ── Quote / flavour boxes ───────────────────────────────────────
  quoteBoxFill: '#fff5ef',
  quoteBoxBorder: 'rgba(255, 193, 140, 0.55)',

  // ── Skill cards ─────────────────────────────────────────────────
  activeSkillFill: '#fff5f1',
  activeSkillAccent: '#ff9969',
  /** SCSS: $color-primary-light (near match) */
  passiveSkillFill: '#f4f0ff',
  /** SCSS: $color-primary (exact match) */
  passiveSkillAccent: '#8b5cf6',
  skillCardBorder: 'rgba(91, 53, 178, 0.12)',
  skillTitle: '#25173a',
  skillEffect: '#64557c',
  footerText: '#6d5f80',
  skillAttributeText: '#4b2f77',

  // ── Holographic foil effects (canvas-only, no SCSS equivalent) ──
  holographicGold: '#ffd700',
  holographicSilver: '#e8e8e8',
  foilPink: '#ffb6c1',
  foilCyan: '#40e0d0',
  foilLavender: '#e6e6fa',
} as const
