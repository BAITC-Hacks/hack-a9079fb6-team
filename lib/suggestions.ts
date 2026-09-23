import type { Vendor } from './catalog';
import type { MatchRequest } from './contract';
import { money } from './explanations';

export const CALENDAR_START = '2026-09-23';
export const CALENDAR_END = '2026-12-31';
export function fitsNonDateConditions(vendor: Vendor, request: MatchRequest, includeBudget = true): boolean {
  return vendor.city === request.city && vendor.categories.includes(request.category) &&
    vendor.eventFormats.includes(request.eventType) && (!includeBudget || vendor.priceFrom <= request.budget) &&
    (request.hours === undefined || vendor.maxHours === null || vendor.maxHours >= request.hours) &&
    (!request.language || vendor.languages.includes(request.language));
}
function nearestBetterDate(request: MatchRequest, pool: readonly Vendor[], currentCount: number): string | null {
  const date = Date.parse(`${request.date}T00:00:00Z`);
  for (let offset = 1; offset <= 99; offset += 1) {
    // In a tie choose the later date; no dependency on today's date or local timezone.
    for (const direction of [1, -1]) {
      const candidate = new Date(date + direction * offset * 86400000).toISOString().slice(0, 10);
      if (candidate < CALENDAR_START || candidate > CALENDAR_END) continue;
      const count = pool.filter(vendor => !vendor.busyDates.includes(candidate)).length;
      if (count > currentCount) return `На ${candidate} подходят ${count}: все остальные условия сохранены (сейчас ${currentCount}).`;
    }
  }
  return null;
}
export function buildSuggestions(request: MatchRequest, vendors: readonly Vendor[], currentCount: number): string[] {
  const pool = vendors.filter(vendor => fitsNonDateConditions(vendor, request));
  const dateSuggestion = nearestBetterDate(request, pool, currentCount);
  const overBudget = vendors.filter(vendor => fitsNonDateConditions(vendor, request, false) &&
    !vendor.busyDates.includes(request.date) && vendor.priceFrom > request.budget);
  const nextPrice = Math.min(...overBudget.map(vendor => vendor.priceFrom));
  const added = overBudget.filter(vendor => vendor.priceFrom <= nextPrice).length;
  const budgetSuggestion = added > 0
    ? `При бюджете +${money(nextPrice - request.budget)} ₸ (до ${money(nextPrice)} ₸) подходят ещё ${added}: остальные условия сохранены. Цена «от»; итоговую стоимость уточните.`
    : null;
  return [dateSuggestion, budgetSuggestion].filter((item): item is string => item !== null);
}
