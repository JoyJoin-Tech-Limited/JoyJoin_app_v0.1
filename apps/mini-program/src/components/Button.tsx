import { Button as TaroButton, type ButtonProps } from '@tarojs/components'
import './Button.scss'

export interface JoyButtonProps extends Omit<ButtonProps, 'variant'> {
  /** `brand` uses the Alimama display face for high-emotion CTAs; default UI font otherwise. */
  variant?: 'primary' | 'secondary' | 'brand'
}

/**
 * Reusable branded mini-program button primitive.
 */
export default function Button({
  className = '',
  variant = 'primary',
  ...props
}: JoyButtonProps) {
  const variantClass =
    variant === 'brand' ? 'joy-button--brand joy-button--primary' : `joy-button--${variant}`

  return (
    <TaroButton className={`joy-button ${variantClass}${className ? ` ${className}` : ''}`} {...props} />
  )
}
