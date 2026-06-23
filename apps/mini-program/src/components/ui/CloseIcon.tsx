import JoyJoinIcon from './JoyJoinIcon'

interface CloseIconProps {
  size?: number
  className?: string
}

/**
 * Dedicated close/clear icon.
 *
 * JoyJoinIcon maps the emoji key to the proprietary `icon-close` asset.
 * This wrapper keeps the emoji lookup inside the icon system and out of
 * consumer components.
 */
export default function CloseIcon({ size = 24, className = '' }: CloseIconProps) {
  return <JoyJoinIcon emoji='✕' size={size} className={className} />
}
