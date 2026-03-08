/**
 * Global TypeScript declarations
 */

interface Window {
  gtag?: (
    command: string,
    eventName: string,
    params?: Record<string, any>
  ) => void;
}

// WeChat Mini Program global — available in MP environment, undefined in web/dev
declare const wx: any;
