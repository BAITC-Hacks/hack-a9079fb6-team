import type { Vendor } from './catalog';
import type { Card, MatchRequest } from './contract';
import { profileEvidence } from './evidence';

export const money = (value: number): string => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function contrast(vendor: Vendor, shown: readonly Vendor[]): string {
  const others = shown.filter(other => other.id !== vendor.id);
  if (!others.length) return 'Других подходящих профилей для сравнения нет';
  const uniqueLanguage = vendor.languages.find(language => others.every(other => !other.languages.includes(language)));
  if (uniqueLanguage) return `Только у этого профиля среди показанных указан язык «${uniqueLanguage}»`;
  const nextPrice = Math.min(...others.map(other => other.priceFrom));
  if (vendor.priceFrom < nextPrice) return `Стартовая цена на ${money(nextPrice - vendor.priceFrom)} ₸ ниже следующей среди показанных`;
  if (vendor.maxHours !== null && others.every(other => other.maxHours !== null && other.maxHours < vendor.maxHours!)) {
    return `До ${vendor.maxHours} ч против максимум ${Math.max(...others.map(other => other.maxHours!))} ч у других показанных`;
  }
  const cheaper = others.filter(other => other.priceFrom < vendor.priceFrom);
  if (vendor.maxHours !== null && cheaper.length && cheaper.every(other => other.maxHours !== null && other.maxHours < vendor.maxHours!)) {
    return `До ${vendor.maxHours} ч против максимум ${Math.max(...cheaper.map(other => other.maxHours!))} ч у более дешёвых профилей среди показанных`;
  }
  return vendor.maxHours === null ? `Языки работы: ${vendor.languages.join(', ')}`
    : `В каталоге указаны длительность до ${vendor.maxHours} ч и языки: ${vendor.languages.join(', ')}`;
}

/** Quote one useful source phrase; do not turn vendor advertising into our guarantee. */
function quote(vendor: Vendor, shown: readonly Vendor[], request: MatchRequest): string {
  const fragment = profileEvidence(vendor, shown, request);
  return fragment ? ` В описании профиля: «${fragment}».` : '';
}

export function explainVendor(vendor: Vendor, shown: readonly Vendor[], request: MatchRequest): Card {
  const matched = [
    `Город: ${vendor.city}`, `Категория: ${request.category}`,
    `На ${request.date} занятость не отмечена`, `Формат: ${request.eventType}`,
    `Цена от ${money(vendor.priceFrom)} ₸ ≤ бюджет ${money(request.budget)} ₸`,
    ...(request.hours === undefined ? [] : [vendor.maxHours === null
      ? 'Ограничение по часам: не применимо' : `До ${vendor.maxHours} ч при запросе ${request.hours} ч`]),
    ...(request.language ? [`Язык: ${request.language}`] : []),
  ];
  return {
    id: vendor.id, name: vendor.name, categories: [...vendor.categories], city: vendor.city,
    priceFrom: vendor.priceFrom, synthetic: vendor.synthetic, cityImputed: vendor.cityImputed,
    priceImputed: vendor.priceImputed, matched, total: matched.length,
    explanation: `${contrast(vendor, shown)}; формат «${request.eventType}», цена от ${money(vendor.priceFrom)} ₸${vendor.priceImputed ? ' (оценочная)' : ''}; на ${request.date} занятость не отмечена.${quote(vendor, shown, request)}`,
    explanationSource: 'template',
  };
}
