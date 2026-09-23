import { describe, expect, it } from 'vitest';
import type { Vendor } from '../lib/catalog';
import type { MatchRequest, MatchResponse } from '../lib/contract';
import { createCatalogIndex } from '../lib/catalog-index';
import { matchCatalog } from '../lib/match';
import { rankVendors } from '../lib/ranking';
import { explainVendor } from '../lib/explanations';

const base: MatchRequest = { city: 'Алматы', category: 'ведущий', date: '2026-11-14', eventType: 'свадьба', budget: 200000 };
function vendor(id: number, changes: Partial<Vendor> = {}): Vendor {
  return { id: String(id).padStart(5, '0'), name: `Профиль ${id}`, city: 'Алматы', categories: ['ведущий'],
    priceFrom: 100000, synthetic: false, cityImputed: false, priceImputed: false,
    eventFormats: ['свадьба'], languages: ['ru'], maxHours: 5, busyDates: [],
    description: 'Свадебные мероприятия с живой музыкой.', ...changes };
}

// Independent reference captured from main before optimization. No production ranking/filter helpers.
function referenceScore(text: string, query: MatchRequest): number {
  const stems: Record<string, string[]> = { свадьба: ['свадьб', 'свадеб'], той: ['той', 'тоя'],
    корпоратив: ['корпоратив'], конференция: ['конференц', 'форум', 'делов'], юбилей: ['юбиле'], 'день рождения': ['рождени'] };
  const normalized = text.toLocaleLowerCase('ru').replaceAll('ё', 'е');
  const words = [...new Set((query.wish ?? '').toLocaleLowerCase('ru').match(/[а-яёa-z]{4,}/gu) ?? [])];
  return Number((stems[query.eventType] ?? [query.eventType.toLocaleLowerCase('ru')]).some(stem => normalized.includes(stem))) +
    words.filter(word => normalized.includes(word)).length;
}
function referenceRank(input: readonly Vendor[], query: MatchRequest): Vendor[] {
  return [...input].sort((a, b) => referenceScore(b.description, query) - referenceScore(a.description, query) ||
    a.priceFrom - b.priceFrom ||
    Number(Boolean(query.language && b.languages.includes(query.language))) - Number(Boolean(query.language && a.languages.includes(query.language))) ||
    (b.maxHours ?? -1) - (a.maxHours ?? -1) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
function oracle(input: readonly Vendor[], query: MatchRequest) {
  const checks: [string, string, (v: Vendor) => boolean][] = [
    ['Город и категория', 'Другой город или категория', v => v.city === query.city && v.categories.includes(query.category)],
    ['Свободны на дату', `Заняты на ${query.date}`, v => !v.busyDates.includes(query.date)],
    ['Формат', `Не указан формат «${query.eventType}»`, v => v.eventFormats.includes(query.eventType)],
    ['Бюджет', 'Стартовая цена выше бюджета', v => v.priceFrom <= query.budget],
    ['Часы', 'Не хватает доступных часов', v => query.hours === undefined || v.maxHours === null || v.maxHours >= query.hours],
    ['Язык', 'Не указан нужный язык', v => !query.language || v.languages.includes(query.language)],
  ];
  const result = checks.reduce<{ pool: readonly Vendor[]; funnel: MatchResponse['funnel'] }>((state, [step, reason, keep]) => {
    const pool = state.pool.filter(keep);
    const count = state.pool.length - pool.length;
    return { pool, funnel: [...state.funnel, { step, left: pool.length, dropped: count ? [{ reason, count }] : [] }] };
  }, { pool: input, funnel: [{ step: 'Каталог', left: input.length, dropped: [] }] });
  const shown = referenceRank(result.pool, query).slice(0, 3);
  const outcome = result.funnel[1].left === 0 ? 'no_category_in_city' : shown.length === 3 ? 'matched' : shown.length ? 'partial' : 'none_pass';
  return { shown, outcome, funnel: outcome === 'no_category_in_city' ? result.funnel.slice(0, 2) : result.funnel };
}

function seededCatalog(seed: number): Vendor[] {
  return Array.from({ length: 48 }, (_, index) => {
    const n = ((index + 1) * 2654435761 + seed * 2246822519) >>> 0;
    return vendor(index, { city: ['Алматы', 'Астана'][n % 2],
      categories: n % 7 === 0 ? ['ведущий', 'площадка', 'площадка'] : [['ведущий'], ['площадка']][(n >>> 2) % 2],
      eventFormats: n % 4 === 0 ? ['свадьба', 'той'] : [['свадьба'], ['той']][(n >>> 4) % 2],
      priceFrom: (n % 5) * 50000, maxHours: [null, 2, 5, 8][(n >>> 6) % 4],
      languages: [['ru'], ['kk'], ['ru', 'kk']][(n >>> 8) % 3],
      busyDates: n % 3 === 0 ? ['2026-11-14'] : [],
      description: ['Свадебные мероприятия', 'Той, живая музыка', 'Ведущий конференций', 'Живая музыка и тихая программа'][(n >>> 10) % 4] });
  });
}

const cases = Array.from({ length: 216 }, (_, index) => ({ seed: Math.floor(index / 36) + 1, query: {
  ...base, city: ['Алматы', 'Астана', 'Несуществующий город'][index % 3],
  category: ['ведущий', 'площадка', 'нет категории'][Math.floor(index / 3) % 3],
  eventType: ['свадьба', 'той'][Math.floor(index / 9) % 2],
  date: index % 2 ? '2026-11-14' : '2026-11-15', budget: [0, 50000, 200000][Math.floor(index / 7) % 3],
  hours: [undefined, 2, 6][Math.floor(index / 5) % 3], language: [undefined, 'ru', 'kk'][Math.floor(index / 11) % 3],
  wish: index % 2 ? 'Живая музыка музыка тихая' : undefined,
} satisfies MatchRequest }));

describe('indexed matching against the original independent oracle', () => {
  it.each(cases)('preserves shortlist, ranking, funnel and explanations: seed=$seed query=$query', ({ seed, query }) => {
    const input = seededCatalog(seed);
    const before = structuredClone(input);
    const expected = oracle(input, query);
    const result = matchCatalog(query, createCatalogIndex(input));
    expect(result.outcome).toBe(expected.outcome);
    expect(result.funnel).toEqual(expected.funnel);
    expect(result.cards).toEqual(expected.shown.map(item => explainVendor(item, expected.shown, query)));
    expect(result.cards.length).toBeLessThanOrEqual(3);
    expect(result.message.length).toBeGreaterThan(0);
    expect(rankVendors(input, query)).toEqual(referenceRank(input, query));
    expect(matchCatalog(query, createCatalogIndex([...input].reverse()))).toEqual(result);
    expect(input).toEqual(before);
  });

  it('keeps absent category, failed conditions and partial success explicit', () => {
    const index = createCatalogIndex([vendor(1, { busyDates: [base.date] }), vendor(2, { priceFrom: 300000 })]);
    const absent = matchCatalog({ ...base, category: 'площадка' }, index);
    const rejected = matchCatalog(base, index);
    const partial = matchCatalog({ ...base, date: '2026-11-15' }, index);
    expect(absent.outcome).toBe('no_category_in_city');
    expect(rejected.outcome).toBe('none_pass');
    expect(partial.outcome).toBe('partial');
    expect(partial.cards).toHaveLength(1);
    expect(partial.message).toContain('меньше трёх');
    expect(partial.message).toContain('стартовая цена выше бюджета: 1');
    expect(new Set([absent.message, rejected.message, partial.message]).size).toBe(3);
  });

  it('treats venues with the same calendar and keeps unknown duration eligible', () => {
    const input = [vendor(1, { categories: ['площадка'], busyDates: [base.date] }),
      vendor(2, { categories: ['площадка'], maxHours: null }), vendor(3, { categories: ['площадка'], maxHours: 2 })];
    const result = matchCatalog({ ...base, category: 'площадка', hours: 8 }, createCatalogIndex(input));
    expect(result.cards.map(card => card.id)).toEqual(['00002']);
    expect(result.funnel.map(step => step.left)).toEqual([3, 3, 2, 2, 2, 1, 1]);
  });

  it('does not discard late superior candidates or include early candidates failing conditions', () => {
    const input = [...Array.from({ length: 20 }, (_, index) => vendor(index, { description: 'Ведущий мероприятий' })),
      vendor(20, { description: 'Свадебный ведущий, живая музыка' }), vendor(21, { priceFrom: 1, busyDates: [base.date] })];
    const query = { ...base, wish: 'живая музыка' };
    const result = matchCatalog(query, createCatalogIndex(input));
    expect(result.outcome).toBe('matched');
    expect(result.cards.map(card => card.id)).toEqual(['00020', '00000', '00001']);
    expect(result.message).toContain('Подходит 21 профиль');
  });
});
