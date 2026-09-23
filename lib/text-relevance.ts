/** Deliberately lexical: recognizes local negation, without claiming semantic understanding. */
export const normalizeText = (text: string): string => text.toLocaleLowerCase('ru').replaceAll('ё', 'е');
type Term = { word: string; negative: boolean };
type Fragment = { source: string; terms: Term[] };

function localNegation(words: readonly string[], index: number): boolean {
  // A negated list can be long; a new prepositional phrase starts a new scope.
  const boundary = words.slice(0, index).findLastIndex(word =>
    ['с', 'со', 'в', 'во', 'на', 'для', 'по', 'к', 'ко', 'от', 'до', 'у', 'при', 'после'].includes(word));
  const preceding = words.slice(boundary + 1, index);
  const prefix = preceding.some((word, offset) => ['без', 'нет', 'исключая'].includes(word) ||
    (word === 'не' && !['только', 'просто'].includes(preceding[offset + 1] ?? words[index])));
  const following = words.slice(index + 1, index + 4).join(' ');
  return prefix || /^нет(?: |$)|^не (?:провод|выполн|предлага|дела|использ|буд)/u.test(following);
}

function fragments(text: string): Fragment[] {
  return text.split(/(?<=[.!?])\s+|\n+/u).filter(Boolean).map(source => {
    const normalized = normalizeText(source);
    // A conditional refusal applies to the requested style anywhere in this sentence.
    const refusal = /не\s+(?:подойдем|подходит|подходим|подойдет|наш\s+формат)/u.test(normalized);
    const terms = normalized.split(/[,;:—–]|\s+но\s+/u).flatMap(clause => {
      const words = clause.match(/[а-яa-z]+/gu) ?? [];
      return words.flatMap((word, index) => word.length < 4 ? [] : [{ word,
        negative: refusal || localNegation(words, index),
      }]);
    });
    return { source: source.trim(), terms };
  });
}

export function wishScorer(wish: string): (text: string) => { score: number; conflict: string } {
  const wishes = [...new Map(fragments(wish).flatMap(fragment => fragment.terms)
    .map(term => [`${term.word}:${term.negative}`, term])).values()];
  return text => {
    if (!wishes.length) return { score: 0, conflict: '' };
    const description = fragments(text);
    const results = wishes.map(wanted => {
      const occurrences = description.flatMap(fragment => fragment.terms
        .filter(term => term.word === wanted.word)
        .map(term => ({ ...term, source: fragment.source })));
      const conflict = occurrences.find(term => term.negative !== wanted.negative);
      return { score: conflict ? -(wishes.length + 2) : Number(occurrences.length > 0),
        conflict: conflict?.source ?? '' };
    });
    return { score: results.reduce((sum, result) => sum + result.score, 0),
      conflict: results.find(result => result.conflict)?.conflict ?? '' };
  };
}
