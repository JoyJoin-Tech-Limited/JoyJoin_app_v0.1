import { View, type ViewProps } from '@tarojs/components'
import './ModalOverlay.scss'

/**
 * Lightweight overlay shell for future modal/sheet usage.
 */
export default function ModalOverlay({ className = '', ...props }: ViewProps) {
  return <View className={`modal-overlay${className ? ` ${className}` : ''}`} {...props} />
}
