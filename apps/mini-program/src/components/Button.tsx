import { Button as TaroButton, type ButtonProps } from '@tarojs/components'
import './Button.scss'

export interface JoyButtonProps extends ButtonProps {
  variant?: 'primary' | 'secondary'
}

/**
 * Reusable branded mini-program button primitive.
 */
export default function Button({
  className = '',
  variant = 'primary',
  ...props
}: JoyButtonProps) {
  return (
    <TaroButton
      className={`joy-button joy-button--${variant}${className ? ` ${className}` : ''}`}
      {...props}
    />
  )
}
