import type { Vendor } from './catalog';
import type { MatchRequest } from './contract';

const eventStems: Record<string, string[]> = {
  'свадьба': ['свадьб', 'свадеб'], 'той': ['той', 'тоя'],
  'корпоратив': ['корпоратив'], 'конференция': ['конференц', 'форум', 'делов'],
  'юбилей': ['юбиле'], 'день рождения': ['рождени'],
};
function relevanceScorer(request: MatchRequest): (text: string) => number {
  const event = eventStems[request.eventType] ?? [request.eventType.toLocaleLowerCase('ru')];
  const wishes = [...new Set((request.wish ?? '').toLocaleLowerCase('ru').match(/[а-яёa-z]{4,}/gu) ?? [])];
  return text => {
    const normalized = text.toLocaleLowerCase('ru').replaceAll('ё', 'е');
    return Number(event.some(stem => normalized.includes(stem))) +
      wishes.filter(word => normalized.includes(word)).length;
  };
}
/** Transparent lexical matching, not semantic AI or a suitability percentage. */
export function relevance(text: string, request: MatchRequest): number {
  return relevanceScorer(request)(text);
}

type ScoredVendor = { vendor: Vendor; relevance: number; language: number };
function vendorScorer(request: MatchRequest): (vendor: Vendor) => ScoredVendor {
  const score = relevanceScorer(request);
  return vendor => ({
    vendor, relevance: score(vendor.description),
    language: Number(Boolean(request.language && vendor.languages.includes(request.language))),
  });
}
function compare(a: ScoredVendor, b: ScoredVendor): number {
  return b.relevance - a.relevance ||
    a.vendor.priceFrom - b.vendor.priceFrom ||
    b.language - a.language ||
    (b.vendor.maxHours ?? -1) - (a.vendor.maxHours ?? -1) ||
    (a.vendor.id < b.vendor.id ? -1 : a.vendor.id > b.vendor.id ? 1 : 0);
}

/** Full ordering for callers that need every result; score each description only once. */
export function rankVendors(vendors: readonly Vendor[], request: MatchRequest): Vendor[] {
  return vendors.map(vendorScorer(request)).sort(compare).map(item => item.vendor);
}

/** One pass, O(n * limit) comparisons and O(limit) retained scores; default limit is three. */
export function selectTopVendors(
  vendors: Iterable<Vendor>, request: MatchRequest, limit = 3,
): Vendor[] {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError('Limit must be a nonnegative integer');
  if (limit === 0) return [];
  const score = vendorScorer(request);
  let best: ScoredVendor[] = [];
  for (const vendor of vendors) {
    const candidate = score(vendor);
    const position = best.findIndex(item => compare(candidate, item) < 0);
    if (position >= 0) {
      best = [...best.slice(0, position), candidate, ...best.slice(position, limit - 1)];
    } else if (best.length < limit) {
      best = [...best, candidate];
    }
  }
  return best.map(item => item.vendor);
}
