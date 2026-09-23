import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCatalogIndex } from '../lib/catalog-index';
import { createCatalogStore } from '../lib/catalog-store';
import { loadVendors } from '../lib/catalog';
import { matchCatalog, matchVendors } from '../lib/match';
import demos from '../fixtures/demo-queries.json';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

describe('indexed catalog snapshot', () => {
  it('preserves complete responses including global funnel for all demo outcomes', () => {
    const vendors = loadVendors();
    const index = createCatalogIndex(vendors);
    for (const { expected: _expected, ...request } of Object.values(demos).filter(value => typeof value !== 'string')) {
      expect(matchCatalog(request, index)).toEqual(matchVendors(request, vendors));
    }
    expect(index.size).toBe(66);
    expect(index.findById('HK-35215')?.name).toBe('Кики');
    expect(index.findById('missing')).toBeUndefined();
    expect(index.candidates('missing', 'Ведущий')).toEqual([]);
  });
  it('snapshot cannot be changed through source objects, lists or returned options', () => {
    const vendors = loadVendors();
    const index = createCatalogIndex(vendors);
    vendors[0].city = 'changed';
    vendors[0].busyDates.push('2026-10-15');
    expect(index.findById(vendors[0].id)?.city).not.toBe('changed');
    expect(Object.isFrozen(index.candidates('Алматы', 'Флорист'))).toBe(true);
    index.options.cities.push('changed');
    expect(index.options.cities).not.toContain('changed');
  });
  it('indexes each vendor once per category and rejects duplicate IDs', () => {
    const vendor = loadVendors()[0];
    const index = createCatalogIndex([{ ...vendor, categories: ['Флорист', 'Флорист'] }]);
    expect(index.candidates(vendor.city, 'Флорист')).toHaveLength(1);
    expect(index.citiesFor('Флорист')).toEqual([{ city: vendor.city, count: 1 }]);
    expect(index.citiesFor('missing')).toEqual([]);
    expect(() => createCatalogIndex([vendor, vendor])).toThrow(/duplicate/i);
  });
  it('does not confuse city/category pairs containing the same separator', () => {
    const vendor = loadVendors()[0];
    const index = createCatalogIndex([
      { ...vendor, id: 'a', city: 'one|two', categories: ['three'] },
      { ...vendor, id: 'b', city: 'one', categories: ['two|three'] },
    ]);
    expect(index.candidates('one|two', 'three').map(v => v.id)).toEqual(['a']);
    expect(index.candidates('one', 'two|three').map(v => v.id)).toEqual(['b']);
  });
});

describe('streaming single-flight catalog store', () => {
  it('shares one fully loaded snapshot, stays stable until restart and retries failures', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'firebird-catalog-test-'));
    directories.push(directory);
    const path = join(directory, 'vendors.csv');
    const store = createCatalogStore(path);
    await expect(store.load()).rejects.toThrow();
    await writeFile(path, await readFile('data/contractors.csv'));
    const [first, second] = await Promise.all([store.load(), store.load()]);
    expect(first).toBe(second);
    expect(first.size).toBe(66);
    expect(matchCatalog(demos.dense, first)).toEqual(matchVendors(demos.dense));
    await writeFile(path, 'invalid');
    expect(await store.load()).toBe(first);
    await expect(createCatalogStore(path).load()).rejects.toThrow();
  });
  it('never publishes a partially valid catalog when a later row is invalid', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'firebird-catalog-invalid-'));
    directories.push(directory);
    const path = join(directory, 'vendors.csv');
    const source = await readFile('data/contractors.csv', 'utf8');
    await writeFile(path, `${source.trimEnd()}\ninvalid,row\n`);
    const store = createCatalogStore(path);
    const results = await Promise.allSettled([store.load(), store.load()]);
    expect(results.every(result => result.status === 'rejected')).toBe(true);
    await writeFile(path, source);
    expect((await store.load()).size).toBe(66);
  });
});
