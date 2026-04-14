import { describe, expect, it, vi } from 'vitest';
import {
  appendBrowserPaymentReturnUrl,
  getBrowserPaymentLaunchUrl,
  getMyBlindBoxEvents,
  getNotificationCounts,
  getPricing,
  getUserCoupons,
  isEventPackPlanType,
  markNotificationsAsRead,
  normalizeEventPoolRegistrationPayload,
  normalizeSubscriptionPlanType,
  registerForPool,
  type ApiTransport,
} from '@shared/api';

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

  it('normalizes mixed pricing payloads and filters malformed rows', async () => {
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

  it('normalizes VIP aliases and extracts browser payment redirect URLs', () => {
    expect(normalizeSubscriptionPlanType('vip_monthly')).toBe('monthly');
    expect(normalizeSubscriptionPlanType('vip_quarterly')).toBe('quarterly');
    expect(normalizeSubscriptionPlanType('monthly')).toBe('monthly');
    expect(normalizeSubscriptionPlanType('invalid')).toBeNull();
    expect(isEventPackPlanType('pack_3')).toBe(true);
    expect(isEventPackPlanType('pack_6')).toBe(true);
    expect(isEventPackPlanType('vip_monthly')).toBe(false);

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
    expect(
      appendBrowserPaymentReturnUrl(
        'https://pay.example.com/h5?prepay_id=abc',
        'https://joyjoin.example.com/blindbox/confirmation?outTradeNo=JJ001'
      )
    ).toBe(
      'https://pay.example.com/h5?prepay_id=abc&redirect_url=https%3A%2F%2Fjoyjoin.example.com%2Fblindbox%2Fconfirmation%3FoutTradeNo%3DJJ001'
    );
    expect(appendBrowserPaymentReturnUrl('https://pay.example.com/h5', '   ')).toBe(
      'https://pay.example.com/h5'
    );
  });

  it('uses the shared blind-box and notification endpoints expected by mini-program hooks', async () => {
    const apiMock = vi.fn().mockResolvedValue({ success: true });
    const api = apiMock as unknown as ApiTransport;

    await getMyBlindBoxEvents(api);
    await getNotificationCounts(api);
    await markNotificationsAsRead(api, 'discover');

    expect(apiMock).toHaveBeenNthCalledWith(1, { path: '/api/my-events' });
    expect(apiMock).toHaveBeenNthCalledWith(2, { path: '/api/notifications/counts' });
    expect(apiMock).toHaveBeenNthCalledWith(3, {
      path: '/api/notifications/mark-read',
      method: 'POST',
      data: { category: 'discover' },
    });
  });

  it('keeps pool registration helper backward-compatible while accepting richer payloads', async () => {
    const apiMock = vi.fn().mockResolvedValue({ id: 'registration-1' });
    const api = apiMock as unknown as ApiTransport;

    await registerForPool(api, 'pool-1');
    await registerForPool(api, 'pool-2', {
      invitationCode: ' INVITE-123 ',
      barThemes: [' 清吧 ', ''],
      alcoholComfort: ' 微醺就好 ',
      barBudgetRange: ['80-150'],
    });

    expect(apiMock).toHaveBeenNthCalledWith(1, {
      path: '/api/event-pools/pool-1/register',
      method: 'POST',
    });
    expect(apiMock).toHaveBeenNthCalledWith(2, {
      path: '/api/event-pools/pool-2/register',
      method: 'POST',
      data: {
        invitationCode: 'INVITE-123',
        barThemes: ['清吧'],
        alcoholComfort: ['微醺就好'],
        barBudgetRange: ['80-150'],
      },
    });
    expect(
      normalizeEventPoolRegistrationPayload({
        alcoholComfort: [' 无酒精饮品 '],
        preferredLanguages: [' 粤语 ', ''],
      })
    ).toEqual({
      alcoholComfort: ['无酒精饮品'],
      preferredLanguages: ['粤语'],
    });
  });
});