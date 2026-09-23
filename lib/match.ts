import { loadVendors, type Vendor } from './catalog';
import type { MatchRequest, MatchResponse } from './contract';
import { explainVendor } from './explanations';
import { rankVendors } from './ranking';
import { buildSuggestions, CALENDAR_END, CALENDAR_START } from './suggestions';

type Filter = { step: string; reason: string; keep: (vendor: Vendor) => boolean };
function filters(request: MatchRequest): Filter[] {
  return [
    { step: 'Город и категория', reason: 'Другой город или категория', keep: v => v.city === request.city && v.categories.includes(request.category) },
    { step: 'Свободны на дату', reason: `Заняты на ${request.date}`, keep: v => !v.busyDates.includes(request.date) },
    { step: 'Формат', reason: `Не указан формат «${request.eventType}»`, keep: v => v.eventFormats.includes(request.eventType) },
    { step: 'Бюджет', reason: 'Стартовая цена выше бюджета', keep: v => v.priceFrom <= request.budget },
    { step: 'Часы', reason: 'Не хватает доступных часов', keep: v => request.hours === undefined || v.maxHours === null || v.maxHours >= request.hours },
    { step: 'Язык', reason: 'Не указан нужный язык', keep: v => !request.language || v.languages.includes(request.language) },
  ];
}
function runFilters(request: MatchRequest, vendors: readonly Vendor[]) {
  return filters(request).reduce<{ pool: readonly Vendor[]; funnel: MatchResponse['funnel'] }>((state, filter) => {
    const pool = state.pool.filter(filter.keep);
    const count = state.pool.length - pool.length;
    return { pool, funnel: [...state.funnel, { step: filter.step, left: pool.length,
      dropped: count ? [{ reason: filter.reason, count }] : [] }] };
  }, { pool: vendors, funnel: [{ step: 'Каталог', left: vendors.length, dropped: [] }] });
}
function emptyCategory(request: MatchRequest, vendors: readonly Vendor[], funnel: MatchResponse['funnel']): MatchResponse {
  const cities = [...new Set(vendors.filter(vendor => vendor.categories.includes(request.category)).map(vendor => vendor.city))].sort();
  return {
    outcome: 'no_category_in_city', message: `В городе «${request.city}» нет категории «${request.category}» в этом каталоге. Это отсутствие профилей, а не занятость на выбранную дату.`,
    cards: [], funnel: funnel.slice(0, 2), suggestions: cities.map(city =>
      `В городе «${city}» есть ${vendors.filter(v => v.city === city && v.categories.includes(request.category)).length} профилей этой категории; дату и остальные условия нужно проверить отдельно.`),
  };
}

/** Input is validated by the API boundary; pure selection also supports test catalogs. */
export function matchVendors(request: MatchRequest, vendors: readonly Vendor[] = loadVendors()): MatchResponse {
  if (request.date < CALENDAR_START || request.date > CALENDAR_END) {
    return { outcome: 'date_out_of_range', message: `Дата ${request.date} вне календаря каталога: ${CALENDAR_START}–${CALENDAR_END}. Занятость за пределами этого окна неизвестна.`,
      cards: [], funnel: [], suggestions: [`Выберите дату с ${CALENDAR_START} по ${CALENDAR_END}.`] };
  }
  const { pool, funnel } = runFilters(request, vendors);
  if (funnel[1].left === 0) return emptyCategory(request, vendors, funnel);
  const shown = rankVendors(pool, request).slice(0, 3);
  const exclusions = funnel.slice(2).flatMap(step => step.dropped)
    .map(row => `${row.reason.toLocaleLowerCase('ru')}: ${row.count}`).join('; ');
  const detail = exclusions ? ` Последовательный отсев: ${exclusions}.` : ' В выбранном городе и категории больше профилей нет.';
  const outcome = shown.length === 3 ? 'matched' : shown.length > 0 ? 'partial' : 'none_pass';
  const message = outcome === 'matched'
    ? `Подходят ${pool.length} профилей; показаны первые 3 по совпадениям в описании и условиям. Цены указаны «от», итоговую стоимость нужно уточнить.`
    : outcome === 'partial' ? `Подходят только ${shown.length} из ${funnel[1].left} профилей — меньше трёх.${detail}`
      : `В городе есть ${funnel[1].left} профилей этой категории, но ни один не проходит все условия.${detail}`;
  return { outcome, message, cards: shown.map(vendor => explainVendor(vendor, shown, request)), funnel,
    suggestions: buildSuggestions(request, vendors, pool.length) };
}
