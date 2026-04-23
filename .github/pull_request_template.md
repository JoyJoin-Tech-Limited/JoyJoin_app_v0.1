## Summary

<!-- One-line description of what this PR does -->

## Changes

<!-- Bullet list of files changed and why -->

## Harness Completion Gate

Before marking this PR ready for review, run:

```bash
npm run harness:gate
```

- [ ] Reliability — error handling, retries, idempotency
- [ ] Scalability — no N+1 queries, bounded memory, pagination
- [ ] Security — auth checks, fail-closed, no secrets in code
- [ ] Observability — structured logging on error paths
- [ ] Maintainability — correct code placement, no cross-app imports

## Testing

- [ ] Guardrails pass (`npm run guardrails`)
- [ ] Type checks pass (`npm run typecheck` in affected workspaces)
- [ ] Server tests pass (`npm run test -w @joyjoin/server`)
- [ ] Manual verification steps (if UI change):
  - [ ] Web: tested in browser
  - [ ] Mini-program: tested in WeChat DevTools

## Sibling Platform Review

- [ ] Not needed — server-only or internal change
- [ ] Mini-program parity checked
- [ ] Admin client parity checked

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Breaking existing users | Low / Medium / High | |
| Performance regression | Low / Medium / High | |
| Security exposure | Low / Medium / High | |
