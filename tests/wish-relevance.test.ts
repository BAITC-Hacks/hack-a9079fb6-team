import { describe, expect, it } from 'vitest';
import { loadVendors } from '../lib/catalog';
import type { MatchRequest } from '../lib/contract';
import { explainVendor } from '../lib/explanations';
import { matchVendors } from '../lib/match';
import { relevance, selectTopVendors } from '../lib/ranking';

const request: MatchRequest = {
  city: 'Астана', category: 'Ведущий', eventType: 'корпоратив', date: '2026-09-23', budget: 1000000,
};

describe('honest lexical wish matching', () => {
  it.each(['съёмка', 'съемка'])('normalizes both spellings of %s symmetrically', wish => {
    const query = { ...request, wish };
    expect(relevance('Съёмка мероприятия', query)).toBe(1);
    expect(relevance('Съемка мероприятия', query)).toBe(1);
  });
  it('does not reward a description explicitly declining the requested style', () => {
    const host = loadVendors().find(vendor => vendor.id === 'HK-58385')!;
    const query = { ...request, wish: 'тихий формальный вечер' };
    expect(relevance(host.description, query)).toBeLessThan(0);
    expect(matchVendors(query).cards[0]?.id).not.toBe(host.id);
    expect(explainVendor(host, [host], query).explanation).toContain('противоречие пожеланиям');
    expect(explainVendor(host, [host], query).explanation).toContain('не подойдём');
  });
  it('distinguishes a negated wish from a positive mention', () => {
    const query = { ...request, wish: 'без конкурсов' };
    expect(relevance('В программе много конкурсов.', query)).toBeLessThan(0);
    expect(relevance('Программа без конкурсов.', query)).toBeGreaterThan(0);
    expect(relevance('Без банальных конкурсов — живая музыка.', query)).toBeGreaterThan(0);
  });
  it('keeps negation across a coordinated list from the real host profile', () => {
    const host = loadVendors().find(vendor => vendor.id === 'HK-58385')!;
    const query = { ...request, wish: 'без банальных конкурсов' };
    expect(relevance(host.description, query)).toBeGreaterThan(0);
    expect(explainVendor(host, [host], query).explanation).not.toContain('противоречие пожеланиям');
  });
  it('ends the negation at the next prepositional phrase in the real sweets profile', () => {
    const source = loadVendors().find(vendor => vendor.id === 'HK-60927')!;
    const query = { ...request, wish: 'индивидуальным дизайном' };
    expect(relevance(source.description, query)).toBeGreaterThanOrEqual(2);
    expect(explainVendor(source, [source], query).explanation).not.toContain('противоречие пожеланиям');
  });
  it('does not reward a service explicitly unavailable in a description', () => {
    expect(relevance('Не выполняем монтаж декора.', { ...request, wish: 'монтаж декора' })).toBeLessThan(0);
    expect(relevance('Монтаж декора включён.', { ...request, wish: 'монтаж декора' })).toBeGreaterThan(0);
  });
  it('recognizes a trailing refusal without treating «не только» as refusal', () => {
    const query = { ...request, wish: 'без конкурсов' };
    expect(relevance('Конкурсов нет.', query)).toBeGreaterThan(0);
    expect(relevance('Конкурсов не проводим.', query)).toBeGreaterThan(0);
    expect(relevance('Не только конкурсов, но и танцев.', query)).toBeLessThan(0);
  });
  it('does not carry a negation into the next sentence or contrasting clause', () => {
    const query = { ...request, wish: 'живая музыка' };
    expect(relevance('Без конкурсов. Живая музыка.', query)).toBe(2);
    expect(relevance('Без конкурсов, но живая музыка.', query)).toBe(2);
  });
  it('retains deterministic ordering and never mutates candidate profiles', () => {
    const source = loadVendors()[0];
    const candidates = Object.freeze([
      Object.freeze({ ...source, id: 'conflict', description: 'Много конкурсов.' }),
      Object.freeze({ ...source, id: 'preferred', description: 'Без конкурсов.' }),
    ]);
    const query = { ...request, wish: 'без конкурсов' };
    expect(selectTopVendors(candidates, query).map(vendor => vendor.id)).toEqual(['preferred', 'conflict']);
    expect(selectTopVendors(candidates, query)).toEqual(selectTopVendors([...candidates].reverse(), query));
  });
});
