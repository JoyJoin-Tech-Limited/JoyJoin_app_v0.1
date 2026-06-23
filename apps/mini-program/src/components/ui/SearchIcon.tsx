import JoyJoinIcon from './JoyJoinIcon'

interface SearchIconProps {
  size?: number
  className?: string
}

/**
 * Dedicated search input icon.
 *
 * JoyJoinIcon maps the emoji key to the proprietary `icon-search` asset.
 * This wrapper keeps the emoji lookup inside the icon system and out of
 * consumer components, so the search bar never treats an emoji as its
 * primary icon.
 */
export default function SearchIcon({ size = 28, className = '' }: SearchIconProps) {
  return <JoyJoinIcon emoji='🔍' tier='ui' size={size} className={className} />
}
