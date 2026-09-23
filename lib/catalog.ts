import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import type { CatalogOptions } from './contract';

export type Vendor = {
  id: string; name: string; categories: string[]; city: string; priceFrom: number;
  synthetic: boolean; cityImputed: boolean; priceImputed: boolean;
  eventFormats: string[]; languages: string[]; maxHours: number | null;
  busyDates: string[]; description: string;
};
const list = (value: string): string[] => value.split('|').map(item => item.trim()).filter(Boolean);
const boolean = z.enum(['True', 'False']).transform(value => value === 'True');
const rowSchema = z.object({
  id: z.string().min(1), anon_name: z.string().min(1), categories: z.string().min(1),
  city: z.string().min(1),
  price_from_kzt: z.union([z.string().trim().min(1), z.number()]).pipe(z.coerce.number<string | number>().finite().nonnegative()),
  synthetic: boolean, city_imputed: boolean, price_imputed: boolean,
  event_formats: z.string().min(1), languages: z.string().min(1),
  max_hours: z.union([z.literal(''), z.coerce.number().positive().finite()]),
  busy_dates: z.string(), description: z.string(),
});

// Bounded cache avoids reparsing common calendar dates for every catalog row.
const validBusyDates = new Set<string>();
function validateBusyDate(value: string): void {
  if (validBusyDates.has(value)) return;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00Z`) : NaN;
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    throw new Error('Catalog busy_dates must contain real ISO calendar dates (YYYY-MM-DD)');
  }
  if (validBusyDates.size < 4096) validBusyDates.add(value);
}

export function parseVendorRow(value: unknown, splitList: (value: string) => string[] = list): Vendor {
  const row = rowSchema.parse(value);
  const busyDates = splitList(row.busy_dates);
  for (const busyDate of busyDates) validateBusyDate(busyDate);
  return {
    id: row.id, name: row.anon_name, categories: splitList(row.categories), city: row.city,
    priceFrom: row.price_from_kzt, synthetic: row.synthetic,
    cityImputed: row.city_imputed, priceImputed: row.price_imputed,
    eventFormats: splitList(row.event_formats), languages: splitList(row.languages),
    maxHours: row.max_hours === '' ? null : row.max_hours,
    busyDates, description: row.description,
  };
}

/** Uncached synchronous adapter for tests/tools; production routes use loadCatalog(). */
export function loadVendors(): Vendor[] {
  const raw: unknown[] = parse(readFileSync(join(process.cwd(), 'data/contractors.csv'), 'utf8'), {
    columns: true, bom: true, skip_empty_lines: true, trim: true,
  });
  const vendors = raw.map(value => parseVendorRow(value));
  if (new Set(vendors.map(vendor => vendor.id)).size !== vendors.length) {
    throw new Error('Catalog contains duplicate vendor IDs');
  }
  return vendors;
}

export function getCatalogOptions(): CatalogOptions {
  const vendors = loadVendors();
  const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'ru'));
  return {
    cities: unique(vendors.map(vendor => vendor.city)),
    categories: unique(vendors.flatMap(vendor => vendor.categories)),
    eventTypes: unique(vendors.flatMap(vendor => vendor.eventFormats)),
    languages: unique(vendors.flatMap(vendor => vendor.languages)),
  };
}
