# Skill Authoring Examples

Practical examples for writing, improving, and auditing skills.

---

## 1. Strong vs weak frontmatter description

### Weak
```yaml
description: >-
  Covers authentication, session handling, API route gating, webhook signature
  verification, and dev auth surface isolation.
```
Problem: explains coverage but not **when** to use it and has no trigger phrases.

### Strong
```yaml
description: >-
  Policy-based auth gating, typed session contracts, dev/debug isolation, and
  fail-closed handling for sensitive flows. Use when adding API routes, auth
  checks, or dev tooling. Trigger phrases: "gate this route for admin only",
  "add an auth check", "register a dev-only endpoint", "verify a webhook
  signature", "fail safely on auth error".
```
Why it works: explains what + when + has explicit trigger phrases. Under 1024 chars.

---

## 2. Weak vs strong "When to use this skill" section

### Weak
```markdown
## When to use this skill

Use this skill when working with authentication.
```

### Strong
```markdown
## When to use this skill

- Adding or reviewing a new API route that requires auth or admin gating
- Implementing webhook signature verification
- Adding a dev-only or debug auth surface
- Reviewing a PR for auth boundary regressions
- Ensuring a sensitive flow fails closed rather than open
```
Why it works: concrete scenarios, not a vague one-liner. Includes review triggers.

---

## 3. Minimal troubleshooting section

```markdown
## Troubleshooting

**Getting 401 in production but not locally**
Check that `ENABLE_DEV_AUTH_TOOLS` is not set in production. Dev auth bypasses
normal auth checks.

**Webhook events not processing**
Ensure signature verification runs before payload parsing. A missing or incorrect
`WEBHOOK_SECRET` env var is the most common cause.

**Admin route returning 403 for a known admin**
Confirm the user has the `admin` role in the database. The middleware checks the
role at request time, not at login time.
```

---

## 4. Minimal review checklist

```markdown
## Review checklist

- [ ] New routes use the shared auth middleware, not inline checks
- [ ] Dev auth surfaces are gated by `ENABLE_DEV_AUTH_TOOLS=1`
- [ ] Sensitive flows return a safe default on error (fail closed)
- [ ] Webhook handlers verify signature before reading payload
- [ ] Session cookies are set with `httpOnly`, `secure`, and `sameSite`
```

---

## 5. Audit report format (non-compliant skill)

```
## Audit: matching-domain

### YAML Frontmatter — PASS
- name is kebab-case ✓
- description under 1024 chars ✓
- trigger phrases present ✓

### File Structure — PASS
- SKILL.md exists ✓
- no README.md ✓

### Progressive Disclosure — FAIL
- SKILL.md is 480 lines — move scoring table and examples to references/

### Instructions Quality — PARTIAL
- "When to use this skill" present ✓
- Troubleshooting present ✓
- No Quick examples section ✗ — add at least one

### Testing and Validation — FAIL
- Review checklist missing ✗

### Overall verdict: needs improvement — 3 items to fix before merge
```

---

## 6. Turning a weak skill into a compliant one

### Before (non-compliant)
```
Folder: MatchingDomain/
File: readme.md
Frontmatter: name: MatchingDomain
             description: This skill covers the matching system.
No examples, no troubleshooting, no review checklist.
```

### After (compliant)
```
Folder: matching-domain/
File: SKILL.md
Frontmatter:
  name: matching-domain
  description: >-
    Deterministic server-owned pair scoring and group formation. Use when
    adding a scoring factor, modifying match weights, debugging low match
    scores, or reviewing matching PRs. Trigger phrases: "add a scoring
    factor", "modify match weights", "why are groups not forming?",
    "debug low match scores", "review matching changes".

Added sections:
  ## Quick examples     — 2 concrete scenarios
  ## Troubleshooting    — 4 common issues with fixes
  ## Review checklist   — 6 items
  references/examples.md — detailed scoring table moved here
```

### Steps taken
1. Renamed folder to kebab-case
2. Renamed file to `SKILL.md`
3. Fixed `name` to kebab-case
4. Rewrote `description` to include what + when + trigger phrases
5. Added missing sections
6. Moved large reference tables to `references/`
