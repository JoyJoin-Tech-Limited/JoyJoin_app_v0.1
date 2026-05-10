# Legal / privacy — open beta (self-serve + payments) checklist

**Audience:** Product, Legal, Engineering (sign-off owners fill names/dates).  
**Not legal advice:** This is an engineering checklist template aligned with [`open-beta-wider.md`](./open-beta-wider.md) and [`launch-risks.md`](./launch-risks.md) R-07.

## Data map (confirm against schema)

- [ ] **Identifiers:** Phone, WeChat OpenID / unionid (if collected), session cookies — documented in privacy notice.
- [ ] **Profile & assessment:** Fields stored in [`packages/shared/src/schema.ts`](../packages/shared/src/schema.ts) (personality, demographics, preferences) — purpose limitation stated.
- [ ] **Payments:** WeChat Pay transaction identifiers, amounts, status — processor terms linked.
- [ ] **AI (if enabled):** Which features call LLMs; no training on user content unless separately agreed.

## User-facing artifacts

- [ ] Terms of service updated for **open signup** jurisdiction.
- [ ] Privacy policy updated (subprocessors: hosting DB, WeChat, payment provider, AI vendors as applicable).
- [ ] Cookie / local storage notice for web client if required.
- [ ] Mini-program user agreement / privacy path reviewed for parity with web.

## Retention and rights

- [ ] Data retention periods defined for beta cohort.
- [ ] Contact channel for access / deletion requests (even if manual for beta).

## Payments (required for this beta)

- [ ] Refund and dispute policy visible before paywall.
- [ ] Pricing and currency clear in product UI.

## Sign-off

| Area | Owner | Date |
|------|-------|------|
| Legal | | |
| Product | | |
| Engineering | | |
