import { storage } from "./storage";

/**
 * Payment Service for WeChat Pay Integration
 * 
 * SETUP REQUIRED:
 * 1. Register for WeChat Pay merchant account (https://pay.weixin.qq.com/)
 * 2. Install WeChat Pay SDK: npm install wechatpay-node-v3
 * 3. Add environment variables:
 *    - WECHAT_PAY_APP_ID
 *    - WECHAT_PAY_MCH_ID (Merchant ID)
 *    - WECHAT_PAY_SERIAL_NO (Certificate serial number)
 *    - WECHAT_PAY_PRIVATE_KEY (API v3 private key)
 *    - WECHAT_PAY_APIV3_KEY (API v3 key)
 * 
 * Docs: https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml
 */

export interface CreatePaymentParams {
  userId: string;
  paymentType: "subscription" | "event";
  relatedId: string; // subscription ID or event ID
  originalAmount: number; // in cents (¥98 = 9800)
  couponId?: string;
}

export interface PaymentResult {
  paymentId: string;
  wechatOrderId: string;
  prepayId?: string; // WeChat prepay_id for H5/JSAPI
  codeUrl?: string; // QR code URL for Native payment
  h5Url?: string; // H5 payment URL
}

export class PaymentService {
  /**
   * Create a new payment order
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const { userId, paymentType, relatedId, originalAmount, couponId } = params;
    
    // Calculate discount if coupon provided
    let discountAmount = 0;
    let finalAmount = originalAmount;
    
    if (couponId) {
      const coupon = await storage.getCoupon(couponId);
      if (coupon && coupon.isActive) {
        // Validate coupon
        const now = new Date();
        const validFrom = new Date(coupon.validFrom);
        const validUntil = coupon.validUntil ? new Date(coupon.validUntil) : null;
        
        if (now >= validFrom && (!validUntil || now <= validUntil)) {
          // Check usage limits
          if (coupon.maxUses === null || coupon.currentUses < coupon.maxUses) {
            // Calculate discount
            if (coupon.discountType === "fixed_amount") {
              discountAmount = coupon.discountValue;
            } else if (coupon.discountType === "percentage") {
              discountAmount = Math.floor(originalAmount * (coupon.discountValue / 100));
            }
            finalAmount = Math.max(0, originalAmount - discountAmount);
          }
        }
      }
    }
    
    // Generate unique order ID
    const wechatOrderId = `JJ${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
    
    // Create payment record
    const payment = await storage.createPayment({
      userId,
      paymentType,
      relatedId,
      originalAmount,
      discountAmount,
      finalAmount,
      couponId,
      wechatOrderId,
      status: "pending",
    });
    
    // TODO: Call WeChat Pay API to create prepay order
    // This is where you would integrate the actual WeChat Pay SDK
    // Example (pseudo-code):
    // const wechatPay = new WeChatPay({ appId, mchId, ... });
    // const prepayResult = await wechatPay.transactions.h5({
    //   description: paymentType === 'subscription' ? 'JoyJoin会员订阅' : 'JoyJoin活动报名',
    //   out_trade_no: wechatOrderId,
    //   amount: { total: finalAmount, currency: 'CNY' },
    //   scene_info: { payer_client_ip: '...' },
    // });
    
    console.log(`[Payment] Created payment ${payment.id} for user ${userId}, amount: ¥${finalAmount / 100}`);
    
    // MOCK RESPONSE - Replace with actual WeChat Pay response
    return {
      paymentId: payment.id,
      wechatOrderId,
      h5Url: `https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=MOCK_${wechatOrderId}`,
    };
  }
  
  /**
   * Handle WeChat Pay webhook callback
   * 
   * WeChat Pay will send a POST request to your webhook URL when payment status changes
   * Endpoint: POST /api/webhooks/wechat-pay
   */
  async handleWebhook(payload: any): Promise<void> {
    // TODO: Verify WeChat Pay signature
    // const verified = this.verifySignature(payload);
    // if (!verified) throw new Error('Invalid signature');
    
    const { resource, event_type } = payload;
    
    if (event_type === "TRANSACTION.SUCCESS") {
      // Payment successful
      const { out_trade_no, transaction_id, amount } = resource.ciphertext
        ? this.decryptResource(resource) // Decrypt if encrypted
        : resource;
      
      await this.handlePaymentSuccess(out_trade_no, transaction_id);
    } else if (event_type === "REFUND.SUCCESS") {
      // Refund successful
      const { out_trade_no } = resource.ciphertext 
        ? this.decryptResource(resource)
        : resource;
      
      await this.handleRefundSuccess(out_trade_no);
    }
  }
  
  /**
   * Handle successful payment - activate subscription or event registration
   */
  private async handlePaymentSuccess(wechatOrderId: string, transactionId: string): Promise<void> {
    console.log(`[Payment] Processing successful payment: ${wechatOrderId}`);
    
    // Find payment by WeChat order ID
    const payments = await storage.getAllPayments();
    const payment = payments.find(p => p.wechatOrderId === wechatOrderId);
    
    if (!payment) {
      console.error(`[Payment] Payment not found for order ${wechatOrderId}`);
      return;
    }
    
    // Update payment status
    await storage.updatePayment(payment.id, {
      status: "completed",
      wechatTransactionId: transactionId,
      paidAt: new Date(),
    });
    
    // Record coupon usage if applicable
    if (payment.couponId) {
      await storage.recordCouponUsage({
        couponId: payment.couponId,
        userId: payment.userId,
        paymentId: payment.id,
        discountApplied: payment.discountAmount,
      });
    }
    
    // Activate subscription or confirm event registration
    if (payment.paymentType === "subscription") {
      await this.activateSubscription(payment.relatedId, payment.id);
    } else if (payment.paymentType === "event") {
      await this.confirmEventRegistration(payment.relatedId, payment.userId);
    }
    
    // TODO: Send notification to user
    await storage.createNotification({
      userId: payment.userId,
      category: "activities",
      type: payment.paymentType === "subscription" ? "subscription_activated" : "event_confirmed",
      title: payment.paymentType === "subscription" ? "会员订阅成功" : "活动报名成功",
      message: payment.paymentType === "subscription" 
        ? "您的JoyJoin会员已激活，开始探索精彩活动吧！" 
        : "您的活动报名已确认，期待与您见面！",
      relatedResourceId: payment.relatedId,
    });
  }
  
  /**
   * Activate subscription after successful payment
   */
  private async activateSubscription(subscriptionId: string, paymentId: string): Promise<void> {
    await storage.updateSubscription(subscriptionId, {
      status: "active",
      paymentId,
    });
    
    console.log(`[Payment] Activated subscription ${subscriptionId}`);
  }
  
  /**
   * Confirm event registration after successful payment
   */
  private async confirmEventRegistration(eventId: string, userId: string): Promise<void> {
    // TODO: Mark event attendance as paid/confirmed
    console.log(`[Payment] Confirmed event registration for event ${eventId}, user ${userId}`);
  }
  
  /**
   * Handle successful refund
   */
  private async handleRefundSuccess(wechatOrderId: string): Promise<void> {
    console.log(`[Payment] Processing refund for order: ${wechatOrderId}`);
    
    const payments = await storage.getAllPayments();
    const payment = payments.find(p => p.wechatOrderId === wechatOrderId);
    
    if (!payment) {
      console.error(`[Payment] Payment not found for refund ${wechatOrderId}`);
      return;
    }
    
    await storage.updatePayment(payment.id, {
      status: "refunded",
    });
    
    // Deactivate subscription if it was a subscription payment
    if (payment.paymentType === "subscription" && payment.relatedId) {
      await storage.updateSubscription(payment.relatedId, {
        status: "cancelled",
      });
    }
  }
  
  /**
   * Decrypt WeChat Pay encrypted resource
   * See: https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay4_2.shtml
   */
  private decryptResource(resource: any): any {
    // TODO: Implement AES-256-GCM decryption
    // const { ciphertext, nonce, associated_data } = resource;
    // Use APIV3_KEY to decrypt
    throw new Error("Decryption not implemented - add WeChat Pay SDK");
  }
  
  /**
   * Verify WeChat Pay webhook signature
   */
  private verifySignature(payload: any): boolean {
    // TODO: Implement signature verification
    // See: https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay4_1.shtml
    return true; // MOCK - always return true in development
  }
  
  /**
   * Query payment status from WeChat Pay
   */
  async queryPaymentStatus(wechatOrderId: string): Promise<string> {
    // TODO: Call WeChat Pay API to query payment status
    // const status = await wechatPay.transactions.queryByOutTradeNo({ out_trade_no: wechatOrderId });
    console.log(`[Payment] Querying status for order ${wechatOrderId}`);
    return "pending"; // MOCK
  }
  
  /**
   * Create refund for a payment
   */
  async createRefund(paymentId: string, reason: string): Promise<void> {
    const payments = await storage.getAllPayments();
    const payment = payments.find(p => p.id === paymentId);
    
    if (!payment) {
      throw new Error("Payment not found");
    }
    
    if (payment.status !== "completed") {
      throw new Error("Can only refund completed payments");
    }
    
    // TODO: Call WeChat Pay refund API
    // const refund = await wechatPay.refunds.create({
    //   out_trade_no: payment.wechatOrderId,
    //   out_refund_no: `RF${Date.now()}`,
    //   amount: { refund: payment.finalAmount, total: payment.finalAmount, currency: 'CNY' },
    //   reason,
    // });
    
    console.log(`[Payment] Initiated refund for payment ${paymentId}, reason: ${reason}`);
  }
}

export const paymentService = new PaymentService();
