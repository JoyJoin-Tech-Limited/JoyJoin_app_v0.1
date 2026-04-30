#!/usr/bin/env python3
"""
Extract domain route groups from routes.ts into separate files under routes/domains/.
"""

import re
from pathlib import Path

with open('routes.ts', 'r') as f:
    lines = f.readlines()

# Shared imports block (lines 1-72 approx, before registerRoutes)
# We'll rebuild a clean import block for each domain later.

# Find the registerRoutes function start
register_routes_start = None
for i, line in enumerate(lines):
    if 'export async function registerRoutes' in line:
        register_routes_start = i
        break

# Setup code that stays in routes.ts (lines before first extractable domain)
# We'll keep everything from registerRoutes start up to line 246 (before AI Chat Registration)

# Domain definitions: (name, file_name, start_line_1indexed, end_line_1indexed_exclusive)
# We extract from BOTTOM to TOP so line numbers don't shift.
domains = [
    # Bottom sections first
    ("preEventAttendance", "blindBoxEvents", 8295, 8403),  # extend existing
    ("devTools", "devTools", 7980, 8295),
    ("xiaoyue", "xiaoyue", 7896, 7980),
    ("assessmentLeftovers", "assessmentV4", 7728, 7896),  # extend existing
    ("matchExplanations", "matchExplanations", 7183, 7651),
    ("aiServices", "aiServices", 6451, 7183),
    ("matchingConfig", "matchingConfig", 5882, 6451),
    ("moderation", "moderation", 6107, 6210),  # chat reports + moderation
    ("venues", "venues", 3184, 3952),  # venue management
    ("publicStats", "publicStats", 3077, 3184),
    ("referrals", "referrals", 1941, 2240),  # referrals + notifications + invitations
    ("adminLeftovers", "admin", 2240, 3077),  # extend existing admin
    ("userEventPools", "eventPools", 4317, 5578),  # extend existing eventPools
    ("adminEventPools", "eventPools", 3952, 4317),  # extend existing eventPools
    ("userCore", "userCore", 247, 1941),  # AI Chat + Registration + Profile + Events + Connections + Icebreakers
]

# Wait, we can't extract from bottom to top with fixed line numbers because we need
# to modify the file as we go. Instead, we'll extract all at once by marking lines.

# But the line ranges above are based on the CURRENT file (after Phase 1).
# We need to extract them all in one pass.

# Let me redefine more carefully, processing from bottom to top and adjusting.
