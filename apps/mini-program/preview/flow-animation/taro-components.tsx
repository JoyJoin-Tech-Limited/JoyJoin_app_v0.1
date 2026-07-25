import type { CSSProperties, PropsWithChildren } from 'react'

function browserStyle(style?: CSSProperties): CSSProperties | undefined {
  if (!style) return undefined

  return Object.fromEntries(
    Object.entries(style).map(([key, value]) => [
      key,
      typeof value === 'string'
        ? value.replace(/(-?\d+(?:\.\d+)?)rpx/g, (_, size: string) => `${Number(size) / 2}px`)
        : value,
    ]),
  ) as CSSProperties
}

type CommonProps = PropsWithChildren<{
  className?: string
  style?: CSSProperties
  onClick?: () => void
  ariaLabel?: string
  disabled?: boolean
  scrollY?: boolean
  enhanced?: boolean
  showScrollbar?: boolean
  hoverClass?: string
}>

export function View({ children, className, style, onClick, ariaLabel }: CommonProps) {
  return <div className={className} style={browserStyle(style)} onClick={onClick} aria-label={ariaLabel}>{children}</div>
}

export function Text({ children, className, style }: CommonProps) {
  return <span className={className} style={browserStyle(style)}>{children}</span>
}

export function Button({ children, className, style, onClick, ariaLabel, disabled }: CommonProps) {
  return <button type='button' className={className} style={browserStyle(style)} onClick={onClick} aria-label={ariaLabel} disabled={disabled}>{children}</button>
}

export function ScrollView({ children, className, style }: CommonProps) {
  return <div className={className} style={browserStyle(style)}>{children}</div>
}

export function Image(props: CommonProps & { src?: string; mode?: string; lazyLoad?: boolean; onError?: () => void }) {
  return <img className={props.className} style={browserStyle(props.style)} src={props.src} alt={props.ariaLabel ?? ''} onError={props.onError} />
}
