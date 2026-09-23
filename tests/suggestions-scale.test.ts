import { describe, expect, it } from 'vitest';
import type { Vendor } from '../lib/catalog';
import type { MatchRequest } from '../lib/contract';
import { money } from '../lib/explanations';
import { matchingVerb, profileCount } from '../lib/wording';
import { buildSuggestionOptions, buildSuggestions, CALENDAR_END, CALENDAR_START, fitsNonDateConditions } from '../lib/suggestions';

const request: MatchRequest = { city: 'Алматы', date: '2026-11-14', eventType: 'свадьба', category: 'ведущий', budget: 100 };
const vendor = (overrides: Partial<Vendor> = {}): Vendor => ({
  id: '1', name: 'Имя', categories: ['ведущий'], city: 'Алматы', priceFrom: 100,
  synthetic: false, cityImputed: false, priceImputed: false, eventFormats: ['свадьба'],
  languages: ['ru'], maxHours: null, busyDates: [], description: '', ...overrides,
});

// Deliberately preserve the old exhaustive implementation as an independent oracle.
function reference(input: MatchRequest, vendors: readonly Vendor[], currentCount: number): string[] {
  const pool = vendors.filter(item => fitsNonDateConditions(item, input));
  let dateSuggestion: string | null = null;
  const date = Date.parse(`${input.date}T00:00:00Z`);
  outer: for (let offset = 1; offset <= 99; offset += 1) {
    for (const direction of [1, -1]) {
      const candidate = new Date(date + direction * offset * 86400000).toISOString().slice(0, 10);
      if (candidate < CALENDAR_START || candidate > CALENDAR_END) continue;
      const count = pool.filter(item => !item.busyDates.includes(candidate)).length;
      if (count > currentCount) {
        dateSuggestion = `На ${candidate} ${matchingVerb(count)} ${profileCount(count)}: все остальные условия сохранены (сейчас ${currentCount}).`;
        break outer;
      }
    }
  }
  const overBudget = vendors.filter(item => fitsNonDateConditions(item, input, false) &&
    !item.busyDates.includes(input.date) && item.priceFrom > input.budget);
  const nextPrice = Math.min(...overBudget.map(item => item.priceFrom));
  const added = overBudget.filter(item => item.priceFrom <= nextPrice).length;
  return [dateSuggestion, added > 0
    ? `При бюджете +${money(nextPrice - input.budget)} ₸ (до ${money(nextPrice)} ₸) ${matchingVerb(added)} ещё ${profileCount(added)}: остальные условия сохранены. Цена «от»; итоговую стоимость уточните.`
    : null].filter((item): item is string => item !== null);
}

describe('suggestions preserve exhaustive behavior at scale', () => {
  it('handles a million over-budget candidates without argument-stack overflow', () => {
    const vendors = Array.from({ length: 1_000_000 }, () => vendor({ priceFrom: 110 }));
    const result = buildSuggestionOptions(request, vendors, 0);
    expect(result.suggestions).toEqual([
      'При бюджете +10 ₸ (до 110 ₸) подходят ещё 1000000 профилей: остальные условия сохранены. Цена «от»; итоговую стоимость уточните.',
    ]);
    expect(result.suggestionActions).toEqual([{ label: 'Бюджет 110 ₸', changes: { budget: 110 } }]);
  });

  it('matches exhaustive search across dates, duplicates, prices and optional constraints', () => {
    const vendors = Array.from({ length: 60 }, (_, index) => vendor({
      id: String(index), priceFrom: 50 + (index % 7) * 20,
      city: index % 11 === 0 ? 'Астана' : 'Алматы',
      categories: index % 13 === 0 ? ['зал'] : ['ведущий'],
      eventFormats: index % 9 === 0 ? ['конференция'] : ['свадьба'],
      languages: index % 3 === 0 ? ['kk'] : ['ru'], maxHours: index % 4 === 0 ? 2 : null,
      busyDates: [request.date, ...(index % 2 === 0 ? ['2026-11-15', '2026-11-15'] : ['2026-11-13']), '2027-01-01', 'invalid'],
    }));
    for (const date of ['2026-09-23', '2026-11-14', '2026-12-31']) {
      for (const budget of [0, 80, 100, 1000]) {
        for (const options of [{}, { hours: 3, language: 'ru' }]) {
          const input = { ...request, date, budget, ...options };
          const count = vendors.filter(item => fitsNonDateConditions(item, input) && !item.busyDates.includes(date)).length;
          expect(buildSuggestions(input, vendors, count)).toEqual(reference(input, vendors, count));
        }
      }
    }
  });

  it('matches the exhaustive no-better-date case across the entire calendar', () => {
    const busyDates = Array.from({ length: 100 }, (_, index) =>
      new Date(Date.parse(`${CALENDAR_START}T00:00:00Z`) + index * 86400000).toISOString().slice(0, 10));
    const vendors = Array.from({ length: 200 }, (_, index) => vendor({
      id: String(index), busyDates: [...busyDates, ...busyDates],
    }));
    expect(buildSuggestions(request, vendors, 0)).toEqual(reference(request, vendors, 0));
    expect(buildSuggestions(request, vendors, 0)).toEqual([]);
  });

  it('chooses the later date in a tie and counts duplicate busy dates only once', () => {
    const vendors = [vendor({ busyDates: [request.date, '2026-11-15', '2026-11-15'] }), vendor({ busyDates: [request.date] })];
    expect(buildSuggestions(request, vendors, 0)).toEqual(reference(request, vendors, 0));
    expect(buildSuggestions(request, vendors, 0)[0]).toContain('2026-11-15 подходит 1 профиль');
  });
});
