# Контракт API: единственный общий файл ядра и UI

Типы реализованы в `lib/contract.ts`; при изменении контракта ядро, API, UI и этот документ обновляются согласованно.

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
  suggestionActions?: SuggestionAction[]; // конкретные изменения для повторного подбора
};

type SuggestionAction = {
  label: string;
  changes: Partial<Pick<MatchRequest, "date" | "budget" | "city">>;
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

## Реализация и валидация

Исполняемые типы: `lib/contract.ts`; описанные выше поля сохранены. JSON не должен содержать `expected` из демо-fixtures. Валюта — тенге, бюджет неотрицательный, конечный, до 1 млрд; часы при наличии >0 и ≤168; пожелание до 1000 символов. Город, категория, формат и язык должны существовать в каталоге. Невозможные даты отклоняются.

`matched` и `partial` — один успешный пользовательский исход ТЗ с разным числом карточек. `date_out_of_range` возвращается для существующей календарной даты вне окна, без выдумывания доступности.

`suggestions` остаётся человекочитаемым списком для совместимости. `suggestionActions` содержит готовые подписи кнопок и значения для нового запроса; текст советов разбирать не нужно. Каждое действие меняет ровно одно поле исходного запроса, остальные условия сохраняются. Дата — ближайшая дата с большим числом подходящих профилей (при равенстве расстояния выбирается более поздняя); бюджет — минимальная стартовая цена, добавляющая свободного подрядчика при остальных прежних условиях. Например: `{label: "Бюджет 150 000 ₸", changes: {budget: 150000}}`.

При `no_category_in_city` действие «Проверить в городе …» меняет город, но не обещает наличия подходящих по всем условиям профилей. При `date_out_of_range` действий нет. Клиент выполняет новый запрос только после нажатия кнопки; сервер снова валидирует все поля и выполняет подбор. Отсутствующее поле или пустой список означает, что доступных действий нет.

- HTTP200: `MatchResponse`, в том числе доменные пустые исходы.
- HTTP400: `{error, fields?}` для некорректного JSON/полей.
- HTTP403: запрос с другого Origin.
- HTTP413: тело больше 8192 байт.
- HTTP415: Content-Type не application/json.
- HTTP429: превышен лимит процесса (200 запросов/минуту).
- HTTP500: безопасное сообщение без внутренних подробностей.

## GET /api/catalog

Возвращает `{cities, categories, eventTypes, languages}` — списки из исходного каталога. Не отдаёт исходные описания или календари в браузер.

## POST /api/compare

Вход: `{request: MatchRequest, secondDate: string}`. Выход: `{first: MatchResponse, second: MatchResponse, removed: {id: string, name: string, reason: "busy" | "ranking"}[]}`.

`removed` — карточки первой выдачи, отсутствующие во второй. `busy` выставляется только при наличии второй даты в `busyDates`; иначе `ranking`. При дате вне окна список `removed` пуст: неизвестную доступность нельзя выдавать за занятость.
