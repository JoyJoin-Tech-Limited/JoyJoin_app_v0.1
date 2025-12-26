/**
 * KPI Service Tests - API Response Format Validation
 * 
 * These tests verify that the kpiService functions return data in the
 * correct format expected by the API endpoints. They use mocked database
 * interactions to ensure consistent test behavior.
 * 
 * Note: For true HTTP integration tests with authentication, rate limiting,
 * and middleware validation, a separate test suite with supertest would be
 * needed. These tests focus on service-level correctness.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      userEngagementMetrics: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      eventSatisfactionSummary: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      kpiSnapshots: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  },
}));

import { kpiService } from '../kpiService';

describe('KPI Service - API Response Format', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/kpi/dashboard', () => {
    it('should return dashboard data with correct structure', async () => {
      const { db } = await import('../db');
      const mockSnapshots = [
        {
          snapshotDate: '2024-01-01',
          totalUsers: 100,
          activeUsers: 80,
          newUsers: 10,
          csatScore: '80.00',
          npsScore: 50,
          eventsCreated: 5,
          totalFeedbacks: 20,
        },
        {
          snapshotDate: '2024-01-08',
          totalUsers: 120,
          activeUsers: 90,
          newUsers: 20,
          csatScore: '85.00',
          npsScore: 55,
          eventsCreated: 8,
          totalFeedbacks: 30,
        },
      ];
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockSnapshots),
          }),
        }),
      } as any);

      const data = await kpiService.getKpiDashboardData(30);
      
      expect(data).toHaveProperty('current');
      expect(data).toHaveProperty('history');
      expect(data).toHaveProperty('trends');
      expect(Array.isArray(data.history)).toBe(true);
      expect(typeof data.trends.userGrowth).toBe('number');
      expect(typeof data.trends.csatTrend).toBe('number');
      expect(typeof data.trends.npsTrend).toBe('number');
    });

    it('should handle empty snapshot history', async () => {
      const { db } = await import('../db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const data = await kpiService.getKpiDashboardData(30);
      
      expect(data.current).toBeUndefined();
      expect(data.history).toEqual([]);
      expect(data.trends).toEqual({
        userGrowth: 0,
        csatTrend: 0,
        npsTrend: 0,
      });
    });

    it('should accept custom days parameter', async () => {
      const { db } = await import('../db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const data7Days = await kpiService.getKpiDashboardData(7);
      const data90Days = await kpiService.getKpiDashboardData(90);
      
      expect(data7Days).toHaveProperty('current');
      expect(data90Days).toHaveProperty('current');
    });
  });

  describe('GET /api/admin/kpi/churn-analysis', () => {
    it('should return churn analysis with correct structure', async () => {
      const { db } = await import('../db');
      const mockChurnedUsers = [
        { registrationCohort: '2024-01', registrationMethod: 'phone', totalEventsAttended: 2 },
        { registrationCohort: '2024-01', registrationMethod: 'xiaoyue', totalEventsAttended: 1 },
        { registrationCohort: '2024-02', registrationMethod: 'phone', totalEventsAttended: 3 },
      ];
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockChurnedUsers),
        }),
      } as any);

      const analysis = await kpiService.getChurnAnalysis();
      
      expect(analysis).toHaveProperty('totalChurned');
      expect(analysis).toHaveProperty('byCohort');
      expect(analysis).toHaveProperty('byMethod');
      expect(analysis).toHaveProperty('avgEventsBeforeChurn');
      expect(typeof analysis.totalChurned).toBe('number');
      expect(typeof analysis.avgEventsBeforeChurn).toBe('number');
    });

    it('should group churned users by registration method', async () => {
      const { db } = await import('../db');
      const mockChurnedUsers = [
        { registrationCohort: '2024-01', registrationMethod: 'phone', totalEventsAttended: 2 },
        { registrationCohort: '2024-01', registrationMethod: 'phone', totalEventsAttended: 1 },
        { registrationCohort: '2024-02', registrationMethod: 'xiaoyue', totalEventsAttended: 3 },
      ];
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockChurnedUsers),
        }),
      } as any);

      const analysis = await kpiService.getChurnAnalysis();
      
      expect(analysis.byMethod['phone']).toBe(2);
      expect(analysis.byMethod['xiaoyue']).toBe(1);
    });
  });

  describe('POST /api/admin/kpi/generate-snapshot', () => {
    it('should have generateDailyKpiSnapshot function defined', () => {
      expect(typeof kpiService.generateDailyKpiSnapshot).toBe('function');
    });
  });

  describe('POST /api/admin/kpi/update-user-engagement/:userId', () => {
    it('should update engagement for existing user', async () => {
      const { db } = await import('../db');
      const mockUser = {
        id: 'user-123',
        createdAt: new Date('2024-01-01'),
      };
      const mockEngagement = {
        userId: 'user-123',
        totalEventsAttended: 5,
        lastActiveAt: new Date(),
      };
      
      vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(db.query.userEngagementMetrics.findFirst).mockResolvedValue(mockEngagement as any);
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      } as any);
      
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      await expect(kpiService.updateUserEngagement('user-123')).resolves.not.toThrow();
    });

    it('should create engagement record for new user', async () => {
      const { db } = await import('../db');
      const mockUser = {
        id: 'user-456',
        createdAt: new Date('2024-01-01'),
      };
      
      vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(db.query.userEngagementMetrics.findFirst).mockResolvedValue(undefined);
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      } as any);
      
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await expect(kpiService.updateUserEngagement('user-456')).resolves.not.toThrow();
    });
  });

  describe('GET /api/admin/kpi/satisfaction-scores', () => {
    it('should return CSAT and NPS scores', async () => {
      const { db } = await import('../db');
      const mockFeedbacks = [
        { atmosphereScore: 5, wouldAttendAgain: true, connectionStatus: '已交换联系方式' },
        { atmosphereScore: 4, wouldAttendAgain: true, connectionStatus: null },
        { atmosphereScore: 5, wouldAttendAgain: true, connectionStatus: '已交换联系方式' },
      ];
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFeedbacks),
        }),
      } as any);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const [csatScore, npsScore] = await Promise.all([
        kpiService.calculateCSAT(startDate, endDate),
        kpiService.calculateNPS(startDate, endDate),
      ]);
      
      expect(typeof csatScore).toBe('number');
      expect(typeof npsScore).toBe('number');
      expect(csatScore).toBeGreaterThanOrEqual(0);
      expect(csatScore).toBeLessThanOrEqual(100);
      expect(npsScore).toBeGreaterThanOrEqual(-100);
      expect(npsScore).toBeLessThanOrEqual(100);
    });

    it('should return 0 scores when no feedbacks exist', async () => {
      const { db } = await import('../db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const [csatScore, npsScore] = await Promise.all([
        kpiService.calculateCSAT(startDate, endDate),
        kpiService.calculateNPS(startDate, endDate),
      ]);
      
      expect(csatScore).toBe(0);
      expect(npsScore).toBe(0);
    });
  });

  describe('Rate Limiting', () => {
    it('should have rate limiter configured for KPI endpoints', async () => {
      const { kpiEndpointLimiter } = await import('../rateLimiter');
      expect(kpiEndpointLimiter).toBeDefined();
      expect(typeof kpiEndpointLimiter).toBe('function');
    });
  });
});
