import { Button as TaroButton, type ButtonProps, Text, View } from '@tarojs/components'
import './Button.scss'

export interface JoyButtonProps extends Omit<ButtonProps, 'variant'> {
  /** `brand` uses the Alimama display face for high-emotion CTAs; default UI font otherwise. */
  variant?: 'primary' | 'secondary' | 'brand'
  /** Show a loading dot-ellipsis spinner instead of the label. */
  loading?: boolean
}

/**
 * Reusable branded mini-program button primitive.
 */
export default function Button({
  className = '',
  variant = 'primary',
  loading = false,
  children,
  disabled,
  ...props
}: JoyButtonProps) {
  const variantClass =
    variant === 'brand' ? 'joy-button--brand joy-button--primary' : `joy-button--${variant}`
  const loadingClass = loading ? ' joy-button--loading' : ''

  return (
    <TaroButton
      className={`joy-button ${variantClass}${loadingClass}${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <View className='joy-button__dots'>
          <View className='joy-button__dot joy-button__dot--1' />
          <View className='joy-button__dot joy-button__dot--2' />
          <View className='joy-button__dot joy-button__dot--3' />
        </View>
      ) : (
        children
      )}
    </TaroButton>
  )
}
