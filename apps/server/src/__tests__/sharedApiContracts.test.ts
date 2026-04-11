import { describe, expect, it, vi } from 'vitest';
import { getUserCoupons, type ApiTransport } from '@shared/api';

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
});