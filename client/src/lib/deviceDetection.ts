/**
 * Device Detection Utility
 * 检测用户设备类型用于数据埋点
 */

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export const detectDevice = (): DeviceType => {
  if (typeof window === 'undefined') return 'desktop';

  const width = window.innerWidth;

  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

/**
 * 检测是否在微信浏览器环境
 */
export const isWeChatBrowser = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('micromessenger');
};

/**
 * 检测是否在支付宝浏览器环境
 */
export const isAlipayBrowser = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('alipayclient');
};

/**
 * 检测是否支持WeixinJSBridge支付
 */
export const canUseWeChatPay = (): boolean => {
  return isWeChatBrowser() && typeof (window as any).WeixinJSBridge !== 'undefined';
};
