import { storage } from "./storage";

/**
 * Subscription Management Service
 * 
 * Handles subscription expiry checks, renewals, and status updates.
 */

export class SubscriptionService {
  private checkInterval: NodeJS.Timeout | null = null;
  
  /**
   * Start the subscription expiry checker
   * Runs every hour to check for expired subscriptions
   */
  startExpiryChecker(intervalMs: number = 60 * 60 * 1000): void {
    console.log("[Subscription] Starting expiry checker...");
    
    // Run immediately on startup
    this.checkExpiredSubscriptions();
    
    // Then run on interval
    this.checkInterval = setInterval(() => {
      this.checkExpiredSubscriptions();
    }, intervalMs);
  }
  
  /**
   * Stop the subscription expiry checker
   */
  stopExpiryChecker(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log("[Subscription] Expiry checker stopped");
    }
  }
  
  /**
   * Check for expired subscriptions and update their status
   */
  async checkExpiredSubscriptions(): Promise<void> {
    try {
      console.log("[Subscription] Checking for expired subscriptions...");
      
      const activeSubscriptions = await storage.getActiveSubscriptions();
      const now = new Date();
      let expiredCount = 0;
      let expiringCount = 0;
      
      for (const subscription of activeSubscriptions) {
        const endDate = new Date(subscription.endDate);
        
        // Check if subscription has expired
        if (endDate < now) {
          await storage.updateSubscription(subscription.id, {
            status: "expired",
          });
          
          // Notify user about expiration
          await storage.createNotification({
            userId: subscription.userId,
            category: "activities",
            type: "subscription_expired",
            title: "会员已过期",
            message: "您的JoyJoin会员已过期。续费以继续享受会员权益！",
            relatedResourceId: subscription.id,
          });
          
          expiredCount++;
          console.log(`[Subscription] Expired subscription ${subscription.id} for user ${subscription.userId}`);
        }
        
        // Check if subscription is expiring soon (within 3 days)
        const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        if (endDate > now && endDate <= threeDaysFromNow) {
          // Send expiring soon notification (only if not already sent)
          // We can add a field to track if notification was sent, for now just send it
          await storage.createNotification({
            userId: subscription.userId,
            category: "activities",
            type: "subscription_expiring",
            title: "会员即将过期",
            message: `您的JoyJoin会员将在 ${this.formatDaysRemaining(now, endDate)} 后过期。立即续费享受不间断服务！`,
            relatedResourceId: subscription.id,
          });
          
          expiringCount++;
          console.log(`[Subscription] Subscription ${subscription.id} expiring soon for user ${subscription.userId}`);
        }
      }
      
      if (expiredCount > 0 || expiringCount > 0) {
        console.log(`[Subscription] Processed ${expiredCount} expired and ${expiringCount} expiring subscriptions`);
      } else {
        console.log("[Subscription] No expired or expiring subscriptions found");
      }
    } catch (error) {
      console.error("[Subscription] Error checking expired subscriptions:", error);
    }
  }
  
  /**
   * Format remaining days for notification message
   */
  private formatDaysRemaining(now: Date, endDate: Date): string {
    const msRemaining = endDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
    
    if (daysRemaining === 1) {
      return "1天";
    } else if (daysRemaining < 1) {
      const hoursRemaining = Math.ceil(msRemaining / (60 * 60 * 1000));
      return `${hoursRemaining}小时`;
    } else {
      return `${daysRemaining}天`;
    }
  }
  
  /**
   * Get subscription status for a user
   */
  async getUserSubscriptionStatus(userId: string): Promise<{
    hasActiveSubscription: boolean;
    subscription?: any;
    daysRemaining?: number;
  }> {
    const subscription = await storage.getUserSubscription(userId);
    
    if (!subscription || subscription.status !== "active") {
      return { hasActiveSubscription: false };
    }
    
    const now = new Date();
    const endDate = new Date(subscription.endDate);
    const msRemaining = endDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
    
    return {
      hasActiveSubscription: true,
      subscription,
      daysRemaining: Math.max(0, daysRemaining),
    };
  }
  
  /**
   * Cancel a subscription (mark as cancelled)
   */
  async cancelSubscription(subscriptionId: string, reason?: string): Promise<void> {
    await storage.updateSubscription(subscriptionId, {
      status: "cancelled",
    });
    
    console.log(`[Subscription] Cancelled subscription ${subscriptionId}, reason: ${reason || "N/A"}`);
  }
  
  /**
   * Renew a subscription by creating a new payment
   * Returns the payment details for WeChat Pay checkout
   */
  async renewSubscription(userId: string, planType: "monthly" | "quarterly"): Promise<any> {
    // Get the user's current subscription
    const currentSubscription = await storage.getUserSubscription(userId);
    
    // Calculate amount based on plan type
    const amounts = {
      monthly: 9800,   // ¥98 in cents
      quarterly: 29400, // ¥294 in cents (3 months)
    };
    
    const originalAmount = amounts[planType];
    
    // Create a new subscription record (pending until payment completes)
    const startDate = currentSubscription && new Date(currentSubscription.endDate) > new Date()
      ? new Date(currentSubscription.endDate) // Start after current subscription ends
      : new Date(); // Start immediately if no active subscription
    
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + (planType === "monthly" ? 1 : 3));
    
    const newSubscription = await storage.createSubscription({
      userId,
      planType,
      startDate,
      endDate,
      status: "pending", // Will be activated when payment completes
      paymentId: null, // Will be set by payment webhook
    });
    
    console.log(`[Subscription] Created pending ${planType} renewal for user ${userId}`);
    
    // Return subscription ID for payment creation
    return {
      subscriptionId: newSubscription.id,
      amount: originalAmount,
      planType,
    };
  }
}

export const subscriptionService = new SubscriptionService();
