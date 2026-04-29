---
name: grill-me
description: >
  Relentless one-question-at-a-time interview about a plan or design.
  Walks every branch of the decision tree with recommended answers.
  Use when user says "grill me", "stress-test my plan",
  "interview me about this design", or "grill this plan".
---

# Grill-Me

Interview the user relentlessly about every aspect of a plan until shared
understanding is reached. Resolve each branch of the design tree one-by-one.

## Rules

- One question per response
- Provide a recommended answer with each question
- Explore the codebase instead of asking when a question can be answered there
- Do not stop until every branch is resolved or user explicitly ends the session

## When to use

- User has a plan or design and wants every assumption challenged
- Pre-execution stress-test of API contracts, state machines, or UX flows
- Narrowing a vague idea into concrete scope before kickoff

## When NOT to use

- Open-ended brainstorming (use `process-brainstorming`)
- Full kickoff discovery with no existing plan (use `Researcher` → `Planner`)
- User wants a quick yes/no on a single decision

## Examples

**API design review**
> Q1: Who owns the write — server or client? Recommended: server, with idempotency key.

**Feature scope review**
> Q1: Is this mini-program primary or web primary? Recommended: mini-program; web follows.

## Troubleshooting

**User gives one-word answers**
Expand the question with concrete options. "Server or client?" → "Server-generated with client cache, or client-driven with server validation?"

**Plan is too vague to grill**
Switch to `process-brainstorming` or route to `Researcher` for discovery first.

## Review checklist

- [ ] One question per turn
- [ ] Recommended answer included with each question
- [ ] Codebase explored before asking when possible
- [ ] Session ends only when user says so or all branches resolved
