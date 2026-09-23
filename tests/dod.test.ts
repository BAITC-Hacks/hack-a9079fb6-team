import { describe, expect, it } from 'vitest';
import demos from '../fixtures/demo-queries.json';
import { loadVendors } from '../lib/catalog';
import { matchVendors } from '../lib/match';
import type { MatchRequest } from '../lib/contract';

const ids = (request: MatchRequest) => matchVendors(request).cards.map(card => card.id);
describe('Firebird live acceptance criteria', () => {
  it('returns the same nonempty ranking and exact text on repeated requests', () => {
    const first = matchVendors(demos.dense);
    expect(first.cards).toHaveLength(3);
    expect(matchVendors(demos.dense)).toEqual(first);
  });
  it('changes the real demo selection for October versus December; excludes busy vendors', () => {
    expect(ids(demos.dense)).not.toEqual(ids(demos.dense_other_date));
    for (const request of [demos.dense, demos.dense_other_date]) {
      for (const card of matchVendors(request).cards) {
        expect(loadVendors().find(vendor => vendor.id === card.id)?.busyDates).not.toContain(request.date);
        expect(card.matched.join(' ')).toContain(request.date);
      }
    }
  });
  it.each([
    [demos.dense, 'matched'], [demos.rare, 'partial'],
    [demos.no_category_in_city, 'no_category_in_city'], [demos.none_pass, 'none_pass'],
    [{ ...demos.dense, date: '2027-01-01' }, 'date_out_of_range'],
  ] as const)('distinguishes outcome for %j', (request, expected) => {
    const result = matchVendors(request);
    expect(result.outcome).toBe(expected);
    expect(result.message.length).toBeGreaterThan(20);
    expect(result.cards.length).toBeLessThanOrEqual(3);
  });
  it('has three distinct explanations even when names are removed', () => {
    const cards = matchVendors(demos.dense).cards;
    expect(cards).toHaveLength(3);
    const texts = cards.map(card => card.explanation.replaceAll(card.name, ''));
    expect(new Set(texts).size).toBe(3);
    expect(new Set(cards.map(card => card.id)).size).toBe(cards.length);
    for (const card of cards) {
      expect(card.explanationSource).toBe('template');
      expect(card.explanation).toContain('от');
      expect(card.matched.length).toBe(card.total);
    }
  });
  it('answers the complete batch comfortably inside ten seconds without network', () => {
    const before = performance.now();
    for (const request of [demos.dense, demos.rare, demos.none_pass]) matchVendors(request);
    expect(performance.now() - before).toBeLessThan(10000);
  });
});


describe('shared UI demo fixture expectations', () => {
  const { _note, ...queries } = demos;
  it.each(Object.entries(queries))('%s matches the saved IDs, outcome and candidate count', (_name, demo) => {
    const { expected, ...request } = demo;
    const result = matchVendors(request);
    expect(result.outcome).toBe(expected.outcome);
    expect(result.cards.map(card => card.id)).toEqual(expected.ids);
    expect(result.funnel.at(-1)?.left ?? 0).toBe(expected.totalCandidates);
  });
});
