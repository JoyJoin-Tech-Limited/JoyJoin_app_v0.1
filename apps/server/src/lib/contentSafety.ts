import { filterContent, ViolationType } from "../contentFilter";
import { db } from "../db";
import { contentFilterLogs } from "@shared/schema";
import { logger } from "./logger";

export interface ContentSafetyResult {
  safe: boolean;
  code?: "CONTENT_VIOLATION";
  violation?: {
    type: ViolationType;
    severity: "warning" | "severe";
    field: string;
    message: string;
    matchedKeywords: string[];
  };
}

export function validateContentSafe(text: string, field: string): ContentSafetyResult {
  if (!text || text.trim().length === 0) {
    return { safe: true };
  }

  const filterResult = filterContent(text);

  if (!filterResult.isViolation) {
    return { safe: true };
  }

  const violation = {
    type: filterResult.violationType!,
    severity: filterResult.severity as "warning" | "severe",
    field,
    message: filterResult.message || "内容包含不当用语，请修改后重试",
    matchedKeywords: filterResult.matchedKeywords,
  };

  createContentViolationLog(violation);

  return {
    safe: false,
    code: "CONTENT_VIOLATION",
    violation,
  };
}

export function contentViolationResponse(
  violation: NonNullable<ContentSafetyResult["violation"]>
) {
  return {
    status: 400 as const,
    body: {
      error: violation.message,
      code: "CONTENT_VIOLATION" as const,
      violation,
    },
  };
}

export function createContentViolationLog(
  violation: NonNullable<ContentSafetyResult["violation"]>,
  meta?: { userId?: string; route?: string; userAgent?: string }
): void {
  // Fire-and-forget: log the blocked attempt without blocking the response
  db.insert(contentFilterLogs)
    .values({
      userId: meta?.userId ?? null,
      field: violation.field,
      violationType: violation.type,
      severity: violation.severity,
      matchedKeywords: violation.matchedKeywords,
      inputPreview: violation.message.slice(0, 200),
      source: meta?.route ?? null,
    })
    .execute()
    .catch((err: unknown) => {
      logger.warn("Failed to write content filter log", { error: String(err) });
    });
}
