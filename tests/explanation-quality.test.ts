import { describe, expect, it } from 'vitest';
import { loadVendors } from '../lib/catalog';
import { explainVendor } from '../lib/explanations';
import { matchVendors } from '../lib/match';
import demos from '../fixtures/demo-queries.json';

const quote = (text: string) => text.match(/В описании профиля: «(.*)»\.$/u)?.[1].replace(/…$/u, '');

describe('useful, grounded explanation text', () => {
  it('explains a higher price through a real duration difference and quotes complete experience', () => {
    const card = matchVendors(demos.dense).cards.find(card => card.id === 'HK-42352')!;
    expect(card.explanation).toMatch(/^До 10 ч против максимум 8 ч у более дешёвых профилей среди показанных/u);
    expect(quote(card.explanation)).toBe('Опыт ведения свадеб 13 лет');
    expect(card.explanation).toContain('(оценочная)');
  });
  it('prefers concrete services and photographic style over introductions', () => {
    const vendors = loadVendors();
    const photographer = vendors.find(vendor => vendor.id === 'HK-61323')!;
    const card = explainVendor(photographer, [photographer], { ...demos.dense, category: 'Фотограф' });
    expect(quote(card.explanation)).toContain('фотожурнализм');
    const host = matchVendors(demos.dense).cards.find(card => card.id === 'HK-44923')!;
    expect(quote(host.explanation)).not.toContain('Меня зовут');
    expect(host.explanation).toMatch(/Импровизация|оборудование/u);
  });
  it('keeps the florist specialization complete instead of cutting after a preposition', () => {
    const card = matchVendors(demos.rare).cards.find(card => card.id === 'HK-39372')!;
    expect(quote(card.explanation)).toBe('Мы специализируемся на авторском цветочном оформлении и флористике для мероприятий в Алматы');
  });
  it('does not manufacture an hours advantage when cheaper vendors have unbounded hours', () => {
    const source = loadVendors().find(vendor => vendor.id === 'HK-42352')!;
    const cheaper = { ...source, id: 'cheap', priceFrom: 1, maxHours: null };
    const card = explainVendor(source, [source, cheaper], demos.dense);
    expect(card.explanation).not.toContain('у более дешёвых');
    expect(card.explanation).not.toContain('нет преимущества');
  });
  it('quotes exact source text without changing a negated service into a promise', () => {
    const source = { ...loadVendors()[0], description: 'Не выполняем монтаж декора. Работаем с сезонными цветами.' };
    const card = explainVendor(source, [source], demos.rare);
    const cited = quote(card.explanation)!;
    expect(source.description).toContain(cited);
    if (cited.includes('выполняем монтаж')) expect(cited).toContain('Не выполняем');
  });
  it('omits empty advertising instead of presenting it as a reason to choose', () => {
    for (const id of ['HK-25279', 'HK-39301']) {
      const vendor = loadVendors().find(vendor => vendor.id === id)!;
      const card = explainVendor(vendor, [vendor], { ...demos.dense, category: vendor.categories[0] });
      expect(quote(card.explanation)).toBeUndefined();
      expect(card.explanation).toContain('занятость не отмечена');
      expect(card.explanation).toContain('цена от');
      expect(card.explanation).not.toMatch(/сверкаем|№1/u);
    }
  });
  it('never ends an excerpt with a stranded list marker', () => {
    for (const id of ['HK-31819', 'HK-60927']) {
      const vendor = loadVendors().find(vendor => vendor.id === id)!;
      const card = explainVendor(vendor, [vendor], { ...demos.dense, category: vendor.categories[0] });
      expect(quote(card.explanation)).toBeTruthy();
      expect(quote(card.explanation)).not.toMatch(/(?:[—–•-]|\p{Extended_Pictographic})$/u);
    }
  });
});
