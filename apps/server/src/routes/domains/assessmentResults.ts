import { logger } from "../../lib/logger";
import type { Express } from "express";
import { kpiEndpointLimiter } from "../../rateLimiter";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { requireAuth } from "../../middleware/auth";
import { storage } from "../../storage";

export function registerAssessmentResultRoutes(app: Express): void {
  // ============ KPI Dashboard API ============

  // Get KPI dashboard data
  app.get('/api/admin/kpi/dashboard', kpiEndpointLimiter, requireAdmin, async (req: any, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const { kpiService } = await import('../../kpiService');
      const data = await kpiService.getKpiDashboardData(days);
      res.json(data);
    } catch (error: any) {
      logger.error('[KPI Dashboard] Error', { error: String(error) });
      res.status(500).json({ message: 'Failed to get KPI dashboard data', error: error.message });
    }
  });

  // Get churn analysis
  app.get('/api/admin/kpi/churn-analysis', kpiEndpointLimiter, requireAdmin, async (req: any, res) => {
    try {
      const { kpiService } = await import('../../kpiService');
      const analysis = await kpiService.getChurnAnalysis();
      res.json(analysis);
    } catch (error: any) {
      logger.error('[KPI Churn] Error', { error: String(error) });
      res.status(500).json({ message: 'Failed to get churn analysis', error: error.message });
    }
  });

  // Generate daily KPI snapshot (can be called manually or via cron)
  app.post('/api/admin/kpi/generate-snapshot', kpiEndpointLimiter, requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
    try {
      const { kpiService } = await import('../../kpiService');
      await kpiService.generateDailyKpiSnapshot();
      res.json({ success: true, message: 'KPI snapshot generated' });
    } catch (error: any) {
      logger.error('[KPI Snapshot] Error', { error: String(error) });
      res.status(500).json({ message: 'Failed to generate KPI snapshot', error: error.message });
    }
  });

  // Update user engagement metrics
  app.post('/api/admin/kpi/update-user-engagement/:userId', kpiEndpointLimiter, requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { kpiService } = await import('../../kpiService');
      await kpiService.updateUserEngagement(userId);
      res.json({ success: true, message: 'User engagement updated' });
    } catch (error: any) {
      logger.error('[KPI User Engagement] Error', { error: String(error) });
      res.status(500).json({ message: 'Failed to update user engagement', error: error.message });
    }
  });

  // Calculate current CSAT and NPS scores
  app.get('/api/admin/kpi/satisfaction-scores', kpiEndpointLimiter, requireAdmin, async (req: any, res) => {
    try {
      const { kpiService } = await import('../../kpiService');
      const days = parseInt(req.query.days as string) || 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const [csatScore, npsScore] = await Promise.all([
        kpiService.calculateCSAT(startDate, endDate),
        kpiService.calculateNPS(startDate, endDate),
      ]);
      
      res.json({
        csatScore: csatScore.toFixed(2),
        npsScore: Math.round(npsScore),
        period: `Last ${days} days`,
      });
    } catch (error: any) {
      logger.error('[KPI Satisfaction] Error', { error: String(error) });
      res.status(500).json({ message: 'Failed to get satisfaction scores', error: error.message });
    }
  });

  // ============ V4 Adaptive Personality Assessment API ============

  // Start assessment session (with optional pre-signup answers from onboarding)

  // Submit answer and get next question

  // Skip current question and get alternative

  // Get assessment results

  // Link session to user after signup (called from onboarding)

  // Get anchor questions for pre-signup onboarding

  // Sync pre-signup answers after login - creates session and seeds L1 answers

  // Helper function to shuffle options (prevent order bias)
  function shuffleOptions(options: any[]): any[] {
    const shuffled = [...options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // ============ Unified Assessment Result Endpoint (V2 Integration) ============
  // This endpoint normalizes both V1 and V2 results into a consistent shape
  app.get('/api/assessment/result', requireAuth, async (req: any, res) => {
    try {
      // Use session userId fallback when req.user is undefined (phone auth uses session)
      const userId = req.user?.id || req.session?.userId;
      const { getChemistryForArchetype, archetypePrototypes } = await import('@shared/personality/prototypes');
      
      // Get the latest COMPLETED V4 assessment session
      // This ensures we always return the most recent finished result, even if user has 
      // an incomplete retest session in progress
      const session = await storage.getLatestCompletedAssessmentSessionByUser(userId);
      
      if (session) {
        const finalResult = session.finalResult as any;
        const primaryArchetype = session.primaryArchetype || finalResult?.primaryArchetype || finalResult?.archetype;
        
        if (!primaryArchetype) {
          return res.status(400).json({ message: 'No archetype found in result' });
        }

        // Generate dynamic chemistry from prototypes
        const chemistryList = getChemistryForArchetype(primaryArchetype);
        
        // Get archetype prototype for trait profile
        const prototype = archetypePrototypes[primaryArchetype];
        
        // Use trait scores from finalResult (already normalized to 0-100 by V4 adaptive engine)
        // Fallback to top-level traitScores for legacy sessions
        const traitScores = (finalResult?.traitScores || session.traitScores || {}) as Record<string, number>;
        const normalizeScore = (score: number | undefined, fallback: number = 50): number =>  {
          if (score === undefined || score === null) return fallback;
          // V4 finalResult.traitScores are already 0-100 (normalized by adaptive engine)
          // Top-level session.traitScores are also 0-100 (from engineState.traitConfidences)
          // Very old legacy V1 sessions might have 0-1 scores, so handle both cases for safety
          if (score > 0 && score < 1) return Math.round(score * 100);
          // Already in 0-100 range
          return Math.round(score);
        };
        
        const normalizedTraits = {
          affinityScore: normalizeScore(traitScores.A),
          opennessScore: normalizeScore(traitScores.O),
          conscientiousnessScore: normalizeScore(traitScores.C),
          emotionalStabilityScore: normalizeScore(traitScores.E),
          extraversionScore: normalizeScore(traitScores.X),
          positivityScore: normalizeScore(traitScores.P),
        };

        // Get total questions from session answers count
        const answers = await storage.getAssessmentAnswers(session.id);
        const totalQuestions = answers?.length || finalResult?.questionCount || 12;

        // Build normalized response
        const response = {
          algorithmVersion: session.algorithmVersion || 'v1',
          primaryArchetype: primaryArchetype,
          secondaryArchetype: finalResult?.secondaryArchetype,
          topArchetypes: session.topArchetypes || null,
          ...normalizedTraits,
          totalQuestions,
          chemistryList: chemistryList.map(c => ({
            role: c.archetype,
            percentage: c.percentage,
            reason: c.reason,
          })),
          archetypeTraitProfile: prototype?.traitProfile || null,
          matchDetails: session.matchDetailsJson || null,
          isDecisive: session.isDecisive || false,
          completedAt: session.completedAt,
        };
        
        return res.json(response);
      }
      
      // Fallback to legacy role_results table
      const legacyResult = await storage.getRoleResult(userId);
      if (legacyResult) {
        const chemistryList = getChemistryForArchetype(legacyResult.primaryArchetype);
        const prototype = archetypePrototypes[legacyResult.primaryArchetype];
        
        return res.json({
          algorithmVersion: 'v1',
          primaryArchetype: legacyResult.primaryArchetype,
          secondaryArchetype: legacyResult.secondaryArchetype,
          topArchetypes: null,
          affinityScore: legacyResult.affinityScore,
          opennessScore: legacyResult.opennessScore,
          conscientiousnessScore: legacyResult.conscientiousnessScore,
          emotionalStabilityScore: legacyResult.emotionalStabilityScore,
          extraversionScore: legacyResult.extraversionScore,
          positivityScore: legacyResult.positivityScore,
          totalQuestions: 12,
          chemistryList: chemistryList.map(c => ({
            role: c.archetype,
            percentage: c.percentage,
            reason: c.reason,
          })),
          archetypeTraitProfile: prototype?.traitProfile || null,
          matchDetails: null,
          isDecisive: false,
          completedAt: legacyResult.createdAt,
        });
      }
      
      return res.status(404).json({ 
        error: 'No completed assessment found', 
        hasCompletedTest: false 
      });
    } catch (error: any) {
      logger.error('[Unified Assessment Result] Error', { error: String(error) });
      res.status(500).json({ message: 'Failed to get result', error: error.message });
    }
  });

  // ============ Assessment Feedback Endpoint ============
  app.post('/api/assessment/feedback', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      const { archetype, accuracy } = req.body;
      
      if (!archetype || !accuracy) {
        return res.status(400).json({ message: 'Missing archetype or accuracy' });
      }
      
      if (!['accurate', 'partial', 'inaccurate'].includes(accuracy)) {
        return res.status(400).json({ message: 'Invalid accuracy value' });
      }

      logger.info(`[Assessment Feedback] User ${userId} rated ${archetype} as ${accuracy}`);
      
      // Store feedback for analysis (could be extended to save to DB)
      // For now, just log it for collection
      res.json({ success: true, message: 'Feedback recorded' });
    } catch (error: any) {
      logger.error('[Assessment Feedback] Error', { error: String(error) });
      res.status(500).json({ message: 'Failed to record feedback', error: error.message });
    }
  });
}
