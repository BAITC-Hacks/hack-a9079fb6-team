import type { Vendor } from './catalog';
import type { MatchRequest } from './contract';
import { relevance } from './ranking';

const MAX_QUOTE_LENGTH = 140;
const features: readonly [RegExp, number][] = [
  [/фотожурнализм|документальн/u, 14], [/специализ|жанр/u, 8],
  [/песн|народн|национальн/u, 5], [/состав/u, 3], [/вокал/u, 8], [/квартет/u, 6], [/барабан|гитар|саксофон/u, 6],
  [/сценари|импровиза|репертуар/u, 8], [/оборудован|мультимеди|печать|монтаж|демонтаж/u, 10],
  [/флорист|цветочн|сезонн|привозн|инсталляц|неонов/u, 8],
  [/вместим|парковк|кейтеринг|террас|кухн/u, 8],
  [/язык/u, 8], [/опыт|авторск|фото|съёмк|съемк/u, 3],
  [/(?:опыт|работ|вед|рынк|индустри).{0,65}\d+\s*(?:лет|года?)(?!\p{L})/u, 18],
];

function excerpt(source: string): string {
  if (source.length <= MAX_QUOTE_LENGTH) return source.replace(/[.!?]+$/u, '');
  let text = source.slice(0, MAX_QUOTE_LENGTH - 1).replace(/\s+\S*$/u, '');
  // Prefer the end of a listed item to a half-finished phrase; retain a literal source prefix.
  const boundary = Math.max(text.lastIndexOf(','), text.lastIndexOf(';'));
  if (boundary >= 65) text = text.slice(0, boundary);
  text = text.replace(/(?:\s+(?:для|на|в|с|и|по|от|до|под|из|к|или|за|как|\d+))+$/iu, '');
  return `${text.replace(/(?:[.!?,;:\s—–•-]|\p{Extended_Pictographic}|\uFE0F|\u200D)+$/u, '')}…`;
}

function usefulness(text: string, request: MatchRequest): number {
  const lower = text.toLocaleLowerCase('ru');
  const specifics = features.reduce((sum, [pattern, weight]) => sum + (pattern.test(lower) ? weight : 0), 0);
  const introduction = /меня зовут|^являюсь|^мы\s*[—–-]|^я\s*(?:[—–-]\s*)?(?:свадебн|профессиональн|ведущий|фотограф)/u.test(lower);
  const advertising = /№\s*1|топ[-\s]?\d|лучш|идеальн|незабываем|гарантир|безупреч/u.test(lower);
  return specifics + relevance(text, request) * 4 - (introduction ? 25 : 0) -
    (advertising ? 15 : 0) - Math.max(0, text.length - 100) / 10;
}

/** Select a useful verbatim excerpt, never paraphrase or convert advertising into verified fact. */
export function profileEvidence(vendor: Vendor, shown: readonly Vendor[], request: MatchRequest): string {
  const fragments = vendor.description.split(/(?<=[.!?])\s+|\n+|•|(?<=лет)\s+(?=[А-ЯЁ][а-яё]+\s)/u)
    .map(text => text.trim()).filter(Boolean).map(excerpt).filter(Boolean);
  const others = shown.filter(other => other.id !== vendor.id).map(other => other.description.toLocaleLowerCase('ru'));
  const candidates = fragments.map((text, index) => ({ text, index, score: usefulness(text, request) }))
    .filter(candidate => candidate.score > 0);
  const distinctive = candidates.filter(candidate => candidate.score > 0 &&
    others.every(description => !description.includes(candidate.text.replace(/…$/u, '').toLocaleLowerCase('ru'))));
  return [...(distinctive.length ? distinctive : candidates)]
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.text ?? '';
}
