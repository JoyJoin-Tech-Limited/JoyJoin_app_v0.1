#!/usr/bin/env python3
"""
Robust domain extraction script for routes.ts.
"""

import os
from collections import defaultdict

with open('routes.ts', 'r') as f:
    lines = f.readlines()

def get_text(start_1idx, end_1idx_exclusive):
    return ''.join(lines[start_1idx - 1:end_1idx_exclusive - 1])

HELPERS = """
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

""" + HELPERS + "\n"

# Domain chunk definitions
# Format: (registrar_name, file_name, start_1idx, end_1idx_exclusive, is_new_file)
chunks = [
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
    ("registerPublicStatsRoutes", "publicStats", 3077, 3107, True),
    ("registerAdminLeftoverRoutes", "admin", 2250, 3077, False),
    ("registerReferralRoutes", "referrals", 1941, 2240, True),
    ("registerUserCoreChunk2bRoutes", "userCore", 1041, 1941, True),
    ("registerUserCoreRoutes", "userCore", 502, 651, True),
    ("registerUserCoreChunk1Routes", "userCore", 247, 490, True),
]

# Group chunks by file name
file_chunks = defaultdict(list)
for registrar, fname, start, end, is_new in chunks:
    file_chunks[fname].append((registrar, start, end, is_new))

# Process each file
for fname, chunk_list in file_chunks.items():
    filepath = f'routes/domains/{fname}.ts'
    chunk_list.sort(key=lambda x: x[1])
    is_new = chunk_list[0][3]
    
    if is_new:
        parts = [STANDARD_IMPORTS]
        for registrar, start, end, _ in chunk_list:
            text = get_text(start, end)
            parts.append(f'export function {registrar}(app: Express) {{\n{text}\n}}\n')
        full_content = '\n'.join(parts)
        with open(filepath, 'w') as f:
            f.write(full_content)
        total = sum(end - start for _, start, end, _ in chunk_list)
        print(f"Created {filepath} ({total} lines)")
    else:
        with open(filepath, 'r') as f:
            existing = f.read()
        existing_stripped = existing.rstrip()
        if existing_stripped.endswith('}'):
            existing_stripped = existing_stripped[:-1].rstrip()
        
        parts = [existing_stripped]
        needs_helpers = False
        for registrar, start, end, _ in chunk_list:
            text = get_text(start, end)
            if 'requireAuth' in text or 'getActingAdminId' in text or 'firstNonEmptyString' in text:
                needs_helpers = True
            parts.append(text)
        
        if needs_helpers and HELPERS.strip() not in existing:
            parts.insert(1, HELPERS)
        
        parts.append('}\n')
        new_content = '\n'.join(parts)
        with open(filepath, 'w') as f:
            f.write(new_content)
        total = sum(end - start for _, start, end, _ in chunk_list)
        print(f"Extended {filepath} ({total} lines)")

# Rebuild routes.ts with in-place replacements
replacement_map = {}
for registrar, fname, start, end, is_new in chunks:
    replacement_map[(start, end)] = f"  {registrar}(app);\n"

sorted_ranges = sorted(replacement_map.keys())
new_lines = []
last_end = 1
for start, end in sorted_ranges:
    new_lines.extend(lines[last_end - 1:start - 1])
    new_lines.append(replacement_map[(start, end)])
    last_end = end

new_lines.extend(lines[last_end - 1:])

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

import_lines = [i for i, line in enumerate(new_lines) if line.strip().startswith('import ') and 'register' in line and 'routes/domains' in line]
if import_lines:
    new_lines.insert(import_lines[-1] + 1, new_imports)

routes_content = ''.join(new_lines)

with open('routes.ts', 'w') as f:
    f.write(routes_content)

new_line_count = len(routes_content.split('\n'))
print(f"\nNew routes.ts line count: {new_line_count}")
