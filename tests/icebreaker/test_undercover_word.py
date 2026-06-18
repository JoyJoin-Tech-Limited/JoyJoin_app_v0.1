#!/usr/bin/env python3
"""Manual test for the Undercover Word phase (needs minPlayers=3).

Flow:
   1. Login 3 players, create session
   2. Force phase to undercover_word
   3. Generate word pair
   4. Each player describes their word
   5. Vote for the undercover player
   6. Reveal result
   7. Advance out
"""

import sys, time
from icebreaker_common import IcebreakerClient, print_step, require_ok

SESSION_ID = input("Enter group/event ID: ").strip()
if not SESSION_ID:
    print("[FAILED] No session ID"); sys.exit(1)

PLAYERS = [
    ("+8613800000001", "test123456", "测试小柯"),
    ("+8613800000003", "test123456", "测试太阳鸡"),
    ("+8613800000004", "test123456", "测试树洞考拉"),
]

# ── Step 1: Login all ──
print_step(1, "Login 3 players, create session")
host = IcebreakerClient()
host.login(PLAYERS[0][0], PLAYERS[0][1], PLAYERS[0][2])
host.cleanup_session(SESSION_ID)
sd = host.start_icebreaker(SESSION_ID, PLAYERS[0][2], event_tier="glow", vibe="balanced")
sid = sd["socialSessionId"]
assert sd["currentPhase"] == "warmup"

clients = [host]
for i in range(1, 3):
    c = IcebreakerClient()
    c.login(PLAYERS[i][0], PLAYERS[i][1], PLAYERS[i][2])
    c.start_icebreaker(SESSION_ID, PLAYERS[i][2])
    clients.append(c)

# ── Step 2: Force to undercover_word ──
print_step(2, "Force phase to undercover_word")
host.force_phase(SESSION_ID, "undercover_word")

# ── Step 3: Generate word pair ──
print_step(5, "Generate word pair")
resp = host.social_api(f"{sid}/undercover-word/generate")
if resp.status_code == 202:
    time.sleep(3)
    resp = host.social_api(f"{sid}/undercover-word/generate")
data = require_ok(resp)
print(f"  Undercover: {data.get('undercoverWord','?')} / Common: {data.get('commonWord','?')}")

# ── Step 4: Each player describes ──
print_step(6, "Each player describes their word")
for i, c in enumerate(clients):
    desc = input(f"  {PLAYERS[i][2]}: description text [{PLAYERS[i][2]}的描述]: ").strip() or f"{PLAYERS[i][2]}的描述"
    resp = c.social_api(f"{sid}/undercover-word/describe",
        body={"description": desc, "operationId": f"uw-{c.user_id[:8]}-{int(time.time())}"})
    print(f"    {'OK' if resp.status_code==200 else f'HTTP {resp.status_code}'}")

# ── Step 5: Vote ──
print_step(7, "All vote for who is the undercover")
for i, c in enumerate(clients):
    others = [cc for cc in clients if cc != c]
    vote_ix = int(input(f"  {PLAYERS[i][2]}: vote for player index [0-2] excluding self [(i+1)%3]: ").strip() or str((i+1)%3))
    target = clients[vote_ix]
    resp = c.social_api(f"{sid}/undercover-word/vote",
        body={"targetUserId": target.user_id, "operationId": f"uwv-{c.user_id[:8]}-{int(time.time())}"})
    print(f"    Voted for {PLAYERS[vote_ix][2]}")

# ── Step 6: Reveal ──
print_step(8, "Reveal result (host only)")
resp = host.social_api(f"{sid}/undercover-word/reveal")
data = require_ok(resp)
print(f"  Undercover was: {data.get('undercoverUserId','?')[:8]} (index {[c.user_id for c in clients].index(data.get('undercoverUserId','')) if data.get('undercoverUserId') in [c.user_id for c in clients] else '?'})")
print(f"  Correct votes: {data.get('correctVoteCount',0)}/{data.get('voteCount',0)}")

# ── Step 7: Advance out ──
print_step(9, "Advance out")
adv = host.advance_phase(sid, "undercover_word")
print(f"  Next: {adv.get('nextPhase','?')}")

print(f"\n  >>> UNDERCOVER WORD TEST PASSED <<<")
