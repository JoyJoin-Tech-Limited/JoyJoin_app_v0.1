/**
 * Unit tests for venueDataQuality.ts
 */

import { describe, it, expect } from 'vitest';
import {
  checkVenueDataQuality,
  normalizeVenueQualityRecord,
  type VenueRecord,
} from '../lib/venueDataQuality';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeVenue(overrides: Partial<VenueRecord> = {}): VenueRecord {
  return {
    id: 'v1',
    name: 'Test Bar',
    venueType: 'bar',
    address: '1 Main St',
    city: '深圳',
    area: '南山区',
    contactPerson: 'Alice',
    contactPhone: '13800000000',
    priceRange: '150-200',
    budgetCategories: ['150-200'],
    tags: ['cozy', 'lively'],
    commissionRate: 20,
    operatingHours: '18:00-02:00',
    partnerStatus: 'active',
    isActive: true,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('checkVenueDataQuality', () => {
  it('passes a fully complete venue', () => {
    const report = checkVenueDataQuality([makeVenue()]);
    expect(report.total).toBe(1);
    expect(report.passing).toBe(1);
    expect(report.withWarnings).toBe(0);
    expect(report.failing).toBe(0);
    expect(report.results[0].quality).toBe('pass');
    expect(report.results[0].issues).toHaveLength(0);
  });

  it('fails a venue missing required name', () => {
    const report = checkVenueDataQuality([makeVenue({ name: undefined })]);
    const result = report.results[0];
    expect(result.quality).toBe('fail');
    expect(result.issues.some((i) => i.field === 'name' && i.severity === 'error')).toBe(true);
    expect(report.failing).toBe(1);
  });

  it('fails a venue missing required venueType', () => {
    const report = checkVenueDataQuality([makeVenue({ venueType: '' })]);
    expect(report.results[0].quality).toBe('fail');
  });

  it('fails a venue missing required address', () => {
    const report = checkVenueDataQuality([makeVenue({ address: null })]);
    expect(report.results[0].quality).toBe('fail');
  });

  it('fails a venue missing required city', () => {
    const report = checkVenueDataQuality([makeVenue({ city: null })]);
    expect(report.results[0].quality).toBe('fail');
  });

  it('fails a venue missing required area', () => {
    const report = checkVenueDataQuality([makeVenue({ area: null })]);
    expect(report.results[0].quality).toBe('fail');
  });

  it('warns when contact info is absent', () => {
    const report = checkVenueDataQuality([
      makeVenue({ contactPerson: null, contactPhone: null }),
    ]);
    const result = report.results[0];
    expect(result.quality).toBe('warning');
    expect(result.issues.some((i) => i.field === 'contact' && i.severity === 'warning')).toBe(true);
  });

  it('warns when no price range configured', () => {
    const report = checkVenueDataQuality([
      makeVenue({ priceRange: null, budgetCategories: [] }),
    ]);
    const result = report.results[0];
    expect(result.quality).toBe('warning');
    expect(result.issues.some((i) => i.field === 'priceRange')).toBe(true);
  });

  it('passes when budgetCategories is set even if priceRange is null', () => {
    const report = checkVenueDataQuality([
      makeVenue({ priceRange: null, budgetCategories: ['150-200'] }),
    ]);
    expect(report.results[0].issues.some((i) => i.field === 'priceRange')).toBe(false);
  });

  it('warns when tags array is empty', () => {
    const report = checkVenueDataQuality([makeVenue({ tags: [] })]);
    expect(report.results[0].issues.some((i) => i.field === 'tags')).toBe(true);
  });

  it('fails when commissionRate is out of range', () => {
    const report = checkVenueDataQuality([makeVenue({ commissionRate: 0 })]);
    expect(report.results[0].quality).toBe('fail');
  });

  it('passes when commissionRate is null (treated as not set)', () => {
    const report = checkVenueDataQuality([makeVenue({ commissionRate: null })]);
    expect(report.results[0].issues.some((i) => i.field === 'commissionRate')).toBe(false);
  });

  it('warns when operatingHours is not set', () => {
    const report = checkVenueDataQuality([makeVenue({ operatingHours: null })]);
    expect(report.results[0].issues.some((i) => i.field === 'operatingHours')).toBe(true);
  });

  it('warns when partnerStatus is ended but isActive is true', () => {
    const report = checkVenueDataQuality([makeVenue({ partnerStatus: 'ended', isActive: true })]);
    const result = report.results[0];
    expect(result.issues.some((i) => i.field === 'partnerStatus')).toBe(true);
  });

  it('does not warn when partnerStatus is ended and isActive is false', () => {
    const report = checkVenueDataQuality([
      makeVenue({ partnerStatus: 'ended', isActive: false }),
    ]);
    expect(report.results[0].issues.some((i) => i.field === 'partnerStatus')).toBe(false);
  });

  it('detects duplicate venue names', () => {
    const v1 = makeVenue({ id: 'v1', name: 'Same Bar' });
    const v2 = makeVenue({ id: 'v2', name: 'Same Bar' });
    const v3 = makeVenue({ id: 'v3', name: 'Unique Bar' });
    const report = checkVenueDataQuality([v1, v2, v3]);
    expect(report.duplicateNames).toHaveLength(1);
    expect(report.duplicateNames[0].name).toBe('same bar');
    expect(report.duplicateNames[0].venueIds).toContain('v1');
    expect(report.duplicateNames[0].venueIds).toContain('v2');
  });

  it('returns empty list for no duplicates', () => {
    const report = checkVenueDataQuality([
      makeVenue({ id: 'v1', name: 'Bar A' }),
      makeVenue({ id: 'v2', name: 'Bar B' }),
    ]);
    expect(report.duplicateNames).toHaveLength(0);
  });

  it('returns correct aggregate counts', () => {
    const pass = makeVenue({ id: 'v1' });
    const warn = makeVenue({ id: 'v2', contactPerson: null, contactPhone: null });
    const fail = makeVenue({ id: 'v3', name: undefined });
    const report = checkVenueDataQuality([pass, warn, fail]);
    expect(report.total).toBe(3);
    expect(report.passing).toBe(1);
    expect(report.withWarnings).toBe(1);
    expect(report.failing).toBe(1);
  });

  it('handles empty array', () => {
    const report = checkVenueDataQuality([]);
    expect(report.total).toBe(0);
    expect(report.passing).toBe(0);
    expect(report.results).toHaveLength(0);
    expect(report.duplicateNames).toHaveLength(0);
  });

  it('includes a checkedAt ISO timestamp', () => {
    const report = checkVenueDataQuality([]);
    expect(new Date(report.checkedAt).toString()).not.toBe('Invalid Date');
  });

  it('uses venueName fallback for unnamed venues', () => {
    const report = checkVenueDataQuality([makeVenue({ id: 'v1', name: undefined })]);
    expect(report.results[0].venueName).toBe('(unnamed)');
  });

  it('normalizes snake_case and legacy venue fields before validation', () => {
    const normalized = normalizeVenueQualityRecord({
      id: 'venue-1',
      name: 'Mapped Venue',
      venue_type: 'bar',
      address: '1 Main St',
      city: '深圳',
      district: '南山区',
      contact_name: 'Legacy Contact',
      contact_phone: '13800000000',
      price_range: '150-200',
      budget_categories: ['150-200'],
      tags: ['cozy'],
      commission_rate: 20,
      operating_hours: '18:00-02:00',
      partner_status: 'active',
      is_active: true,
    } as Record<string, unknown>);

    expect(normalized.venueType).toBe('bar');
    expect(normalized.area).toBe('南山区');
    expect(normalized.contactPerson).toBe('Legacy Contact');
    expect(normalized.contactPhone).toBe('13800000000');
    expect(normalized.priceRange).toBe('150-200');
    expect(normalized.operatingHours).toBe('18:00-02:00');

    const report = checkVenueDataQuality([normalized]);
    expect(report.results[0].quality).toBe('pass');
  });
});
