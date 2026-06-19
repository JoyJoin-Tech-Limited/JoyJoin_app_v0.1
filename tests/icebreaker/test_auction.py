#!/usr/bin/env python3
"""Manual test for the Auction phase.

Requires 3 players (auction needs minPlayers=3).

Flow:
   1. Login 3 players, create session
   2. Force phase to auction
   3. Generate auction lots
   4. Players bid on current lot
   5. Host closes lot
   6. Repeat for all lots
   7. Advance out
"""

import json, sys, time
from icebreaker_common import IcebreakerClient, print_step, require_ok

SESSION_ID = input("Enter group/event ID: ").strip()
if not SESSION_ID:
    print("[FAILED] No session ID"); sys.exit(1)

PLAYERS = [
    ("+8613800000001", "test123456", "测试小柯"),
    ("+8613800000003", "test123456", "测试太阳鸡"),
    ("+8613800000004", "test123456", "测试树洞考拉"),
]

# ── Step 1: Login all 3 ──
print_step(1, "Login 3 players")
clients = []
for i, (ph, pw, nm) in enumerate(PLAYERS):
    c = IcebreakerClient()
    c.login(ph, pw, nm)
    clients.append(c)

host = clients[0]
host.cleanup_session(SESSION_ID)
sd = host.start_icebreaker(SESSION_ID, PLAYERS[0][2], event_tier="blaze", vibe="balanced")
sid = sd["socialSessionId"]
for i in range(1, 3):
    clients[i].start_icebreaker(SESSION_ID, PLAYERS[i][2])

# ── Step 2: Force to auction ──
print_step(2, "Force phase to auction")
host.force_phase(SESSION_ID, "auction")

# ── Step 3: Generate lots ──
print_step(3, "Generate auction lots")
resp = host.social_api(f"{sid}/auction/generate-lots")
data = require_ok(resp)
lots = data.get("lots", [])
balances = data.get("balances", {})
print(f"  {len(lots)} lots generated")
for i, lot in enumerate(lots):
    print(f"  Lot {i}: {lot.get('emoji','')} {lot.get('title','?')}")
print(f"  Balances: {json.dumps(balances)}")

# ── Step 4: Bid + close loop ──
print_step(4, "Bid and close lots")
for li in range(len(lots)):
    print(f"\n  --- Lot {li}: {lots[li].get('title','?')} ---")
    input("  Press Enter to bid...")
    for idx, c in enumerate(clients):
        base = 10 + idx * 5
        amt = int(input(f"  {c.display_name}: bid amount [{base}]: ").strip() or str(base))
        resp = c.social_api(f"{sid}/auction/bid", body={"amount": amt})
        if resp.status_code == 200:
            d = resp.json()
            hb = d.get("highBid", {})
            print(f"    Current high: {hb.get('userId','?')[:8]} @ {hb.get('amount',0)}")
        else:
            err = resp.json().get("error", "")
            print(f"    Bid rejected: HTTP {resp.status_code} ({err})")
    input("  Press Enter for host to close lot...")
    resp = host.social_api(f"{sid}/auction/close-lot")
    data = resp.json()
    print(f"  Lot closed. All closed: {data.get('allLotsClosed', False)}")

# ── Step 5: Advance out ──
print_step(5, "Advance out of auction")
adv = host.advance_phase(sid, "auction")
print(f"  Next: {adv.get('nextPhase','?')}")

print(f"\n  >>> AUCTION TEST PASSED <<<")
