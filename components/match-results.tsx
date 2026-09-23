import type { Card, MatchResponse, SuggestionAction } from "@/lib/contract";

const money = (value: number) => new Intl.NumberFormat("ru-RU").format(value);
const outcomeLabels = {
  matched: "Есть из кого выбрать",
  partial: "Небольшой, но точный выбор",
  no_category_in_city: "В городе нет этой категории",
  none_pass: "Пока без совпадений",
  date_out_of_range: "Дата вне календаря",
};

function VendorCard({ card, index }: { card: Card; index: number }) {
  return (
    <article className="vendor-card contractor" data-testid="match-card">
      <div className="card-top">
        <span className="card-number">0{index + 1}</span>
      </div>
      <p className="card-category">{card.categories.join(" · ")}</p>
      <h3>{card.name}</h3>
      <p className="card-city">{card.city}</p>
      <p className="card-price">
        от {money(card.priceFrom)} <span>₸ / мероприятие</span>
      </p>
      <div className="explanation">
        <span className="eyebrow">Почему в подборке</span>
        <p>{card.explanation}</p>
      </div>
      <details className="card-facts">
        <summary>Все условия профиля</summary>
        <ul className="matched-list" aria-label="Совпавшие условия">
        {card.matched.map((fact, i) => (
          <li key={`${fact}-${i}`}>{fact}</li>
        ))}
        </ul>
      </details>
      <div className="data-labels">
        <span>
          {card.synthetic ? "Синтетический профиль" : "Исходный профиль"}
        </span>
        {card.priceImputed && <span>Цена подставлена в датасете</span>}
        {card.cityImputed && <span>Город подставлен в датасете</span>}
      </div>
    </article>
  );
}

export function MatchResults({
  result,
  date,
  testId = "match-results",
  loading = false,
  onApplySuggestion,
}: {
  result: MatchResponse;
  date: string;
  testId?: string;
  loading?: boolean;
  onApplySuggestion?: (action: SuggestionAction) => void;
}) {
  const formattedDate = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
  return (
    <section
      className="result-group"
      aria-label={`Подбор на ${date}`}
      data-testid={testId}
    >
      <div className="result-heading">
        <p className="eyebrow">{formattedDate}</p>
        <h2>{outcomeLabels[result.outcome]}</h2>
        <p>{result.message}</p>
      </div>
      <div className="cards">
        {result.cards.map((card, index) => (
          <VendorCard key={card.id} card={card} index={index} />
        ))}
      </div>
      {result.cards.length > 0 && <p className="card-note">Цены указаны «от»; итоговую смету и доступность нужно подтвердить у подрядчика.</p>}
      {result.cards.length === 0 && (
        <div className="empty-result">
          <span aria-hidden="true">∅</span>
          <p>Не добавляем неподходящие профили ради количества.</p>
        </div>
      )}
      {result.suggestions.length > 0 && (
        <aside className="suggestions">
          <h3>Что можно изменить</h3>
          <ul>
            {result.suggestions.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          {onApplySuggestion && result.suggestionActions?.map((action) => (
            <button className="suggestion-action" type="button" disabled={loading} key={action.label} onClick={() => onApplySuggestion(action)}>
              {action.label}
            </button>
          ))}
        </aside>
      )}
      <details className="funnel">
        <summary>Как прошёл отбор</summary>
        <ol>
          {result.funnel.map((step, i) => (
            <li key={`${step.step}-${i}`}>
              <div className="funnel-line">
                <span>{step.step}</span>
                <strong>{step.left} осталось</strong>
              </div>
              {step.dropped
                .filter((item) => item.count > 0)
                .map((item, j) => (
                  <p key={j}>
                    {item.reason}: −{item.count}
                  </p>
                ))}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
