/**
 * Animation Analytics Tracking (Enhanced)
 * 详细监测用户与匹配动画的交互行为
 * 支持按设备、时间段、流失点分析
 */

export interface AnimationEvent {
  eventId: string;
  userId: string;
  eventType: 'view' | 'skip' | 'share' | 'complete' | 'replay';
  timestamp?: number;
  duration?: number;
  device?: 'mobile' | 'tablet' | 'desktop';
  skipPoint?: 'act1' | 'act2' | 'act3';
  abTestVariant?: string;
  networkSpeed?: 'fast' | 'normal' | 'slow';
}

export interface AnalyticsStats {
  totalEvents: number;
  viewCount: number;
  skipCount: number;
  shareCount: number;
  completeCount: number;
  replayCount: number;
  skipRate: string;
  conversionRate: string;
  deviceBreakdown: Record<string, number>;
  hourlyDistribution: Record<number, number>;
  dropoffBySkipPoint: Record<string, number>;
  abTestComparison: Record<string, any>;
  averageSessionDuration: number;
}

const ANALYTICS_KEY = 'joyjoin_animation_analytics';

/**
 * Track animation events locally (Phase 2: can send to backend)
 */
export const trackAnimationEvent = (event: AnimationEvent) => {
  try {
    const stored = localStorage.getItem(ANALYTICS_KEY);
    const events: AnimationEvent[] = stored ? JSON.parse(stored) : [];
    events.push({
      ...event,
      timestamp: Date.now(),
    });
    // Keep last 100 events
    if (events.length > 100) {
      events.shift();
    }
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events));
  } catch (error) {
    console.debug('Analytics tracking failed:', error);
  }
};

/**
 * Get enhanced animation statistics with device/time/dropoff analysis
 */
export const getAnimationStats = (): AnalyticsStats | null => {
  try {
    const stored = localStorage.getItem(ANALYTICS_KEY);
    const events: AnimationEvent[] = stored ? JSON.parse(stored) : [];

    const views = events.filter(e => e.eventType === 'view').length;
    const skips = events.filter(e => e.eventType === 'skip').length;
    const completes = events.filter(e => e.eventType === 'complete').length;
    const shares = events.filter(e => e.eventType === 'share').length;
    const replays = events.filter(e => e.eventType === 'replay').length;

    // Device breakdown
    const deviceBreakdown: Record<string, number> = {};
    events.forEach(e => {
      if (e.device) {
        deviceBreakdown[e.device] = (deviceBreakdown[e.device] || 0) + 1;
      }
    });

    // Hourly distribution
    const hourlyDistribution: Record<number, number> = {};
    events.forEach(e => {
      if (e.timestamp) {
        const hour = new Date(e.timestamp).getHours();
        hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
      }
    });

    // Dropoff by skip point
    const dropoffBySkipPoint: Record<string, number> = {};
    events.filter(e => e.eventType === 'skip').forEach(e => {
      if (e.skipPoint) {
        dropoffBySkipPoint[e.skipPoint] = (dropoffBySkipPoint[e.skipPoint] || 0) + 1;
      }
    });

    // A/B test comparison
    const abTestVariants: Record<string, number[]> = {};
    events.forEach(e => {
      if (e.abTestVariant && e.duration) {
        if (!abTestVariants[e.abTestVariant]) abTestVariants[e.abTestVariant] = [];
        abTestVariants[e.abTestVariant].push(e.duration);
      }
    });

    const abTestComparison: Record<string, any> = {};
    Object.entries(abTestVariants).forEach(([variant, durations]) => {
      abTestComparison[variant] = {
        sampleSize: durations.length,
        avgDuration: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0),
      };
    });

    const avgDuration = events
      .filter(e => e.duration)
      .reduce((sum, e) => sum + (e.duration || 0), 0) / Math.max(events.filter(e => e.duration).length, 1);

    return {
      totalEvents: events.length,
      viewCount: views,
      skipCount: skips,
      shareCount: shares,
      completeCount: completes,
      replayCount: replays,
      skipRate: views > 0 ? ((skips / views) * 100).toFixed(1) : '0',
      conversionRate: views > 0 ? ((completes / views) * 100).toFixed(1) : '0',
      deviceBreakdown,
      hourlyDistribution,
      dropoffBySkipPoint,
      abTestComparison,
      averageSessionDuration: Math.round(avgDuration),
    };
  } catch (error) {
    return null;
  }
};
