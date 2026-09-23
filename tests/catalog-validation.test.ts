import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseVendorRow } from '../lib/catalog';
import { createCatalogStore } from '../lib/catalog-store';

const row = {
  id: '1', anon_name: 'Имя', categories: 'ведущий', city: 'Алматы', price_from_kzt: '100',
  synthetic: 'False', city_imputed: 'False', price_imputed: 'False', event_formats: 'свадьба',
  languages: 'ru', max_hours: '', busy_dates: '', description: 'Описание',
};

describe('catalog input validation', () => {
  it.each(['', ' ', '\t', null])('rejects a missing price %j', price => {
    expect(() => parseVendorRow({ ...row, price_from_kzt: price })).toThrow();
  });
  it('accepts an explicit zero price', () => {
    expect(parseVendorRow({ ...row, price_from_kzt: '0' }).priceFrom).toBe(0);
  });
  it.each(['14.11.2026', '2026-02-29', '2026-11-31', '2026-1-14', '2026-13-01', '2026-00-10', '2026-11-00', 'garbage', '2026-11-14T00:00:00Z'])(
    'rejects malformed busy date %s even alongside valid dates', date => {
      expect(() => parseVendorRow({ ...row, busy_dates: `2026-11-14|${date}` })).toThrow(/busy/i);
    },
  );
  it('accepts empty calendars, real leap dates, out-of-window dates and duplicates', () => {
    expect(parseVendorRow(row).busyDates).toEqual([]);
    expect(parseVendorRow({ ...row, busy_dates: '2024-02-29|2027-01-01|2027-01-01' }).busyDates)
      .toEqual(['2024-02-29', '2027-01-01', '2027-01-01']);
  });
  it.each([{ price_from_kzt: '' }, { busy_dates: '14.11.2026' }])(
    'rejects a whole streamed snapshot with invalid row %j and permits retry', async invalid => {
      const dir = await mkdtemp(join(tmpdir(), 'firebird-invalid-'));
      try {
        const path = join(dir, 'catalog.csv');
        const csv = (rows: typeof row[]) => [Object.keys(row).join(','), ...rows.map(item => Object.values(item).join(','))].join('\n');
        await writeFile(path, csv([row, { ...row, id: '2', ...invalid }]));
        const store = createCatalogStore(path);
        await expect(store.load()).rejects.toThrow();
        await writeFile(path, csv([row]));
        expect((await store.load()).size).toBe(1);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
});
