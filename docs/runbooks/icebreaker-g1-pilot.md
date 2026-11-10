# Icebreaker G1 Pilot Protocol — Paper Table + Manual Mutual Loop

> 2026-11-10 · G1 execution protocol
> Status: ready to run; **zero tables executed**. Do not treat any field below as measured data.
> Printable run pack: [`icebreaker-g1-pilot-kit.md`](./icebreaker-g1-pilot-kit.md) (scripts, cards, capture sheet, readout) + [`assets/icebreaker-g1-capture.csv`](./assets/icebreaker-g1-capture.csv) (per-table capture, headers only).

## Purpose

G1 is a feasibility rehearsal, not a powered experiment. It answers two questions before any software investment:

1. Can a six-person table run on paper cards with a **first-arrival light host** and no professional host, without freezing?
2. Does a manual 24h 0–5 mutual-selection loop feel acceptable to the table — especially to reserved/slow-warm participants?

G1 does not prove host incrementality. That is G2.

## Sample and setup

- 3 rehearsal tables × 6 real participants (18 seats), Shenzhen only.
- Same venue tier, same weekday evening band, same ¥88 ticket.
- Participants are real users or recruited testers; exclude staff, bots, and test pools from the analyzed set.
- 40-minute BREEZE paper deck: warmup → micro challenge → lie detective → recap. No auction, no mini_script.
- No professional host. The first person to arrive receives a one-page light-host card: 开场、翻牌、收尾. The role is voluntary and non-exclusive; anyone may flip the next card.
- One observer per table records timestamps; the observer does not facilitate.

## Staffing

| Role | Responsibility |
|---|---|
| Pilot DRI | Owns the run, go/no-go, and the readout |
| Safety/on-call operator | Handles distress, harassment, medical, or venue issues; can stop a table |
| Data owner | Owns the capture sheet, de-identifies it, computes the gate metrics |
| Venue BD | Confirms the room, welcome drink, and staff contact |
| Observer ×3 | One per table; records only, never hosts |

## Rehearsal capture sheet

Record per table:

- arrival order and who picked up the cards first
- light-host brief opened? (Y/N)
- natural opening happened within 2 minutes? (Y/N)
- cards skipped (count and which)
- longest silence (seconds)
- professional rescue needed? (Y/N; should be 0)
- handoff / second host occurred? (Y/N)
- participant count at start and at recap
- ops minutes (staff time per table, excluding observation)
- incidents / safety stops
- post-table: would attend again? (1–5), felt awkward? (Y/N), would recommend? (0–10)

## Manual mutual loop (2 tables)

Run the 24h loop by hand after two of the three tables:

1. Within 3 hours of the event, send each attendee a private form: “最多选 5 位想继续认识的人；双方都选，明晚 21:00 揭晓。”
2. Do not show who selected whom. Do not send reminders that imply popularity.
3. At the next 21:00 (Asia/Shanghai), reveal only mutual pairs by private message. No rejection copy.
4. Ask each participant one question: “如果下一桌还有这个环节，你愿意再用吗？” Include reserved/slow-warm participants first.
5. Record: selections per person, mutual pairs, mutual→actual WeChat exchange, zero-mutual participants, D1 return intent.

## G1 gate

All must hold:

- [ ] 3/3 tables complete the 40-minute run.
- [ ] ≤1 skipped card per table.
- [ ] No silence longer than 90 seconds.
- [ ] Professional rescue = 0. Natural light-host or tablemate intervention does not count as failure.
- [ ] Light-host card opened in 3/3 tables; natural opening (first card flipped without staff prompt) in 3/3 tables.
- [ ] Ops ≤20 minutes per table.
- [ ] ≥4/6 per table say they would attend again.
- [ ] Manual mutual loop: no privacy incident; zero-mutual participants do not report feeling punished; at least one mutual pair in each loop table.

If any safety/privacy incident occurs, stop G1 and escalate. Do not proceed to G2 on a “mostly passed” table.

## Readout artifact

One page, fixed fields:

- tables run / seats filled / eligible after exclusions
- gate checklist pass/fail per table
- longest silence, skipped cards, ops minutes
- manual loop: per-person selections, mutual pairs, mutual→WeChat
- three verbatims (positive, neutral, negative), de-identified
- decision: proceed to G2 / repeat G1 / stop

## What G1 does not decide

- Whether a professional host is worth paying for (G2).
- Whether the software phase engine should be deleted.
- Whether premium pricing works.
- Whether the 24h loop improves D7/D30 retention.

Those require G2/G3 and real cohorts.
