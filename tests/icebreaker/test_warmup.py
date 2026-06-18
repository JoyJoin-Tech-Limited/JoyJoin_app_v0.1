#!/usr/bin/env python3
"""Manual test for the Warmup phase of JoyJoin social icebreaker.

Tests:
  1. Login as host, create icebreaker session
  2. Generate warmup topics with a mood
  3. Host marks ready
  4. Login as second player, join session
  5. Second player marks ready
  6. Advance to next topic
  7. Advance phase (warmup -> micro_challenge)

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

# ── Configuration ──────────────────────────────────────────────────────────

# You must provide a valid group/event ID from your local DB.
# Run:  psql $DATABASE_URL -c "SELECT id FROM event_pool_groups LIMIT 5;"
SESSION_ID = input("Enter group/event ID (eventPoolGroups.id): ").strip()
if not SESSION_ID:
    print("[FAILED] No session ID provided.")
    sys.exit(1)

# ── Step 1: Login as Host ─────────────────────────────────────────────────

print_step(1, "Login as Host (完整资料_小柯)")
host = IcebreakerClient()
host.login("+8613800000001", "test123456", "测试小柯")

# ── Step 2: Create Icebreaker Session ─────────────────────────────────────

print_step(2, "Clean up any existing session, then create fresh")
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
    print("[FAILED] No socialSessionId returned. Cannot continue.")
    sys.exit(1)

current_phase = session_data.get("currentPhase", "")
validate_field(session_data, "currentPhase", str, "Phase")
if current_phase != "warmup":
    print(f"  [FAILED] Expected phase 'warmup', got '{current_phase}'")
    sys.exit(1)

input("\n  Press Enter to continue to Step 3...")

# ── Step 3: Generate Warmup Topics ────────────────────────────────────────

print_step(3, "Host generates warmup topics")
mood = input("  Choose mood (relaxed / funny / life / emotional) [relaxed]: ").strip() or "relaxed"
resp = host.social_api(f"{social_session_id}/topics", body={
    "mood": mood,
    "eventType": "活动",
    "participantCount": 2,
})
data = require_ok(resp)
topics = data.get("topics", [])
if not topics:
    print("  [FAILED] No topics returned")
    sys.exit(1)
print(f"  [SUCCESS] {len(topics)} topics generated:")
for i, t in enumerate(topics):
    print(f"           [{i}] {t.get('emoji', '')} {t.get('question', '?')}")

# ── Step 4: Host marks ready ─────────────────────────────────────────────

print_step(4, "Host marks ready for first topic")
resp = host.social_api(f"{social_session_id}/warmup/ready", body={"ready": True})
data = require_ok(resp)
ready_count = data.get("readyCount", 0)
all_ready = data.get("allReady", False)
print(f"  [SUCCESS] readyCount={ready_count}, allReady={all_ready}")

# ── Step 5: Login as Player 2 and Join ────────────────────────────────────

print_step(5, "Login as Player 2 (深聊_小考) and join session")
player2 = IcebreakerClient()
player2.login("+8613800000004", "test123456", "测试小考")

join_data = player2.start_icebreaker(
    icebreaker_session_id=SESSION_ID,
    display_name="测试小考",
)
print(f"  [SUCCESS] Player 2 joined session")

# ── Step 6: Player 2 marks ready ─────────────────────────────────────────

print_step(6, "Player 2 marks ready")
resp = player2.social_api(f"{social_session_id}/warmup/ready", body={"ready": True})
data = require_ok(resp)
ready_count = data.get("readyCount", 0)
all_ready = data.get("allReady", False)
print(f"  [SUCCESS] readyCount={ready_count}, allReady={all_ready}")
if not all_ready:
    print("  [WARN] Not all ready yet — checking if playerCount > 2")
    # Check the session state
    resp = host.social_api(f"{social_session_id}", method="GET")
    if resp.status_code == 200:
        state = resp.json()
        print(f"         playerCount={state.get('playerCount', '?')}")

input("\n  Press Enter to continue to Step 7...")

# ── Step 7: Advance to Next Topic ─────────────────────────────────────────

print_step(7, "Host advances to next topic")
resp = host.social_api(f"{social_session_id}/warmup/next-topic")
if resp.status_code == 400:
    data = resp.json()
    print(f"  [FAILED] Could not advance topic: {data.get('error', '')}")
    print("  [INFO] This is OK if there is only 1 topic available.")
    # This might fail if there's only 1 topic or not all are ready yet
    # Let's try to check the topic index
    resp2 = host.social_api(f"{social_session_id}", method="GET")
    if resp2.status_code == 200:
        state = resp2.json()
        idx = state.get("currentTopicIndex", 0)
        total = len(state.get("warmupTopics", []))
        print(f"         Current topic index: {idx}/{total-1}")
else:
    data = require_ok(resp)
    print(f"  [SUCCESS] Now on topic index {data.get('currentTopicIndex', '?')}")

input("\n  Press Enter to continue to Step 8...")

# ── Step 8: Both players ready + Advance phase ────────────────────────────

print_step(8, "Both ready then Host advances phase (warmup -> next)")

# Ensure both are ready
for client, name in [(host, "Host"), (player2, "Player 2")]:
    resp = client.social_api(f"{social_session_id}/warmup/ready", body={"ready": True})
    if resp.status_code == 200:
        print(f"  [SUCCESS] {name} ready confirmed")
    else:
        print(f"  [WARN] {name} ready response: HTTP {resp.status_code}")

# Advance out of warmup
advance_data = host.advance_phase(social_session_id, "warmup")
if advance_data.get("nextPhase"):
    print(f"\n  >>> WARMUP PHASE TEST PASSED <<<")
    print(f"  >>> Advanced to: {advance_data['nextPhase']} <<<")
else:
    print(f"\n  >>> WARMUP PHASE TEST COMPLETED (see result above) <<<")
