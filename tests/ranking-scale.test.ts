import { describe, expect, it } from 'vitest';
import type { Vendor } from '../lib/catalog';
import type { MatchRequest } from '../lib/contract';
import { rankVendors, relevance, selectTopVendors } from '../lib/ranking';

const request: MatchRequest = {
  city: 'Алматы', date: '2026-11-14', eventType: 'свадьба', category: 'ведущий', budget: 500000,
};
function vendor(index: number): Vendor {
  return {
    id: String(index).padStart(6, '0'), name: `Подрядчик ${index}`, city: 'Алматы',
    categories: ['ведущий'], priceFrom: (index % 5) * 10000,
    synthetic: false, cityImputed: false, priceImputed: false,
    eventFormats: ['свадьба'], languages: index % 2 ? ['ru'] : ['kk'],
    maxHours: index % 4 ? index % 4 : null, busyDates: [],
    description: ['Свадебный ведущий, живая музыка', 'Ведущий конференций', 'Тихая живая музыка'][index % 3],
  };
}
// Original public ordering contract, deliberately independent of the optimized comparator.
function reference(vendors: readonly Vendor[], query: MatchRequest): Vendor[] {
  return [...vendors].sort((a, b) =>
    relevance(b.description, query) - relevance(a.description, query) ||
    a.priceFrom - b.priceFrom ||
    Number(Boolean(query.language && b.languages.includes(query.language))) -
      Number(Boolean(query.language && a.languages.includes(query.language))) ||
    (b.maxHours ?? -1) - (a.maxHours ?? -1) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

describe('bounded vendor selection', () => {
  it.each([
    request,
    { ...request, language: 'ru', hours: 2 },
    { ...request, language: 'kk', wish: 'Живая музыка музыка тихая' },
    { ...request, eventType: 'Неизвестный формат', wish: 'ёЛОЧКА Живая' },
  ])('preserves full-sort results for all ranking criteria: %j', query => {
    const vendors = Array.from({ length: 300 }, (_, index) => vendor(index));
    const expected = reference(vendors, query);
    for (const input of [vendors, [...vendors].reverse()]) {
      expect(rankVendors(input, query)).toEqual(expected);
      for (const limit of [1, 2, 3, 10, 350]) {
        expect(selectTopVendors(input, query, limit)).toEqual(expected.slice(0, limit));
      }
    }
  });

  it('breaks otherwise identical ties by ID without mutating the input', () => {
    const base = vendor(0);
    const input = Object.freeze(['z', 'b', 'a', 'c'].map(id => Object.freeze({ ...base, id })));
    expect(selectTopVendors(input, request).map(item => item.id)).toEqual(['a', 'b', 'c']);
    expect(input.map(item => item.id)).toEqual(['z', 'b', 'a', 'c']);
  });

  it('supports a single-pass iterable and short or empty catalogs', () => {
    function* candidates() { yield vendor(2); yield vendor(1); }
    expect(selectTopVendors(candidates(), request)).toEqual(reference([vendor(2), vendor(1)], request));
    expect(selectTopVendors([], request)).toEqual([]);
    expect(selectTopVendors([vendor(1)], request, 0)).toEqual([]);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid limits: %s', limit => {
    expect(() => selectTopVendors([], request, limit)).toThrow(RangeError);
  });
});
