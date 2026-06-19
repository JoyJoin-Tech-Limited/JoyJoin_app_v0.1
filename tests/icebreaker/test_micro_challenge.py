#!/usr/bin/env python3
"""Manual test for the Micro Challenge phase of JoyJoin social icebreaker.

Tests:
  1. Login as host, create icebreaker session
   2. Force phase to micro_challenge
   3. Generate micro-challenge (or it may auto-generate on advance)
   4. All players complete the challenge
   5. Advance phase (micro_challenge -> next)

Requires:
  - npm run dev:server running on localhost:5001
  - npm run seed:test-data (for test users)
  - A valid event pool group ID from the database
"""

import sys
import time
from icebreaker_common import (
    IcebreakerClient,
    print_step,
    validate_field,
    require_ok,
)

SESSION_ID = input("Enter group/event ID (eventPoolGroups.id): ").strip()
if not SESSION_ID:
    print("[FAILED] No session ID provided.")
    sys.exit(1)

# ── Step 1: Login and Create Session ──────────────────────────────────────

print_step(1, "Login as Host (完整资料_小柯) and create session")
host = IcebreakerClient()
host.login("+8613800000001", "test123456", "测试小柯")

host.cleanup_session(SESSION_ID)
session_data = host.start_icebreaker(
    icebreaker_session_id=SESSION_ID,
    display_name="测试小柯",
    event_type="活动",
    event_tier="glow",
    vibe="balanced",
)
social_session_id = session_data.get("socialSessionId", "")
if not social_session_id:
    print("[FAILED] No socialSessionId returned")
    sys.exit(1)

current_phase = session_data.get("currentPhase", "")
validate_field(session_data, "currentPhase", str, "Phase")
if current_phase != "warmup":
    print(f"  [INFO] Phase is '{current_phase}', not warmup — continuing anyway")

# ── Step 2: Force to micro_challenge ──
print_step(2, "Force phase to micro_challenge")
host.force_phase(SESSION_ID, "micro_challenge")

# ── Step 3: Second player joins ──

print_step(3, "Login as Player 2 (深聊_小考) and join session")
player2 = IcebreakerClient()
player2.login("+8613800000004", "test123456", "测试小考")
player2.start_icebreaker(icebreaker_session_id=SESSION_ID, display_name="测试小考")
print("  [SUCCESS] Player 2 joined")

# ── Step 4: Login as Player 2 and join session, then both generate challenge ──
resp = host.social_api(f"{social_session_id}/micro-challenge/generate")
if resp.status_code == 202:
    print("  [INFO] Challenge is being generated (202), waiting 3s and retrying...")
    time.sleep(3)
    resp = host.social_api(f"{social_session_id}/micro-challenge/generate")

data = require_ok(resp)
challenge = data.get("challenge")
if not challenge:
    print("  [FAILED] No challenge in response")
    sys.exit(1)

print(f"  [SUCCESS] Challenge ready:")
print(f"           Title:     {challenge.get('title', '?')}")
print(f"           Duration:  {challenge.get('durationSeconds', '?')}s")
print(f"           CTA:       {challenge.get('completionCTA', '?')}")
print(f"           Visual:    {challenge.get('visualHint', '?')}")
print(f"           Fallback:  {data.get('meta', {}).get('fallbackUsed', '?')}")

input(f"\n  [{challenge.get('completionCTA', 'Complete the challenge!')}]")
print("  Press Enter after completing the challenge...")

# ── Step 5: Both players complete the challenge ───────────────────────────

print_step(5, "Both players complete the challenge")

for client, name in [(host, "Host"), (player2, "Player 2")]:
    op_id = f"mc-{name.lower()}-{int(time.time())}"
    resp = client.social_api(f"{social_session_id}/micro-challenge/complete", body={"operationId": op_id})
    if resp.status_code == 200:
        data = resp.json()
        print(f"  [SUCCESS] {name} completed (completedCount={data.get('completedCount', '?')}/{data.get('totalCount', '?')})")
    else:
        print(f"  [WARN] {name} complete: HTTP {resp.status_code}")

# ── Step 6: Advance phase ─────────────────────────────────────────────────

print_step(6, "Host advances out of micro_challenge")
advance_data = host.advance_phase(social_session_id, "micro_challenge")
next_phase = advance_data.get("nextPhase", "")

if next_phase:
    print(f"\n  >>> MICRO_CHALLENGE PHASE TEST PASSED <<<")
    print(f"  >>> Advanced to: {next_phase} <<<")
else:
    # Check if timer-expired guard blocked us
    print(f"  [INFO] Advance response: {advance_data}")
    # Try polling state
    state_resp = host.social_api(f"{social_session_id}", method="GET")
    if state_resp.status_code == 200:
        state = state_resp.json()
        print(f"  Current phase: {state.get('currentPhase', '?')}")
