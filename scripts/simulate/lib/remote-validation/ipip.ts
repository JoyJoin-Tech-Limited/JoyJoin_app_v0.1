/**
 * IPIP Big Five scorer.
 *
 * Instrument: IPIP Big-Five Factor Markers, 50-item (10 per factor; Goldberg,
 * 1992; public domain, ipip.ori.org). The keying file carries the official
 * item wording and keyed direction for auditability; the scorer never depends
 * on wording, only on {id → domain, reversed}.
 *
 * The harness is instrument-agnostic: any `IpIpKeying` file with the same
 * shape may be substituted (e.g. a facet-level NEO-120 key).
 */

import type { BigFiveDomain, IpIpKeying } from './types';
import { BIG_FIVE_DOMAINS } from './types';

export interface IpIpScoredProfile {
  complete: boolean;
  missingItems: string[];
  domains: Record<BigFiveDomain, number>;
}

export function scoreIpip(
  responses: Record<string, number>,
  keying: IpIpKeying,
): IpIpScoredProfile {
  const range = keying.responseMax - keying.responseMin;
  const acc: Record<BigFiveDomain, { sum: number; n: number }> = {
    openness: { sum: 0, n: 0 },
    conscientiousness: { sum: 0, n: 0 },
    extraversion: { sum: 0, n: 0 },
    agreeableness: { sum: 0, n: 0 },
    emotional_stability: { sum: 0, n: 0 },
  };

  const missingItems: string[] = [];
  for (const item of keying.items) {
    const raw = responses[item.id];
    if (typeof raw !== 'number' || Number.isNaN(raw)) {
      missingItems.push(item.id);
      continue;
    }
    const bounded = Math.max(keying.responseMin, Math.min(keying.responseMax, raw));
    const oriented = item.reversed ? keying.responseMax + keying.responseMin - bounded : bounded;
    const scaled = ((oriented - keying.responseMin) / range) * 100;
    acc[item.domain].sum += scaled;
    acc[item.domain].n += 1;
  }

  const domains = {} as Record<BigFiveDomain, number>;
  for (const d of BIG_FIVE_DOMAINS) {
    domains[d] = acc[d].n === 0 ? Number.NaN : acc[d].sum / acc[d].n;
  }

  return { complete: missingItems.length === 0, missingItems, domains };
}

/** Validate a keying file's structural integrity. */
export function validateKeying(keying: IpIpKeying): string[] {
  const errors: string[] = [];
  if (!keying.instrument) errors.push('keying.instrument is required');
  if (!(keying.responseMax > keying.responseMin)) errors.push('keying.responseMax must exceed responseMin');
  if (!Array.isArray(keying.items) || keying.items.length === 0) {
    errors.push('keying.items must be a non-empty array');
    return errors;
  }
  const seen = new Set<string>();
  for (const item of keying.items) {
    if (!item.id) errors.push('keying item missing id');
    if (seen.has(item.id)) errors.push(`duplicate item id: ${item.id}`);
    seen.add(item.id);
    if (!BIG_FIVE_DOMAINS.includes(item.domain)) {
      errors.push(`item ${item.id} has unknown domain: ${item.domain}`);
    }
  }
  const perDomain = new Map<BigFiveDomain, number>();
  for (const item of keying.items) perDomain.set(item.domain, (perDomain.get(item.domain) ?? 0) + 1);
  for (const d of BIG_FIVE_DOMAINS) {
    if ((perDomain.get(d) ?? 0) === 0) errors.push(`no items keyed to domain: ${d}`);
  }
  return errors;
}
