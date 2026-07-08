/**
 * AIGC compliance types shared between server and mini-program.
 *
 * The canonical AIGCMeta definition lives in `@shared/types/aiMeta` and is
 * emitted by AI services. This module re-exports it for API consumers and
 * adds the reporting contract shape.
 */

import { z } from 'zod';
import type { AIGCMeta } from '../types/aiMeta.js';

export type {
  AIGCMeta,
  AIResponseMeta,
  AIProvider,
  LiveAIProvider,
} from '../types/aiMeta.js'

export {
  buildAIGCMeta,
  buildLiveAIMeta,
  buildCachedAIMeta,
  buildFallbackAIMeta,
} from '../types/aiMeta.js'

/** Normalized AIGC label variants. */
export type AIGCLabelVariant = 'generated' | 'augmented'

/** Copy strings for AIGC labels. */
export const AIGC_LABEL_COPY: Record<AIGCLabelVariant, string> = {
  generated: 'AI 生成内容',
  augmented: 'AI 辅助生成',
}

/** Report category for AI-generated content. */
export const AI_CONTENT_REPORT_CATEGORY = 'ai_content' as const

/** Request body for POST /api/reports. */
export const createReportRequestSchema = z.object({
  category: z.enum([
    AI_CONTENT_REPORT_CATEGORY,
    'harassment',
    'inappropriate_content',
    'fake_profile',
    'other',
  ]),
  description: z.string().trim().min(1, '请填写举报内容').max(2000, '举报内容过长'),
  /** Optional event/pool context. */
  relatedEventId: z.string().optional(),
  /** Optional user context when reporting content attributed to a specific user. */
  reportedUserId: z.string().optional(),
});

export type CreateReportRequest = z.infer<typeof createReportRequestSchema>;

/** Query parameters for GET /api/admin/reports/ai-content. */
export const aiContentReportListQuerySchema = z.object({
  status: z.enum(['pending', 'reviewing', 'resolved', 'dismissed']).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export type AIContentReportListQuery = z.infer<typeof aiContentReportListQuerySchema>;

/** Request body for POST /api/reports when reporting AI-generated content. */
export interface CreateAIContentReportRequest {
  category: typeof AI_CONTENT_REPORT_CATEGORY
  description: string
  /** Optional event context, e.g. poolId or eventId. */
  relatedEventId?: string
  /** Optional user context when reporting content attributed to a specific user. */
  reportedUserId?: string
}

/** Pick the right client label variant from server AIGCMeta. */
export function resolveAIGCLabelVariant(meta?: AIGCMeta): AIGCLabelVariant {
  if (!meta) return 'generated'
  return meta.labelType === 'ai-assisted' ? 'augmented' : 'generated'
}

/** Should a surface show an AIGC label for this meta? */
export function shouldShowAIGCLabel(meta?: AIGCMeta): boolean {
  if (!meta) return false
  return meta.aiGenerated === true
}
