#!/usr/bin/env python3
"""
Extract domain route groups from routes.ts into separate files.
Uses in-place replacement to preserve registration order.
"""

import os

with open('routes.ts', 'r') as f:
    lines = f.readlines()

def get_text(start_1idx, end_1idx_exclusive):
    return ''.join(lines[start_1idx - 1:end_1idx_exclusive - 1])

# Standard imports for new files
STANDARD_IMPORTS = """import type { Express, Request } from "express";
import { db } from "../../db";
import { storage } from "../../storage";
import { z } from "zod";
import { eq, or, and, desc, inArray, gt, sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "@shared/schema";
import {
  updateProfileSchema, updateFullProfileSchema, insertEventFeedbackSchema,
  insertChatReportSchema, insertChatLogSchema, events, users, eventPools,
  eventPoolRegistrations, eventPoolGroups, poolAICopy, insertEventPoolSchema,
  invitations, invitationUses, matchingThresholds, poolMatchingLogs,
  blindBoxEvents, referralCodes, referralConversions, assessmentSessions,
  industryAiLogs, industrySeedCandidates, userInterests, userInterestSignals,
  venues, venueTimeSlots, matchHistory, connections, reports, payments,
  type ChatMessage, type User
} from "@shared/schema";
import { isPhoneAuthenticated } from "../../phoneAuth";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { getAuthenticatedUserId } from "../../lib/requestAuth";
import { logger } from "../../lib/logger";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import { broadcastEventStatusChanged, broadcastAdminAction, broadcastAttendanceStatusUpdated } from "../../eventBroadcast";
import { aiEndpointLimiter, kpiEndpointLimiter } from "../../rateLimiter";
import { checkUserAbuse, resetConversationTurns, recordTokenUsage } from "../../abuseDetection";
import { eventCreditsRepo } from "../../repositories/eventCreditsRepo";
import { matchIndustryFromText } from "../../inference/industryOntology";
import { INDUSTRY_OPTIONS } from "@shared/constants";
import { formatAge } from "@shared/utils";
import type { GroupAnalysisResponse } from "@shared/types/groupAnalysis";
import { isDevAuthToolsEnabled } from "../../auth/policy";
import { buildEventPoolRegistrationInsert } from "../../lib/eventPoolRegistration";
import { venueMatchingService } from "../../venueMatchingService";
import { calculateUserMatchScore, matchUsersToGroups, validateWeights, DEFAULT_WEIGHTS, type MatchingWeights } from "../../userMatchingService";
import { matchEventPool, saveMatchResults } from "../../poolMatchingService";
import { ARCHETYPE_NAMES } from "../../archetypeConfig";
import type { ArchetypeName } from "../../archetypeConfig";
import { enrichProfileFromRegistration } from "../../lib/profileEnrichment";
import { recordPoolCardCopyCache } from "../../middleware/metrics";
import { describePoolRegistrationAvailability } from "../../lib/poolRegistrationRules";
import { getMatchingMetricsSnapshot } from "../../matchingMetrics";
import { queueSemanticProfileRecompute } from "../../userSemanticProfileService";
import {
  assertValidTransition as assertValidEventPoolTransition,
  InvalidTransitionError as InvalidPoolTransitionError,
} from "../../lib/stateTransitions";
import {
  checkVenueDataQuality,
  normalizeVenueQualityRecord,
} from "../../lib/venueDataQuality";
import { normalizeProfileInterests, validateTelemetry } from "@shared/interests";
import { getArchetypeFamily } from "@shared/archetypeColors";

async function requireAuth(req: Request, res: any, next: any) {
  if (!getAuthenticatedUserId(req)) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

function getActingAdminId(req: any): string {
  return req.adminAccount?.id ?? req.session?.userId ?? "unknown";
}

function firstNonEmptyString(...values: Array<string | null | undefined>): string | undefined {
  return values.find((v) => v && v.trim().length > 0);
}

"""

# Domain definitions with exact line ranges in CURRENT file
# Format: (registrar_name, file_name, start_1idx, end_1idx_exclusive, is_new_file)
domains = [
    ("registerPreEventAttendanceRoutes", "blindBoxEvents", 8295, 8399, False),
    ("registerDevToolsRoutes", "devTools", 7980, 8295, True),
    ("registerXiaoyueRoutes", "xiaoyue", 7896, 7980, True),
    ("registerAssessmentLeftoverRoutes", "assessmentV4", 7728, 7896, False),
    ("registerKpiDashboardRoutes", "admin", 7651, 7728, False),
    ("registerMatchExplanationRoutes", "matchExplanations", 7183, 7651, True),
    ("registerAIServiceRoutes", "aiServices", 6451, 7183, True),
    ("registerModerationRoutes", "moderation", 6107, 6451, True),
    ("registerMatchingConfigRoutes", "matchingConfig", 5882, 6107, True),
    ("registerAdminOpsRoutes", "admin", 5578, 5882, False),
    ("registerUserEventPoolRoutes", "eventPools", 4317, 5578, False),
    ("registerAdminEventPoolRoutes", "eventPools", 3952, 4317, False),
    ("registerVenueRoutes", "venues", 3184, 3952, True),
    ("registerPublicStatsRoutes", "publicStats", 3077, 3184, True),
    ("registerAdminLeftoverRoutes", "admin", 2250, 3077, False),
    ("registerReferralRoutes", "referrals", 1941, 2240, True),
    ("registerUserCoreRoutes", "userCore", 502, 1941, True),
    ("registerUserCoreChunk1Routes", "userCore", 247, 490, True),
]

# Extract domains to files
for registrar, fname, start, end, is_new in domains:
    text = get_text(start, end)
    filepath = f'routes/domains/{fname}.ts'
    
    if is_new:
        full_content = STANDARD_IMPORTS + f'export function {registrar}(app: Express) {{\n{text}\n}}\n'
        with open(filepath, 'w') as f:
            f.write(full_content)
        print(f"Created {filepath} ({end-start} lines)")
    else:
        with open(filepath, 'r') as f:
            existing = f.read()
        existing_stripped = existing.rstrip()
        if existing_stripped.endswith('}'):
            existing_stripped = existing_stripped[:-1].rstrip()
        new_content = existing_stripped + '\n' + text + '\n}\n'
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Extended {filepath} ({end-start} lines)")

# Now rebuild routes.ts with in-place replacements
# We replace each extracted chunk with its registrar call
replacement_map = {}
for registrar, fname, start, end, is_new in domains:
    replacement_map[(start, end)] = f"  {registrar}(app);\n"

# Sort by start line (ascending) and apply replacements
sorted_ranges = sorted(replacement_map.keys())
new_lines = []
last_end = 1  # 1-indexed
for start, end in sorted_ranges:
    # Add lines before this range
    new_lines.extend(lines[last_end - 1:start - 1])
    # Add replacement call
    new_lines.append(replacement_map[(start, end)])
    last_end = end

# Add remaining lines after last range
new_lines.extend(lines[last_end - 1:])

routes_content = ''.join(new_lines)

# Add new imports
new_imports = """import { registerUserCoreRoutes } from "./routes/domains/userCore";
import { registerReferralRoutes } from "./routes/domains/referrals";
import { registerPublicStatsRoutes } from "./routes/domains/publicStats";
import { registerVenueRoutes } from "./routes/domains/venues";
import { registerMatchingConfigRoutes } from "./routes/domains/matchingConfig";
import { registerModerationRoutes } from "./routes/domains/moderation";
import { registerAIServiceRoutes } from "./routes/domains/aiServices";
import { registerMatchExplanationRoutes } from "./routes/domains/matchExplanations";
import { registerXiaoyueRoutes } from "./routes/domains/xiaoyue";
import { registerDevToolsRoutes } from "./routes/domains/devTools";
"""

# Insert after last existing register import
import_lines = [i for i, line in enumerate(new_lines) if line.strip().startswith('import ') and 'register' in line and 'routes/domains' in line]
if import_lines:
    new_lines.insert(import_lines[-1] + 1, new_imports)

routes_content = ''.join(new_lines)

with open('routes.ts', 'w') as f:
    f.write(routes_content)

new_line_count = len(routes_content.split('\n'))
print(f"\nNew routes.ts line count: {new_line_count}")
