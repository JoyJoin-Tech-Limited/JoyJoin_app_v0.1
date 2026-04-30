#!/usr/bin/env python3
"""Phase 1: Delete dead code from routes.ts"""

with open('routes.ts', 'r') as f:
    lines = f.readlines()

def delete_range(start, end):
    """Delete lines[start:end] (1-indexed, inclusive start, exclusive end)"""
    for i in range(start-1, end-1):
        lines[i] = None

# 1. Delete unused schemas and helpers (lines 509-593)
# This includes: empty /* */, interestSelectionSchema, topPrioritySchema, 
# userInterestsDataSchema, interestSignalSchema, deriveEnthusiasmFromHeat, 
# getOnboardingHeatForInterest, and the interest-signals placeholder comments
delete_range(509, 594)

# 2. Delete commented-out blind box blocks (lines 1308-1910)
# From first "// app.post('/api/blind-box-events'" to last "// app.post('/api/blind-box-events/:eventId/cancel'"
delete_range(1308, 1911)

# 3. Delete commented-out admin blind box blocks (lines 2226-2449)
delete_range(2226, 2450)

# 4. Delete duplicate GET /api/admin/events at line 4797
# Lines 4797-4807: the duplicate route + blank line
delete_range(4797, 4808)

# 5. Delete commented-out admin event-pools block (lines 4943-4966)
delete_range(4943, 4967)

# Filter out deleted lines
new_lines = [l for l in lines if l is not None]

with open('routes.ts', 'w') as f:
    f.writelines(new_lines)

print(f"Deleted {len(lines) - len(new_lines)} lines")
print(f"New line count: {len(new_lines)}")
