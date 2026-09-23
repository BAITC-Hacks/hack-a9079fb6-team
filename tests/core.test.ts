import { describe, expect, it } from 'vitest';
import { getCatalogOptions, loadVendors, type Vendor } from '../lib/catalog';
import { matchVendors } from '../lib/match';
import type { MatchRequest } from '../lib/contract';

const request: MatchRequest = { city: 'Алматы', date: '2026-10-15', eventType: 'свадьба', category: 'Ведущий', budget: 1000000 };
const vendor = (id: string, changes: Partial<Vendor> = {}): Vendor => ({
  id, name: id, categories: ['Ведущий'], city: 'Алматы', priceFrom: 500000,
  synthetic: false, cityImputed: false, priceImputed: false,
  eventFormats: ['свадьба'], languages: ['русский'], maxHours: 6,
  busyDates: [], description: 'Проводит свадьбы и камерные мероприятия.', ...changes,
});
describe('catalog ingestion', () => {
  it('reads all profiles, prices, flags, dates and nullable hours', () => {
    const rows = loadVendors();
    expect(rows).toHaveLength(66);
    expect(rows.filter(row => row.maxHours === null)).toHaveLength(9);
    expect(rows.filter(row => row.synthetic)).toHaveLength(13);
    expect(rows[0]).toMatchObject({ id: 'HK-39372', priceFrom: 200000, priceImputed: true, maxHours: null });
    expect(rows[0].busyDates).toContain('2026-10-14');
    expect(rows.every(row => row.categories.length > 0 && Number.isFinite(row.priceFrom))).toBe(true);
  });
  it('returns unique sorted catalog choices', () => {
    const choices = getCatalogOptions();
    expect(choices.cities).toHaveLength(3);
    expect(choices.categories).toHaveLength(17);
    expect(choices.eventTypes).toHaveLength(6);
    expect(choices.languages).toContain('казахский');
  });
});
describe('hard constraints and funnel', () => {
  it('filters sequentially with each exclusion counted exactly once', () => {
    const vendors = [vendor('city', { city: 'Астана' }), vendor('category', { categories: ['Флорист'] }),
      vendor('busy', { busyDates: [request.date], priceFrom: 2000000 }),
      vendor('format', { eventFormats: ['той'] }), vendor('budget', { priceFrom: 1000001 }),
      vendor('hours', { maxHours: 2 }), vendor('language', { languages: ['английский'] }),
      vendor('valid'), vendor('null', { maxHours: null })];
    const result = matchVendors({ ...request, hours: 6, language: 'русский' }, vendors);
    expect(result.cards.map(card => card.id).sort()).toEqual(['null', 'valid']);
    expect(result.funnel.map(step => step.left)).toEqual([9, 7, 6, 5, 4, 3, 2]);
    expect(result.funnel.flatMap(step => step.dropped).reduce((sum, row) => sum + row.count, 0)).toBe(7);
  });
  it('includes exact budget and duration boundaries and nullable duration', () => {
    const result = matchVendors({ ...request, hours: 6 }, [vendor('equal', { priceFrom: request.budget }), vendor('null', { maxHours: null })]);
    expect(result.cards).toHaveLength(2);
    expect(result.cards.find(card => card.id === 'null')?.matched.join(' ')).toContain('не применимо');
  });
  it.each(['2026-09-22', '2027-01-01'])('rejects date outside calendar: %s', date => {
    expect(matchVendors({ ...request, date }, [vendor('a')]).outcome).toBe('date_out_of_range');
  });
  it.each(['2026-09-23', '2026-12-31'])('includes calendar boundary: %s', date => {
    expect(matchVendors({ ...request, date }, [vendor('a')]).outcome).toBe('partial');
  });
  it('has a clear message when category exists but all vendors are busy', () => {
    const result = matchVendors(request, [vendor('a', { busyDates: [request.date] })]);
    expect(result.outcome).toBe('none_pass');
    expect(result.message).toContain('занят');
    expect(result.message).toContain(request.date);
  });
  it('suggests cities only where the selected category actually exists', () => {
    const result = matchVendors({ ...request, city: 'Астана' }, [vendor('a'), vendor('b', { city: 'Астана', categories: ['Флорист'] })]);
    expect(result.outcome).toBe('no_category_in_city');
    expect(result.suggestions.join(' ')).toContain('Алматы');
    expect(result.suggestions.join(' ')).not.toContain('Зарубежье');
  });
});
describe('deterministic grounded ranking', () => {
  it('ranks relevance then budget and id without mutating input or penalizing synthetic', () => {
    const vendors = [vendor('z', { description: 'Портреты', priceFrom: 100000 }),
      vendor('b'), vendor('a', { synthetic: true }), vendor('expensive', { priceFrom: 900000 })];
    const before = structuredClone(vendors);
    expect(matchVendors(request, vendors).cards.map(card => card.id)).toEqual(['a', 'b', 'expensive']);
    expect(vendors).toEqual(before);
  });
  it('uses desired-language and hours as deterministic later tie breakers', () => {
    const vendors = [vendor('a', { maxHours: 6 }), vendor('b', { maxHours: 12 }), vendor('c', { maxHours: null })];
    expect(matchVendors({ ...request, hours: 5, language: 'русский' }, vendors).cards.map(card => card.id)).toEqual(['b', 'a', 'c']);
  });
  it('never claims global uniqueness and quotes description as source data', () => {
    const result = matchVendors(request, [vendor('a', { languages: ['русский', 'казахский'] }), vendor('b'), vendor('c')]);
    expect(result.cards.find(card => card.id === 'a')?.explanation).toContain('среди показанных');
    expect(result.cards.every(card => !card.explanation.includes('гарантированно'))).toBe(true);
  });
});
describe('counterfactual suggestions preserve all other conditions', () => {
  it('suggests the nearest date inside the calendar and counts only fully matching vendors', () => {
    const result = matchVendors(request, [vendor('busy', { busyDates: [request.date] }), vendor('expensive', { priceFrom: 2000000 })]);
    expect(result.suggestions.join(' ')).toContain('2026-10-16');
    expect(result.suggestions.join(' ')).toContain('1');
  });
  it('budget suggestion counts only vendors unlocked by the exact increment', () => {
    const result = matchVendors(request, [vendor('a', { priceFrom: 1100000 }), vendor('b', { priceFrom: 1100000 }),
      vendor('busy', { priceFrom: 1100000, busyDates: [request.date] }), vendor('wrong', { priceFrom: 1100000, eventFormats: ['той'] })]);
    expect(result.suggestions.join(' ')).toContain('+100 000');
    expect(result.suggestions.join(' ')).toContain('ещё 2');
  });
});

describe('explanation evidence regression', () => {
  it('preserves distinct grounded quotes across catalog combinations and calendar days', () => {
    const vendors = loadVendors();
    const combinations = new Map(vendors.flatMap(v => v.categories.flatMap(category =>
      v.eventFormats.map(eventType => [`${v.city}|${category}|${eventType}`, { city: v.city, category, eventType }] as const))));
    for (const combination of combinations.values()) {
      for (let day = 0; day < 100; day++) {
        const date = new Date(Date.UTC(2026, 8, 23 + day)).toISOString().slice(0, 10);
        const cards = matchVendors({ ...combination, date, budget: 1000000000 }, vendors).cards;
        const texts = cards.map(card => card.explanation.replaceAll(card.name, ''));
        expect(new Set(texts).size, JSON.stringify({ combination, date, cards })).toBe(cards.length);
        for (const card of cards) {
          const quoted = card.explanation.match(/В описании профиля: «(.*)»\.$/u)?.[1].replace(/…$/u, '');
          if (quoted) expect(vendors.find(v => v.id === card.id)?.description).toContain(quoted);
          expect(card.explanation).toContain(`на ${date} занятость не отмечена`);
          expect(card.explanation).toContain('цена от');
          expect(card.explanation).toContain(`формат «${combination.eventType}»`);
        }
      }
    }
  });
  it('leads with the distinguishing fact and keeps demo quotes brief', () => {
    const cards = matchVendors(request).cards;
    expect(cards[0].explanation).toMatch(/^Только у этого профиля среди показанных указан язык «английский»/u);
    expect(cards[2].explanation).toMatch(/^Стартовая цена на 250 000 ₸ ниже/u);
    for (const card of cards) {
      const quote = card.explanation.match(/В описании профиля: «(.*)»\.$/u)?.[1];
      expect(quote).toBeTruthy();
      expect(quote!.length).toBeLessThanOrEqual(140);
    }
    expect(cards[0].explanation).toContain('Работает на казахском, русском и английском языках');
    expect(cards[1].explanation).not.toContain('0 разводов');
  });
  it('distinguishes real bands by lineup rather than repeated marketing intro', () => {
    const result = matchVendors({ ...request, category: 'Лайв-бэнд', eventType: 'корпоратив', budget: 1500000 });
    const first = result.cards.find(card => card.id === 'HK-23752');
    const second = result.cards.find(card => card.id === 'HK-83709');
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first?.explanation).toContain('два вокалиста');
    expect(second?.explanation).toContain('4 вокалиста');
  });
  it('all demo source quotes are exact fragments of original profiles', () => {
    const vendors = loadVendors();
    const result = matchVendors(request, vendors);
    for (const card of result.cards) {
      const quoted = card.explanation.match(/В описании профиля: «(.*)»\.$/u)?.[1].replace(/…$/u, '');
      expect(quoted).toBeTruthy();
      expect(vendors.find(v => v.id === card.id)?.description).toContain(quoted);
      expect(card.explanation).not.toContain('Приветствую');
    }
  });
});
