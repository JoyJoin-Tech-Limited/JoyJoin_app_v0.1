export type PaymentPlanKey = 'vip_monthly' | 'vip_quarterly';

export interface PricingPlan {
  id: string;
  planType: string;
  displayName: string;
  displayNameEn?: string;
  description?: string;
  price: number;
  originalPrice?: number | null;
  durationDays?: number;
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface MiniProgramPaymentIntentRequest {
  type: 'event' | PaymentPlanKey;
  eventId?: string;
  planId?: PaymentPlanKey;
  openid: string;
}

export interface MiniProgramPaymentIntentResponse {
  outTradeNo: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
  type: 'event' | PaymentPlanKey;
}
