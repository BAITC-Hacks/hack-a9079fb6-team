import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir, cpus } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { expect, test } from 'vitest';
import type { MatchRequest, MatchResponse, CompareResponse } from '../lib/contract';
import { BUSY_DATE, FREE_DATE, WINNER_WISH, generateFixture } from './fixture';

const integer = (name: string, fallback: number, min: number, max: number) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be ${min}..${max}`);
  return value;
};
const rows = integer('FIREBIRD_BENCH_ROWS', 1_000_000, 66, 1_000_000);
const repeats = integer('FIREBIRD_BENCH_REPEATS', 5, 1, 20);
const mode = process.env.FIREBIRD_BENCH_MODE ?? 'distributed';
if (mode !== 'distributed' && mode !== 'dense') throw new Error('FIREBIRD_BENCH_MODE must be distributed or dense');
const memory = () => ({ ...process.memoryUsage(), peakRss: process.resourceUsage().maxRSS * 1024 });
const stats = (samples: number[]) => {
  const sorted = [...samples].sort((a, b) => a - b);
  return { p50: sorted[Math.ceil(sorted.length * .5) - 1], p95: sorted[Math.ceil(sorted.length * .95) - 1],
    max: sorted[sorted.length - 1], samples: sorted.length };
};
const request = (path: string, body: unknown) => new Request(`http://localhost${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

test(`actual CSV ${rows} rows / ${mode}: load, full handlers and correctness`, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'firebird-benchmark-'));
  const path = join(directory, 'contractors.csv');
  const previousPath = process.env.FIREBIRD_CATALOG_PATH;
  try {
    const generationStart = performance.now();
    const fixture = await generateFixture(path, rows, mode);
    const generationMs = performance.now() - generationStart;
    const bytes = (await stat(path)).size;
    process.env.FIREBIRD_CATALOG_PATH = path;
    const importStart = performance.now();
    const [{ loadCatalog }, matchHandler, compareHandler, { matchCatalog }] = await Promise.all([
      import('../lib/catalog-store'), import('../app/api/match/route'),
      import('../app/api/compare/route'), import('../lib/match'),
    ]);
    const importMs = performance.now() - importStart;
    const beforeLoad = memory();
    const loadStart = performance.now();
    const [catalog, concurrentCatalog] = await Promise.all([loadCatalog(), loadCatalog()]);
    const coldLoadMs = performance.now() - loadStart;
    expect(catalog).toBe(concurrentCatalog);
    expect(catalog.size).toBe(rows);
    const afterLoad = memory();
    const base: MatchRequest = { city: fixture.city, category: fixture.category,
      eventType: fixture.eventType, date: FREE_DATE, budget: 1_000_000_000, wish: WINNER_WISH };
    const scenarios = [
      { name: 'matched', query: base, expected: 'matched' },
      { name: 'budget_empty', query: { ...base, budget: 0 }, expected: 'none_pass' },
      { name: 'all_busy', query: { ...base, date: BUSY_DATE }, expected: 'none_pass' },
      { name: 'language_hours', query: { ...base, language: 'казахский', hours: 6 }, expected: 'matched' },
      { name: 'hours_empty', query: { ...base, hours: 168 }, expected: 'none_pass' },
    ];
    const measurements: Record<string, ReturnType<typeof stats>> = {};
    for (const scenario of scenarios) {
      const expectedCount = catalog.candidates(base.city, base.category).reduce((count, vendor) => count + Number(
        !vendor.busyDates.includes(scenario.query.date) && vendor.eventFormats.includes(scenario.query.eventType) &&
        vendor.priceFrom <= scenario.query.budget && (!('hours' in scenario.query) ||
          vendor.maxHours === null || vendor.maxHours >= scenario.query.hours!) &&
        (!('language' in scenario.query) || vendor.languages.includes(scenario.query.language!))), 0);
      let initial: MatchResponse | undefined;
      const samples: number[] = [];
      for (let run = 0; run < repeats; run += 1) {
        const start = performance.now();
        const response = await matchHandler.POST(request('/api/match', scenario.query));
        const result: MatchResponse = await response.json();
        samples.push(performance.now() - start);
        expect(response.status).toBe(200);
        // Small smoke fixtures may have fewer than three eligible profiles.
        expect(scenario.expected === 'matched' ? ['matched', 'partial'] : [scenario.expected]).toContain(result.outcome);
        expect(result.cards.length).toBeLessThanOrEqual(3);
        expect(result.cards).toHaveLength(Math.min(3, expectedCount));
        expect(result.funnel.at(-1)!.left).toBe(expectedCount);
        expect(result.funnel[0].left).toBe(rows);
        for (const card of result.cards) {
          const vendor = catalog.findById(card.id)!;
          expect(vendor.busyDates).not.toContain(scenario.query.date);
          expect(vendor.priceFrom).toBeLessThanOrEqual(scenario.query.budget);
          expect(vendor.city).toBe(base.city);
          expect(vendor.categories).toContain(base.category);
          expect(vendor.eventFormats).toContain(base.eventType);
          if ('language' in scenario.query) expect(vendor.languages).toContain(scenario.query.language);
          if ('hours' in scenario.query && vendor.maxHours !== null) expect(vendor.maxHours).toBeGreaterThanOrEqual(scenario.query.hours!);
        }
        if (initial) expect(result).toEqual(initial);
        initial = result;
      }
      if (scenario.name === 'matched') expect(initial!.cards[0].id).toBe(fixture.winnerId);
      measurements[scenario.name] = stats(samples);
    }
    const compareSamples: number[] = [];
    for (let run = 0; run < repeats; run += 1) {
      const start = performance.now();
      const response = await compareHandler.POST(request('/api/compare', { request: base, secondDate: BUSY_DATE }));
      const result: CompareResponse = await response.json();
      compareSamples.push(performance.now() - start);
      expect(response.status).toBe(200);
      expect(result.second.outcome).toBe('none_pass');
      expect(result.removed).toHaveLength(result.first.cards.length);
      expect(result.removed.every(card => card.reason === 'busy')).toBe(true);
    }
    measurements.compare = stats(compareSamples);
    const absent = matchCatalog({ ...base, city: '__absent_benchmark_city__' }, catalog);
    expect(absent.outcome).toBe('no_category_in_city');
    expect(absent.cards).toHaveLength(0);
    const afterRequests = memory();
    console.log('FIREBIRD_BENCHMARK ' + JSON.stringify({ rows, mode, repeats, bytes,
      averageRowBytes: bytes / rows, sourceProfiles: fixture.sourceProfiles,
      node: process.version, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model,
      generationMs, importMs, coldLoadMs, bucketSize: catalog.candidates(base.city, base.category).length,
      warmHandlerMs: measurements, memoryBytes: { beforeLoad, afterLoad, afterRequests },
      scope: 'In-process route handlers including request validation and response JSON; no network, Next server, build, or browser. Cold ingestion measured separately. Peak RSS is process-lifetime high-water mark, including fixture generation.' }));
    for (const result of Object.values(measurements)) expect(result.max).toBeLessThan(10_000);
  } finally {
    if (previousPath === undefined) delete process.env.FIREBIRD_CATALOG_PATH;
    else process.env.FIREBIRD_CATALOG_PATH = previousPath;
    await rm(directory, { recursive: true, force: true });
  }
});
