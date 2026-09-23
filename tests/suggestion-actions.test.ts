import { describe, expect, it } from 'vitest';
import type { Vendor } from '../lib/catalog';
import { createCatalogIndex } from '../lib/catalog-index';
import type { MatchRequest } from '../lib/contract';
import { matchCatalog, matchVendors } from '../lib/match';

const request: MatchRequest = { city: 'Алматы', date: '2026-11-14', eventType: 'свадьба', category: 'ведущий', budget: 100,
  hours: 3, language: 'ru', wish: 'камерный вечер' };
const vendor = (overrides: Partial<Vendor> = {}): Vendor => ({
  id: '1', name: 'Имя', categories: ['ведущий'], city: 'Алматы', priceFrom: 100,
  synthetic: false, cityImputed: false, priceImputed: false, eventFormats: ['свадьба'],
  languages: ['ru'], maxHours: 3, busyDates: [], description: '', ...overrides,
});

describe('suggestion actions', () => {
  it('offers the nearest better date with all other request conditions preserved', () => {
    const vendors = [vendor({ busyDates: [request.date, '2026-11-15'] })];
    const response = matchVendors(request, vendors);
    expect(response.suggestionActions).toEqual([{ label: 'Проверить на 2026-11-13', changes: { date: '2026-11-13' } }]);
    expect(response.suggestions[0]).toContain('2026-11-13');
    const updated = { ...request, ...response.suggestionActions![0].changes };
    expect(matchVendors(updated, vendors).cards.map(card => card.id)).toEqual(['1']);
    expect(updated).toEqual({ ...request, date: '2026-11-13' });
  });

  it('offers exactly the minimum useful budget without relaxing date, hours or language', () => {
    const vendors = [vendor({ id: 'busy', priceFrom: 110, busyDates: [request.date] }),
      vendor({ id: 'short', priceFrom: 120, maxHours: 2 }), vendor({ id: 'language', priceFrom: 130, languages: ['kk'] }),
      vendor({ id: 'minimum', priceFrom: 150 }), vendor({ id: 'higher', priceFrom: 200 })];
    const response = matchVendors(request, vendors);
    expect(response.suggestionActions).toEqual([{ label: 'Бюджет 150 ₸', changes: { budget: 150 } }]);
    expect(response.suggestions[0]).toContain('до 150 ₸');
    expect(matchVendors({ ...request, ...response.suggestionActions![0].changes }, vendors).cards.map(card => card.id)).toEqual(['minimum']);
  });

  it('returns date then budget as separate independent actions', () => {
    const response = matchVendors(request, [vendor({ busyDates: [request.date] }), vendor({ id: '2', priceFrom: 150 })]);
    expect(response.suggestionActions).toEqual([
      { label: 'Проверить на 2026-11-15', changes: { date: '2026-11-15' } },
      { label: 'Бюджет 150 ₸', changes: { budget: 150 } },
    ]);
  });

  it('offers another city without claiming its vendors meet the other conditions', () => {
    const vendors = [vendor({ city: 'Астана', busyDates: [request.date], priceFrom: 1000 })];
    const response = matchVendors(request, vendors);
    expect(response.outcome).toBe('no_category_in_city');
    expect(response.suggestionActions).toEqual([{ label: 'Проверить в городе «Астана»', changes: { city: 'Астана' } }]);
    expect(matchVendors({ ...request, ...response.suggestionActions![0].changes }, vendors).outcome).toBe('none_pass');
    expect(matchCatalog(request, createCatalogIndex(vendors))).toEqual(response);
  });

  it('offers no action when availability is unknown or no alternative helps', () => {
    expect(matchVendors({ ...request, date: '2027-01-01' }, [vendor()]).suggestionActions ?? []).toEqual([]);
    expect(matchVendors(request, [vendor()]).suggestionActions ?? []).toEqual([]);
    expect(matchVendors(request, []).suggestionActions ?? []).toEqual([]);
  });
});
