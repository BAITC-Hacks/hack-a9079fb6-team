import { createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { loadVendors, type Vendor } from '../lib/catalog';

export const FREE_DATE = '2026-10-15';
export const BUSY_DATE = '2026-12-31';
export const WINNER_WISH = 'уникальныйфиниш';
export const vendorId = (index: number) => `BENCH-${String(index).padStart(8, '0')}`;
const columns = ['id', 'anon_name', 'categories', 'city', 'city_imputed', 'synthetic',
  'price_from_kzt', 'price_imputed', 'event_formats', 'languages', 'max_hours', 'busy_dates', 'description'];
const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
const calendarDays = Array.from({ length: 99 }, (_, day) =>
  new Date(Date.UTC(2026, 8, 23 + day)).toISOString().slice(0, 10));

function calendar(index: number): string[] {
  const dates = [BUSY_DATE];
  let state = index + 1;
  // Different calendar tuples across rows; first requested date is busy on every fourth row.
  for (let day = 0; day < 99; day += 1) {
    state = Math.imul(state, 1664525) + 1013904223 | 0;
    if ((state >>> 0) % 101 < 24) {
      const date = calendarDays[day];
      if (date !== FREE_DATE && date !== BUSY_DATE) dates.push(date);
    }
  }
  if (index % 4 === 0) dates.push(FREE_DATE);
  return dates;
}

function row(source: Vendor, index: number, last: boolean): string {
  const description = `${source.description} Профиль номер ${index}; проверяемая программа ${index % 997}. ` +
    'Работа по согласованному сценарию, подготовка программы и технического плана. '.repeat(4) +
    (last ? `${WINNER_WISH} ${source.eventFormats[0]}` : '');
  const dates = last ? calendar(index).filter(date => date !== FREE_DATE) : calendar(index);
  return [vendorId(index), `Профиль ${index}`, source.categories.join('|'), source.city, 'False', 'True',
    50_000 + index % 900_000, 'False', source.eventFormats.join('|'),
    index % 2 === 0 || last ? 'русский|казахский' : 'русский', last ? 12 : 2 + index % 9,
    dates.join('|'), description].map(csvCell).join(',') + '\n';
}

/** Write real independent CSV records with bounded write buffering; never build N objects. */
export async function generateFixture(path: string, count: number, mode: 'distributed' | 'dense') {
  const sources = loadVendors();
  const base = sources[0];
  const output = createWriteStream(path);
  const completion = finished(output);
  // Attach rejection handling immediately, including while waiting for drain.
  void completion.catch(() => undefined);
  try {
    output.write(columns.join(',') + '\n');
    for (let index = 0; index < count; index += 1) {
      const last = index === count - 1;
      const source = mode === 'dense' || last ? base : sources[index % sources.length];
      if (!output.write(row(source, index, last))) await once(output, 'drain');
    }
    output.end();
    await completion;
  } catch (error) { output.destroy(); throw error; }
  return { city: base.city, category: base.categories[0], eventType: base.eventFormats[0],
    sourceProfiles: sources.length, winnerId: vendorId(count - 1) };
}
