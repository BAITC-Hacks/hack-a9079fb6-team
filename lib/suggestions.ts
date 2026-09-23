import type { Vendor } from './catalog';
import type { MatchRequest, SuggestionAction } from './contract';
import { money } from './explanations';
import { matchingVerb, profileCount } from './wording';

export const CALENDAR_START = '2026-09-23';
export const CALENDAR_END = '2026-12-31';
type Suggestion = { text: string; action: SuggestionAction };
type SuggestionOptions = { suggestions: string[]; suggestionActions: SuggestionAction[] };
export function fitsNonDateConditions(vendor: Vendor, request: MatchRequest, includeBudget = true): boolean {
  return vendor.city === request.city && vendor.categories.includes(request.category) &&
    vendor.eventFormats.includes(request.eventType) && (!includeBudget || vendor.priceFrom <= request.budget) &&
    (request.hours === undefined || vendor.maxHours === null || vendor.maxHours >= request.hours) &&
    (!request.language || vendor.languages.includes(request.language));
}
function nearestBetterDate(
  request: MatchRequest, poolSize: number, busyCounts: ReadonlyMap<string, number>, currentCount: number,
): Suggestion | null {
  if (poolSize <= currentCount) return null;
  const date = Date.parse(`${request.date}T00:00:00Z`);
  for (let offset = 1; offset <= 99; offset += 1) {
    // In a tie choose the later date; no dependency on today's date or local timezone.
    for (const direction of [1, -1]) {
      const candidate = new Date(date + direction * offset * 86400000).toISOString().slice(0, 10);
      if (candidate < CALENDAR_START || candidate > CALENDAR_END) continue;
      const count = poolSize - (busyCounts.get(candidate) ?? 0);
      if (count > currentCount) return {
        text: `На ${candidate} ${matchingVerb(count)} ${profileCount(count)}: все остальные условия сохранены (сейчас ${currentCount}).`,
        action: { label: `Проверить на ${candidate}`, changes: { date: candidate } },
      };
    }
  }
  return null;
}
/** Text and actions share one computation; clients never parse presentation copy. */
export function buildSuggestionOptions(request: MatchRequest, vendors: readonly Vendor[], currentCount: number): SuggestionOptions {
  let poolSize = 0;
  let nextPrice = Infinity;
  let added = 0;
  for (const vendor of vendors) {
    if (!fitsNonDateConditions(vendor, request, false)) continue;
    if (vendor.priceFrom <= request.budget) {
      poolSize += 1;
    } else if (!vendor.busyDates.includes(request.date)) {
      if (vendor.priceFrom < nextPrice) {
        nextPrice = vendor.priceFrom;
        added = 1;
      } else if (vendor.priceFrom === nextPrice) {
        added += 1;
      }
    }
  }
  const busyCounts = new Map<string, number>();
  if (poolSize > currentCount) {
    // Request-local counts replace a full catalog scan for every candidate date.
    for (const vendor of vendors) {
      if (!fitsNonDateConditions(vendor, request)) continue;
      // A duplicated calendar entry still means one unavailable contractor.
      for (const busyDate of new Set(vendor.busyDates)) {
        if (busyDate < CALENDAR_START || busyDate > CALENDAR_END) continue;
        busyCounts.set(busyDate, (busyCounts.get(busyDate) ?? 0) + 1);
      }
    }
  }
  const dateSuggestion = nearestBetterDate(request, poolSize, busyCounts, currentCount);
  const budgetSuggestion: Suggestion | null = added > 0
    ? { text: `При бюджете +${money(nextPrice - request.budget)} ₸ (до ${money(nextPrice)} ₸) ${matchingVerb(added)} ещё ${profileCount(added)}: остальные условия сохранены. Цена «от»; итоговую стоимость уточните.`,
      action: { label: `Бюджет ${money(nextPrice)} ₸`, changes: { budget: nextPrice } } }
    : null;
  const options = [dateSuggestion, budgetSuggestion].filter((item): item is Suggestion => item !== null);
  return { suggestions: options.map(item => item.text), suggestionActions: options.map(item => item.action) };
}

export function buildSuggestions(request: MatchRequest, vendors: readonly Vendor[], currentCount: number): string[] {
  return buildSuggestionOptions(request, vendors, currentCount).suggestions;
}
