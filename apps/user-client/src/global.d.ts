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
