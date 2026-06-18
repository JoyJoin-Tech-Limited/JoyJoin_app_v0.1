#!/usr/bin/env python3
"""Manual test for the Lie Detective phase (V1 mode).

Requires 3 players (lie_detective needs minPlayers=3).

Flow:
   1. Login host + 2 players (3 total), create session
   2. Force phase to lie_detective
   3. Each player generates statements (V1, default)
   4. For each player's turn: vote, auto-reveal, next player
   5. Advance out
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

# ── Step 1: Login all players, host creates session ──
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

# ── Step 2: Force to lie_detective ──
print_step(2, "Force phase to lie_detective")
host.force_phase(SESSION_ID, "lie_detective")

# ── Step 3: Generate statements (V1) ──
print_step(3, "Each player generates lie statements (V1)")
roster = []
for i, c in enumerate(clients):
    resp = c.social_api(f"{sid}/lie-detective/generate",
        body={"displayName": PLAYERS[i][2]})
    data = require_ok(resp)
    stmts = data.get("statements", [])
    roster.append({"userId": c.user_id, "displayName": PLAYERS[i][2]})
    print(f"  {PLAYERS[i][2]}: {len(stmts)} statements generated")
    for s in stmts:
        print(f"    [{s.get('index')}] {s.get('text','?')}")

# ── Step 4: Vote rounds ──
print_step(4, "Vote rounds (each player takes a turn)")
for target_idx in range(3):
    target = roster[target_idx]
    print(f"\n  --- Turn: {target['displayName']} ---")
    other_clients = [c for i, c in enumerate(clients) if i != target_idx]
    other_roster = [r for i, r in enumerate(roster) if i != target_idx]

    for c in other_clients:
        voter_name = next(r["displayName"] for r in other_roster if r["userId"] == c.user_id)
        guess = input(f"  {voter_name}: guess 0/1/2 [0]: ").strip() or "0"
        resp = c.social_api(f"{sid}/lie-detective/vote",
            body={"targetUserId": target["userId"], "guessedStatementIndex": int(guess)})
        data = resp.json()
        print(f"    Vote registered. Revealed: {data.get('isRevealed', False)}")

        if data.get("isRevealed"):
            rev = data.get("reveal", {})
            print(f"  >>> Revealed! Lie=statement[{rev.get('lieIndex','?')}]")
            print(f"      Correct votes: {rev.get('correctVoteCount',0)}/{rev.get('voteCount',0)}")

    input("  Press Enter for next player...")
    if target_idx < 2:
        resp = host.social_api(f"{sid}/lie-detective/next-player")
        data = resp.json()
        print(f"  Next player index: {data.get('currentLieDetectivePlayerIndex','?')}")

# ── Step 5: Advance out ──
print_step(5, "Advance out of lie_detective")
adv = host.advance_phase(sid, "lie_detective")
print(f"  Next: {adv.get('nextPhase','?')}")

print(f"\n  >>> LIE DETECTIVE TEST PASSED <<<")
