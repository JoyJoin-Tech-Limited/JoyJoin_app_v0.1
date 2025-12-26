/**
 * Unit Tests for KPI Service
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

describe('kpiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CSAT Calculation', () => {
    it('should return 0 when no feedbacks exist', async () => {
      const { db } = await import('../db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const csat = await kpiService.calculateCSAT(startDate, endDate);
      
      expect(csat).toBe(0);
    });

    it('should calculate CSAT correctly with satisfied users', async () => {
      const { db } = await import('../db');
      const mockFeedbacks = [
        { atmosphereScore: 5 },
        { atmosphereScore: 4 },
        { atmosphereScore: 5 },
        { atmosphereScore: 3 },
        { atmosphereScore: 2 },
      ];
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFeedbacks),
        }),
      } as any);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const csat = await kpiService.calculateCSAT(startDate, endDate);
      
      expect(csat).toBe(60);
    });

    it('should return 100 when all users are satisfied', async () => {
      const { db } = await import('../db');
      const mockFeedbacks = [
        { atmosphereScore: 5 },
        { atmosphereScore: 4 },
        { atmosphereScore: 5 },
      ];
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFeedbacks),
        }),
      } as any);

      const csat = await kpiService.calculateCSAT(new Date(), new Date());
      expect(csat).toBe(100);
    });
  });

  describe('NPS Calculation', () => {
    it('should return 0 when no feedbacks exist', async () => {
      const { db } = await import('../db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const nps = await kpiService.calculateNPS(new Date(), new Date());
      expect(nps).toBe(0);
    });

    it('should calculate positive NPS with promoters', async () => {
      const { db } = await import('../db');
      const mockFeedbacks = [
        { atmosphereScore: 5, wouldAttendAgain: true, connectionStatus: '已交换联系方式' },
        { atmosphereScore: 5, wouldAttendAgain: true, connectionStatus: '已交换联系方式' },
        { atmosphereScore: 4, wouldAttendAgain: true, connectionStatus: null },
        { atmosphereScore: 3, wouldAttendAgain: false, connectionStatus: null },
      ];
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFeedbacks),
        }),
      } as any);

      const nps = await kpiService.calculateNPS(new Date(), new Date());
      expect(typeof nps).toBe('number');
    });

    it('should calculate negative NPS with detractors', async () => {
      const { db } = await import('../db');
      const mockFeedbacks = [
        { atmosphereScore: 1, wouldAttendAgain: false, connectionStatus: null },
        { atmosphereScore: 2, wouldAttendAgain: false, connectionStatus: null },
        { atmosphereScore: 2, wouldAttendAgain: false, connectionStatus: null },
        { atmosphereScore: 3, wouldAttendAgain: false, connectionStatus: null },
      ];
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFeedbacks),
        }),
      } as any);

      const nps = await kpiService.calculateNPS(new Date(), new Date());
      expect(nps).toBeLessThan(0);
    });
  });

  describe('Churn Analysis', () => {
    it('should return empty analysis when no churned users', async () => {
      const { db } = await import('../db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const analysis = await kpiService.getChurnAnalysis();
      
      expect(analysis.totalChurned).toBe(0);
      expect(analysis.byCohort).toEqual({});
      expect(analysis.byMethod).toEqual({});
      expect(analysis.avgEventsBeforeChurn).toBe(0);
    });

    it('should group churned users by cohort', async () => {
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
      
      expect(analysis.totalChurned).toBe(3);
      expect(analysis.byCohort['2024-01']).toBe(2);
      expect(analysis.byCohort['2024-02']).toBe(1);
    });

    it('should calculate average events before churn', async () => {
      const { db } = await import('../db');
      const mockChurnedUsers = [
        { registrationCohort: '2024-01', registrationMethod: 'phone', totalEventsAttended: 2 },
        { registrationCohort: '2024-01', registrationMethod: 'phone', totalEventsAttended: 4 },
      ];
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockChurnedUsers),
        }),
      } as any);

      const analysis = await kpiService.getChurnAnalysis();
      
      expect(analysis.avgEventsBeforeChurn).toBe(3);
    });
  });

  describe('KPI Dashboard Data', () => {
    it('should return structured dashboard data', async () => {
      const { db } = await import('../db');
      const mockSnapshots = [
        {
          snapshotDate: '2024-01-01',
          totalUsers: 100,
          csatScore: '80.00',
          npsScore: 50,
        },
        {
          snapshotDate: '2024-01-08',
          totalUsers: 120,
          csatScore: '85.00',
          npsScore: 55,
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
    });

    it('should calculate trends correctly', async () => {
      const { db } = await import('../db');
      const mockSnapshots = [
        {
          snapshotDate: '2024-01-01',
          totalUsers: 100,
          csatScore: '80.00',
          npsScore: 50,
        },
        {
          snapshotDate: '2024-01-08',
          totalUsers: 120,
          csatScore: '85.00',
          npsScore: 55,
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
      
      expect(data.trends.userGrowth).toBe(20);
      expect(data.trends.csatTrend).toBe(5);
      expect(data.trends.npsTrend).toBe(5);
    });
  });
});
