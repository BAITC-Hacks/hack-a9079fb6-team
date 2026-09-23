import type { Vendor } from './catalog';
import type { Card, MatchRequest } from './contract';
import { relevance } from './ranking';

export const money = (value: number): string => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function contrast(vendor: Vendor, shown: readonly Vendor[]): string {
  const others = shown.filter(other => other.id !== vendor.id);
  if (!others.length) return 'Других подходящих профилей для сравнения нет';
  const uniqueLanguage = vendor.languages.find(language => others.every(other => !other.languages.includes(language)));
  if (uniqueLanguage) return `Только у этого профиля среди показанных указан язык «${uniqueLanguage}»`;
  const nextPrice = Math.min(...others.map(other => other.priceFrom));
  if (vendor.priceFrom < nextPrice) return `Стартовая цена на ${money(nextPrice - vendor.priceFrom)} ₸ ниже следующей среди показанных`;
  const minPrice = Math.min(...others.map(other => other.priceFrom));
  if (vendor.priceFrom > minPrice) return `Стартовая цена на ${money(vendor.priceFrom - minPrice)} ₸ выше минимальной среди показанных`;
  if (vendor.maxHours !== null && others.every(other => other.maxHours !== null && other.maxHours < vendor.maxHours!)) {
    return `До ${vendor.maxHours} ч против максимум ${Math.max(...others.map(other => other.maxHours!))} ч у других показанных`;
  }
  return 'По стартовой цене нет преимущества перед другими показанными профилями';
}

/** Quote one useful source phrase; do not turn vendor advertising into our guarantee. */
function quote(vendor: Vendor, shown: readonly Vendor[], request: MatchRequest): string {
  const fragments = vendor.description.split(/(?<=[.!?])\s+|\n+|•/u)
    .map(text => text.trim()).filter(Boolean);
  const factStems = ['опыт', 'специализ', 'сценари', 'оформ', 'фото', 'автор', 'импровиза', 'лет',
    'состав', 'вокал', 'квартет', 'барабан', 'гитар', 'саксофон', 'репертуар', 'заказ', 'оборудован', 'язык'];
  const specificity = (text: string) => factStems.filter(stem => text.toLocaleLowerCase('ru').includes(stem)).length;
  const otherDescriptions = shown.filter(other => other.id !== vendor.id).map(other => other.description.toLocaleLowerCase('ru'));
  const distinctive = fragments.filter(text => specificity(text) > 0 &&
    otherDescriptions.every(description => !description.includes(text.toLocaleLowerCase('ru'))));
  const candidates = distinctive.length ? distinctive : fragments;
  const usefulness = (text: string) => specificity(text) * 10 + relevance(text, request) * 5 - Math.max(0, text.length - 100) / 10;
  const sentence = [...candidates].sort((a, b) => usefulness(b) - usefulness(a))[0];
  if (!sentence) return '';
  const clipped = sentence.length > 80;
  const fragment = (clipped ? sentence.slice(0, 79).replace(/\s+\S*$/u, '') : sentence)
    .replace(/[.!?]+$/u, '');
  return ` В описании профиля: «${fragment}${clipped ? '…' : ''}».`;
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
