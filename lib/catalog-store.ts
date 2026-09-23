import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { parse } from 'csv-parse';
import { parseVendorRow } from './catalog';
import { createCatalogBuilder, type CatalogIndex } from './catalog-index';

/** Bound interning tables so a high-cardinality catalog cannot retain every raw list twice. */
function listParser() {
  const lists = new Map<string, string[]>();
  const atoms = new Map<string, string>();
  return (value: string): string[] => {
    const cached = lists.get(value);
    if (cached) return cached;
    const result = value.split('|').map(item => item.trim()).filter(Boolean).map(item => {
      const existing = atoms.get(item);
      if (existing !== undefined) return existing;
      if (atoms.size < 4096) atoms.set(item, item);
      return item;
    });
    Object.freeze(result);
    if (lists.size < 4096) lists.set(value, result);
    return result;
  };
}

export function createCatalogStore(path: string) {
  let pending: Promise<CatalogIndex> | undefined;
  async function read(): Promise<CatalogIndex> {
    const builder = createCatalogBuilder();
    const splitList = listParser();
    await pipeline(createReadStream(path), parse({ columns: true, bom: true, skip_empty_lines: true, trim: true }),
      async (rows: AsyncIterable<unknown>) => {
        for await (const row of rows) builder.add(Object.freeze(parseVendorRow(row, splitList)));
      });
    const snapshot = builder.finish();
    if (snapshot.size === 0) throw new Error('Catalog must contain at least one valid profile');
    return snapshot;
  }
  return { load(): Promise<CatalogIndex> {
    if (!pending) pending = read().catch(error => { pending = undefined; throw error; });
    return pending;
  } };
}

// Shared by separately bundled Next routes within one process. Restart to publish a new CSV.
const globalCatalog = globalThis as typeof globalThis & {
  firebirdCatalogStore?: { path: string; store: ReturnType<typeof createCatalogStore> };
};
export function loadCatalog(): Promise<CatalogIndex> {
  const path = process.env.FIREBIRD_CATALOG_PATH || join(process.cwd(), 'data/contractors.csv');
  if (!globalCatalog.firebirdCatalogStore || globalCatalog.firebirdCatalogStore.path !== path) {
    globalCatalog.firebirdCatalogStore = { path, store: createCatalogStore(path) };
  }
  return globalCatalog.firebirdCatalogStore.store.load();
}
