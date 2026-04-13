import { describe, expect, it, vi } from 'vitest';
import {
  getBrowserPaymentLaunchUrl,
  getPricing,
  getUserCoupons,
  normalizeSubscriptionPlanType,
  type ApiTransport,
} from '@joyjoin/shared/api';

describe('shared API coupon normalization', () => {
  it('preserves total count while deriving availableCount from coupon statuses', async () => {
    const apiMock = vi.fn().mockResolvedValue({
      count: 5,
      coupons: [
        {
          id: 'coupon-available',
          valid_until: '2999-01-01T00:00:00.000Z',
        },
        {
          id: 'coupon-used',
          is_used: true,
        },
        {
          id: 'coupon-expired',
          valid_until: '2000-01-01T00:00:00.000Z',
        },
      ],
    });
    const api = apiMock as unknown as ApiTransport;

    const response = await getUserCoupons(api);

    expect(apiMock).toHaveBeenCalledWith({ path: '/api/user/coupons' });
    expect(response.count).toBe(5);
    expect(response.availableCount).toBe(1);
    expect(response.coupons.map((coupon) => coupon.status)).toEqual([
      'available',
      'used',
      'expired',
    ]);
  });

  it('normalizes mixed pricing payloads and drops malformed rows', async () => {
    const apiMock = vi.fn().mockResolvedValue([
      {
        id: 'monthly-plan',
        planType: 'monthly',
        name: '月度活动礼包',
        nameEn: 'Monthly Joy Bundle',
        price: '128',
        originalPrice: '168',
        durationDays: '30',
        isActive: true,
      },
      {
        id: 'vip-quarterly-plan',
        planType: 'vip_quarterly',
        displayName: '季度活动礼包',
        price: 268,
        isFeatured: true,
      },
      {
        id: 'broken-plan',
        planType: 'broken',
      },
    ]);
    const api = apiMock as unknown as ApiTransport;

    const response = await getPricing(api);

    expect(apiMock).toHaveBeenCalledWith({ path: '/api/pricing' });
    expect(response).toEqual([
      {
        id: 'monthly-plan',
        planType: 'monthly',
        displayName: '月度活动礼包',
        displayNameEn: 'Monthly Joy Bundle',
        description: undefined,
        price: 128,
        originalPrice: 168,
        durationDays: 30,
        isActive: true,
        isFeatured: undefined,
      },
      {
        id: 'vip-quarterly-plan',
        planType: 'vip_quarterly',
        displayName: '季度活动礼包',
        displayNameEn: undefined,
        description: undefined,
        price: 268,
        originalPrice: null,
        durationDays: undefined,
        isActive: undefined,
        isFeatured: true,
      },
    ]);
  });

  it('normalizes VIP aliases and extracts browser launch URLs from either payload shape', () => {
    expect(normalizeSubscriptionPlanType('vip_monthly')).toBe('monthly');
    expect(normalizeSubscriptionPlanType('vip_quarterly')).toBe('quarterly');
    expect(normalizeSubscriptionPlanType('monthly')).toBe('monthly');
    expect(normalizeSubscriptionPlanType('invalid')).toBeNull();

    expect(getBrowserPaymentLaunchUrl({ paymentRedirectUrl: ' https://pay.example.com/h5 ' })).toBe(
      'https://pay.example.com/h5'
    );
    expect(getBrowserPaymentLaunchUrl({ payment: { h5Url: 'https://pay.example.com/nested' } })).toBe(
      'https://pay.example.com/nested'
    );
    expect(getBrowserPaymentLaunchUrl({ payment: { h5_url: 'https://pay.example.com/legacy' } })).toBe(
      'https://pay.example.com/legacy'
    );
    expect(getBrowserPaymentLaunchUrl(null)).toBeNull();
  });
});
