import type { Vendor } from './catalog';
import type { MatchRequest } from './contract';

const eventStems: Record<string, string[]> = {
  'свадьба': ['свадьб', 'свадеб'], 'той': ['той', 'тоя'],
  'корпоратив': ['корпоратив'], 'конференция': ['конференц', 'форум', 'делов'],
  'юбилей': ['юбиле'], 'день рождения': ['рождени'],
};
/** Transparent lexical matching, not semantic AI or a suitability percentage. */
export function relevance(text: string, request: MatchRequest): number {
  const normalized = text.toLocaleLowerCase('ru').replaceAll('ё', 'е');
  const event = eventStems[request.eventType] ?? [request.eventType.toLocaleLowerCase('ru')];
  const wishes = [...new Set((request.wish ?? '').toLocaleLowerCase('ru').match(/[а-яёa-z]{4,}/gu) ?? [])];
  return Number(event.some(stem => normalized.includes(stem))) +
    wishes.filter(word => normalized.includes(word)).length;
}
export function rankVendors(vendors: readonly Vendor[], request: MatchRequest): Vendor[] {
  return [...vendors].sort((a, b) =>
    relevance(b.description, request) - relevance(a.description, request) ||
    a.priceFrom - b.priceFrom ||
    Number(Boolean(request.language && b.languages.includes(request.language))) -
      Number(Boolean(request.language && a.languages.includes(request.language))) ||
    (b.maxHours ?? -1) - (a.maxHours ?? -1) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
