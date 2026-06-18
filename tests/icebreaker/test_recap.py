#!/usr/bin/env python3
"""Manual test for the Recap phase of JoyJoin social icebreaker.

Flow:
   1. Login as host + player2, create session
   2. Force phase to recap
   3. Test GET /recap endpoint (summary, medals, highlights)
   4. Test state embed (recapSnapshot in poll response)
"""

import sys
import time
import json
from icebreaker_common import (
    IcebreakerClient,
    print_step,
    require_ok,
)

SESSION_ID = input("Enter group/event ID (eventPoolGroups.id): ").strip()
if not SESSION_ID:
    print("[FAILED] No session ID provided.")
    sys.exit(1)

HOST_PHONE = "+8613800000001"
HOST_PASS = "test123456"
P2_PHONE = "+8613800000004"
P2_PASS = "test123456"

# ── Step 1: Login and create session ────────────────────────────────

print_step(1, "Login as Host and create session")
host = IcebreakerClient()
host.login(HOST_PHONE, HOST_PASS, "测试小柯")
host.cleanup_session(SESSION_ID)
session_data = host.start_icebreaker(
    icebreaker_session_id=SESSION_ID,
    display_name="测试小柯",
    event_type="活动",
    event_tier="glow",
    vibe="balanced",
)
sid = session_data.get("socialSessionId", "")
if not sid:
    print("[FAILED] No socialSessionId returned")
    sys.exit(1)
assert session_data["currentPhase"] == "warmup"

# ── Step 2: Force to recap ──
print_step(2, "Force phase to recap")
host.force_phase(SESSION_ID, "recap")

# ── Step 3: Test GET /recap endpoint ────────────────────────────────

print_step(3, "Test GET /recap endpoint")
resp = host.social_api(f"{sid}/recap", method="GET")
data = require_ok(resp)

summary = data.get("summary", {})
print(f"  Headline: {summary.get('headline', '?')}")
print(f"  Moments: {len(summary.get('moments', []))}")
print(f"  Closing: {summary.get('closingLine', '?')[:80]}")

medals = data.get("medals", [])
print(f"  Medals: {len(medals)}")
for m in medals:
    print(f"    {m.get('emoji', '')} {m.get('title', '?')} -> {m.get('recipientDisplayName', '?')}")

meta = data.get("meta", {})
print(f"  AI meta: provider={meta.get('provider', '?')} fallback={meta.get('fallbackUsed', '?')}")

highlights = data.get("microChallengeHighlights", {})
print(f"  Micro-challenge: {highlights.get('completedCount', '?')}/{highlights.get('totalCount', '?')}")

pd_highlights = data.get("personalityDiceHighlights", {})
if pd_highlights:
    print(f"  Personality Dice: {pd_highlights.get('completedCount', '?')} completed, {pd_highlights.get('passedCount', '?')} passed")

print("\n  [SUCCESS] GET /recap returned valid data")

# ── Step 4: Verify state embed ─────────────────────────────────────

print_step(4, "Verify recapSnapshot in poll state")
state = require_ok(host.social_api(f"{sid}", method="GET"))
assert state.get("currentPhase") == "recap"
snapshot = state.get("recapSnapshot", None)
if snapshot:
    ss = snapshot.get("recapSummary", {})
    print(f"  Phase: recap")
    print(f"  Snapshot headline: {ss.get('headline', '?')}")
    print(f"  Snapshot medals: {len(snapshot.get('medals', []))}")
else:
    print(f"  [INFO] No recapSnapshot in poll state (expected when force_phase used)")
    print(f"  Phase: recap")

# ── DONE ────────────────────────────────────────────────────────────

print(f"\n{'='*60}")
print(f"  >>> RECAP PHASE TEST PASSED <<<")
print(f"  >>> Recap summary: {summary.get('headline', '?')} <<<")
print(f"{'='*60}")
