import { useState, useEffect, useCallback } from 'react'
import { apiRequest } from '../../lib/api/api'
import type { CouponValidationResponse } from '@shared/api'
import { isEventPackPlanType } from '@shared/api'
import type { MiniProgramPaymentPlanKey } from '../../lib/payment/paymentPageModel'

const CENTS_PER_YUAN = 100

export interface UsePaymentCouponReturn {
  selectedCouponCode: string
  setSelectedCouponCode: (code: string) => void
  isCouponValid: boolean
  discountAmount: number
  finalAmount: number | null
  couponMessage: string
  isValidatingCoupon: boolean
}

export function usePaymentCoupon(selectedPlan: MiniProgramPaymentPlanKey): UsePaymentCouponReturn {
  const [selectedCouponCode, setSelectedCouponCode] = useState('')
  const [isCouponValid, setIsCouponValid] = useState(false)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [finalAmount, setFinalAmount] = useState<number | null>(null)
  const [couponMessage, setCouponMessage] = useState('')
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false)

  const validateSelectedCoupon = useCallback(async (planKey: MiniProgramPaymentPlanKey, couponCode: string) => {
    const normalizedCouponCode = couponCode.trim()
    if (!normalizedCouponCode) {
      setIsCouponValid(false)
      setDiscountAmount(0)
      setFinalAmount(null)
      setCouponMessage('')
      return
    }

    setIsValidatingCoupon(true)
    try {
      const response = await apiRequest<CouponValidationResponse>({
        path: '/api/coupons/validate',
        method: 'POST',
        data: {
          paymentType: isEventPackPlanType(planKey) ? 'event_pack' : 'event_bundle',
          code: normalizedCouponCode,
          planId: planKey,
          planType: planKey,
          type: planKey,
        },
      })

      if (!response.valid) {
        setIsCouponValid(false)
        setDiscountAmount(0)
        setFinalAmount(null)
        setCouponMessage(response.message || '当前套餐暂不可使用这张优惠券')
        return
      }

      setIsCouponValid(true)
      setDiscountAmount((response.discountAmount ?? 0) / CENTS_PER_YUAN)
      setFinalAmount(typeof response.finalAmount === 'number' ? response.finalAmount / CENTS_PER_YUAN : null)
      setCouponMessage(response.message || '优惠券已应用')
    } catch (error) {
      const message = error instanceof Error ? error.message : '优惠券核验没成功'
      setIsCouponValid(false)
      setDiscountAmount(0)
      setFinalAmount(null)
      setCouponMessage(message)
    } finally {
      setIsValidatingCoupon(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedCouponCode) {
      setIsCouponValid(false)
      setDiscountAmount(0)
      setFinalAmount(null)
      setCouponMessage('')
      return
    }

    void validateSelectedCoupon(selectedPlan, selectedCouponCode)
  }, [selectedCouponCode, selectedPlan, validateSelectedCoupon])

  return {
    selectedCouponCode,
    setSelectedCouponCode,
    isCouponValid,
    discountAmount,
    finalAmount,
    couponMessage,
    isValidatingCoupon,
  }
}
