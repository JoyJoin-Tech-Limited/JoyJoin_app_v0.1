/**
 * Phase 2: Onboarding Analytics Tracker
 * 
 * Tracks user progression through onboarding flow for funnel analysis
 * and drop-off detection.
 */

import { apiRequest } from "./queryClient";

export type OnboardingStep = 
  | 'login'
  | 'onboarding'
  | 'personality-test'
  | 'essential-data'
  | 'extended-data'
  | 'profile-review'
  | 'guide'
  | 'discover';

export type OnboardingEventType =
  | 'step_started'
  | 'step_completed'
  | 'step_abandoned'
  | 'validation_failed'
  | 'error_occurred';

interface OnboardingAnalyticsEvent {
  step: OnboardingStep;
  eventType: OnboardingEventType;
  metadata?: Record<string, any>;
  timestamp?: number;
}

class OnboardingAnalytics {
  private sessionStartTime: number = Date.now();
  private stepStartTimes: Map<OnboardingStep, number> = new Map();

  /**
   * Track when user starts a step
   */
  stepStarted(step: OnboardingStep, metadata?: Record<string, any>) {
    this.stepStartTimes.set(step, Date.now());
    this.track('step_started', step, metadata);
  }

  /**
   * Track when user completes a step
   */
  stepCompleted(step: OnboardingStep, metadata?: Record<string, any>) {
    const startTime = this.stepStartTimes.get(step);
    const timeSpent = startTime ? Date.now() - startTime : 0;
    
    this.track('step_completed', step, {
      ...metadata,
      timeSpent,
      timeSpentSeconds: Math.round(timeSpent / 1000),
    });
    
    this.stepStartTimes.delete(step);
  }

  /**
   * Track when user abandons a step (navigates away without completing)
   */
  stepAbandoned(step: OnboardingStep, reason?: string) {
    const startTime = this.stepStartTimes.get(step);
    const timeSpent = startTime ? Date.now() - startTime : 0;
    
    this.track('step_abandoned', step, {
      reason,
      timeSpent,
      timeSpentSeconds: Math.round(timeSpent / 1000),
    });
    
    this.stepStartTimes.delete(step);
  }

  /**
   * Track validation failures (e.g., age < 18)
   */
  validationFailed(step: OnboardingStep, field: string, reason: string) {
    this.track('validation_failed', step, {
      field,
      reason,
    });
  }

  /**
   * Track errors (e.g., API failures, localStorage corruption)
   */
  errorOccurred(step: OnboardingStep, errorType: string, errorMessage: string) {
    this.track('error_occurred', step, {
      errorType,
      errorMessage,
    });
  }

  /**
   * Internal tracking method
   */
  private track(
    eventType: OnboardingEventType,
    step: OnboardingStep,
    metadata?: Record<string, any>
  ) {
    const event: OnboardingAnalyticsEvent = {
      step,
      eventType,
      metadata: {
        ...metadata,
        sessionDuration: Date.now() - this.sessionStartTime,
        timestamp: Date.now(),
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
        screenSize: typeof window !== 'undefined' 
          ? `${window.screen.width}x${window.screen.height}` 
          : 'unknown',
      },
      timestamp: Date.now(),
    };

    // Send to backend
    this.sendToBackend(event);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[OnboardingAnalytics]', event);
    }
  }

  /**
   * Send analytics event to backend (non-blocking)
   */
  private async sendToBackend(event: OnboardingAnalyticsEvent) {
    try {
      await apiRequest('POST', '/api/analytics/onboarding', event);
    } catch (error) {
      // Silent fail - analytics should never block user flow
      console.error('[OnboardingAnalytics] Failed to send event:', error);
    }
  }

  /**
   * Get total session duration
   */
  getSessionDuration() {
    return Date.now() - this.sessionStartTime;
  }
}

// Singleton instance
export const onboardingAnalytics = new OnboardingAnalytics();
