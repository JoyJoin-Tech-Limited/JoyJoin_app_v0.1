/**
 * Web Vitals 性能监控
 * 
 * 在开发环境下记录 FCP、LCP、CLS 等核心指标到控制台
 */

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

const THRESHOLDS = {
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  CLS: { good: 0.1, poor: 0.25 },
  FID: { good: 100, poor: 300 },
  TTFB: { good: 800, poor: 1800 },
};

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return 'good';
  
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

function formatValue(name: string, value: number): string {
  if (name === 'CLS') return value.toFixed(3);
  return `${Math.round(value)}ms`;
}

function logMetric(metric: WebVitalMetric) {
  const colors = {
    'good': 'color: #0cce6b',
    'needs-improvement': 'color: #ffa400',
    'poor': 'color: #ff4e42',
  };
  
  console.log(
    `%c[Web Vitals] ${metric.name}: ${formatValue(metric.name, metric.value)} (${metric.rating})`,
    colors[metric.rating]
  );
}

/**
 * 初始化 Web Vitals 监控
 * 仅在开发环境下记录到控制台
 */
export function logWebVitals(): void {
  if (typeof window === 'undefined') return;
  
  // First Contentful Paint
  if ('PerformanceObserver' in window) {
    try {
      // FCP
      const fcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            logMetric({
              name: 'FCP',
              value: entry.startTime,
              rating: getRating('FCP', entry.startTime),
            });
          }
        });
      });
      fcpObserver.observe({ entryTypes: ['paint'] });
      
      // LCP
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          logMetric({
            name: 'LCP',
            value: lastEntry.startTime,
            rating: getRating('LCP', lastEntry.startTime),
          });
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      
      // CLS
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      
      // Report CLS on page hide
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          logMetric({
            name: 'CLS',
            value: clsValue,
            rating: getRating('CLS', clsValue),
          });
        }
      });
      
    } catch (e) {
      // Performance Observer not supported
    }
  }
  
  // TTFB
  if (performance.timing) {
    const ttfb = performance.timing.responseStart - performance.timing.requestStart;
    if (ttfb > 0) {
      logMetric({
        name: 'TTFB',
        value: ttfb,
        rating: getRating('TTFB', ttfb),
      });
    }
  }
}

/**
 * 标记路由切换性能
 */
export function markRouteTransition(routeName: string): () => void {
  const markName = `route-${routeName}-start`;
  performance.mark(markName);
  
  return () => {
    const measureName = `route-${routeName}-transition`;
    performance.measure(measureName, markName);
    
    const entries = performance.getEntriesByName(measureName);
    if (entries.length > 0) {
      const duration = entries[entries.length - 1].duration;
      console.log(
        `%c[Route] ${routeName}: ${Math.round(duration)}ms`,
        duration <= 1000 ? 'color: #0cce6b' : duration <= 2000 ? 'color: #ffa400' : 'color: #ff4e42'
      );
    }
    
    // Cleanup
    performance.clearMarks(markName);
    performance.clearMeasures(measureName);
  };
}
