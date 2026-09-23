import type { Vendor } from './catalog';
import type { CatalogOptions } from './contract';

export type CatalogIndex = {
  readonly size: number;
  readonly options: CatalogOptions;
  candidates(city: string, category: string): readonly Vendor[];
  citiesFor(category: string): { city: string; count: number }[];
  findById(id: string): Vendor | undefined;
};

const empty: readonly Vendor[] = Object.freeze([]);
function freezeList(values: string[]): string[] { Object.freeze(values); return values; }
function immutableVendor(vendor: Vendor): Vendor {
  if (Object.isFrozen(vendor) && [vendor.categories, vendor.eventFormats, vendor.languages, vendor.busyDates].every(Object.isFrozen)) return vendor;
  return Object.freeze({ ...vendor, categories: freezeList([...vendor.categories]),
    eventFormats: freezeList([...vendor.eventFormats]), languages: freezeList([...vendor.languages]),
    busyDates: freezeList([...vendor.busyDates]) });
}

/** Private mutable construction, then a read-only published snapshot. No full-list copies. */
export function createCatalogBuilder() {
  const byId = new Map<string, Vendor>();
  const byCity = new Map<string, Map<string, Vendor[]>>();
  const categoryCities = new Map<string, Map<string, number>>();
  const values = { cities: new Set<string>(), categories: new Set<string>(), eventTypes: new Set<string>(), languages: new Set<string>() };
  let finished = false;
  function add(input: Vendor) {
    if (finished) throw new Error('Catalog snapshot already finalized');
    if (byId.has(input.id)) throw new Error('Catalog contains duplicate vendor IDs');
    const vendor = immutableVendor(input);
    byId.set(vendor.id, vendor);
    values.cities.add(vendor.city);
    for (const format of vendor.eventFormats) values.eventTypes.add(format);
    for (const language of vendor.languages) values.languages.add(language);
    const categories = byCity.get(vendor.city) ?? new Map<string, Vendor[]>();
    byCity.set(vendor.city, categories);
    for (const category of new Set(vendor.categories)) {
      values.categories.add(category);
      const bucket = categories.get(category) ?? [];
      bucket.push(vendor);
      categories.set(category, bucket);
      const cities = categoryCities.get(category) ?? new Map<string, number>();
      cities.set(vendor.city, (cities.get(vendor.city) ?? 0) + 1);
      categoryCities.set(category, cities);
    }
  }
  function finish(): CatalogIndex {
    finished = true;
    for (const categories of byCity.values()) for (const bucket of categories.values()) Object.freeze(bucket);
    const sorted = (set: Set<string>) => [...set].sort((a, b) => a.localeCompare(b, 'ru'));
    const options = { cities: sorted(values.cities), categories: sorted(values.categories),
      eventTypes: sorted(values.eventTypes), languages: sorted(values.languages) };
    return Object.freeze({ size: byId.size,
      get options() { return { cities: [...options.cities], categories: [...options.categories], eventTypes: [...options.eventTypes], languages: [...options.languages] }; },
      candidates: (city: string, category: string) => byCity.get(city)?.get(category) ?? empty,
      citiesFor: (category: string) => [...(categoryCities.get(category) ?? [])]
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([city, count]) => ({ city, count })),
      findById: (id: string) => byId.get(id),
    });
  }
  return { add, finish };
}

export function createCatalogIndex(vendors: Iterable<Vendor>): CatalogIndex {
  const builder = createCatalogBuilder();
  for (const vendor of vendors) builder.add(vendor);
  return builder.finish();
}
