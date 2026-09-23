# Контракт API: единственный общий файл ядра и UI

Меняется только по согласию обоих. После реализации переносится в `lib/contract.ts`.

## POST /api/match

```ts
type MatchRequest = {
  city: string;            // "Алматы" | "Астана" | "Зарубежье"
  date: string;            // YYYY-MM-DD, окно 2026-09-23..2026-12-31
  eventType: string;       // свадьба | той | корпоратив | конференция | юбилей | день рождения
  category: string;        // одна из 17 категорий каталога
  budget: number;          // ₸
  hours?: number;
  language?: string;       // русский | казахский | английский
  wish?: string;           // опциональное пожелание свободным текстом
};

type Outcome =
  | "matched"              // 3 карточки
  | "partial"              // 1-2 карточки + почему меньше трёх
  | "no_category_in_city"  // в городе нет такой категории
  | "none_pass"            // кандидаты есть, никто не прошёл условия
  | "date_out_of_range";   // дата вне календаря каталога

type MatchResponse = {
  outcome: Outcome;
  message: string;         // человеческий текст исхода
  cards: Card[];           // 0..3
  funnel: { step: string; left: number; dropped: { reason: string; count: number }[] }[];
  suggestions: string[];   // «на 15.11 свободны 2», «при бюджете +100 000 ещё 1»
};

type Card = {
  id: string; name: string; categories: string[]; city: string; priceFrom: number;
  synthetic: boolean; priceImputed: boolean; cityImputed: boolean;
  matched: string[];       // какие условия совпали
  total: number;           // из скольких («совпало 5 из 5»)
  explanation: string;     // 1-2 предложения, только факты
  explanationSource: "llm" | "template";
};
```
