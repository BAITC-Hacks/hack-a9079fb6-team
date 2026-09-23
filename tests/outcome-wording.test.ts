import { describe, expect, it } from 'vitest';
import type { Vendor } from '../lib/catalog';
import type { MatchRequest } from '../lib/contract';
import { matchVendors } from '../lib/match';
import { buildSuggestions } from '../lib/suggestions';

const request: MatchRequest = { city: 'Алматы', date: '2026-11-14', eventType: 'свадьба', category: 'ведущий', budget: 100 };
const vendors = (count: number, overrides: Partial<Vendor> = {}): Vendor[] => Array.from({ length: count }, (_, index) => ({
  id: String(index), name: 'Имя', categories: ['ведущий'], city: 'Алматы', priceFrom: 100,
  synthetic: false, cityImputed: false, priceImputed: false, eventFormats: ['свадьба'],
  languages: ['ru'], maxHours: null, busyDates: [], description: '', ...overrides,
}));

describe('natural Russian outcome wording', () => {
  it.each([[1, '1 профиль'], [2, '2 профиля'], [5, '5 профилей'], [11, '11 профилей'], [21, '21 профиль']] as const)(
    'uses the right noun for %i profiles in empty and unavailable outcomes', (count, noun) => {
      const absent = matchVendors(request, vendors(count, { city: 'Астана' }));
      expect(absent.outcome).toBe('no_category_in_city');
      expect(absent.suggestions[0]).toContain(`есть ${noun} этой категории`);
      const unavailable = matchVendors(request, vendors(count, { busyDates: [request.date] }));
      expect(unavailable.outcome).toBe('none_pass');
      expect(unavailable.message).toContain(`есть ${noun} этой категории`);
      expect(unavailable.message).toContain(`заняты на ${request.date}: ${count}`);
    },
  );
  it.each([[1, 'Подходит только 1 профиль'], [2, 'Подходят только 2 профиля']] as const)(
    'explains a partial result of %i', (count, phrase) => {
      const result = matchVendors(request, vendors(count));
      expect(result.outcome).toBe('partial');
      expect(result.message).toContain(`${phrase} — меньше трёх.`);
      expect(result.message).toContain('больше профилей нет');
    },
  );
  it.each([[5, 'Подходят 5 профилей'], [21, 'Подходит 21 профиль']] as const)(
    'explains a full result from %i candidates', (count, phrase) => {
      const result = matchVendors(request, vendors(count));
      expect(result.outcome).toBe('matched');
      expect(result.message).toContain(`${phrase}; показаны первые 3`);
    },
  );
  it.each([[1, 'подходит', '1 профиль'], [2, 'подходят', '2 профиля'], [5, 'подходят', '5 профилей'], [21, 'подходит', '21 профиль']] as const)(
    'uses correct noun and verb in date and budget suggestions for %i', (count, verb, noun) => {
      expect(buildSuggestions(request, vendors(count, { busyDates: [request.date] }), 0)[0])
        .toContain(`На 2026-11-15 ${verb} ${noun}:`);
      expect(buildSuggestions(request, vendors(count, { priceFrom: 110 }), 0)[0])
        .toContain(`(до 110 ₸) ${verb} ещё ${noun}:`);
    },
  );
});
