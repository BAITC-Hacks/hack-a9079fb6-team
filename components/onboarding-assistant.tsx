import { Icon } from "./ui-icon";
type Props = {
  step: number;
  city: string;
  eventType: string;
  cities: string[];
  eventTypes: string[];
  message?: string;
  loading: boolean;
  onHide: () => void;
  onCity: (v: string) => void;
  onEvent: (v: string) => void;
  onEdit: (v: number) => void;
};
export function OnboardingAssistant({
  step,
  city,
  eventType,
  cities,
  eventTypes,
  message,
  loading,
  onHide,
  onCity,
  onEvent,
  onEdit,
}: Props) {
  const prompt = [
    "Привет! Я помогу собрать ваше событие. Начнём с места — где встретим гостей?",
    "Место выбрали. Теперь расскажите, какой у нас повод?",
    "Осталось немного: дата, бюджет и тот, кого ищем. Язык и длительность можно пропустить.",
    message ||
      "Объяснения в карточках помогут сравнить варианты. Условия можно изменить в любой момент.",
  ][step];
  return (
    <aside className="assistant" id="assistant" aria-label="Пошаговый помощник">
      <div className="assistant-head">
        <div className="orb small" aria-hidden="true" />
        <div>
          <h2>Ваш помощник</h2>
          <span>Соберём событие вместе</span>
        </div>
        <button
          className="hide-chat"
          onClick={onHide}
          aria-label="Скрыть диалог"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="assistant-body">
        <div className="assistant-intro">
          <div className="orb" aria-hidden="true" />
          <strong>
            Планы становятся
            <br />
            чуть проще.
          </strong>
          <p>Я рядом, если понадобится помощь.</p>
        </div>
        {step > 0 && (
          <div className="chat-history">
            <button
              type="button"
              onClick={() => onEdit(0)}
              aria-label={`Изменить город: ${city}`}
            >
              <Icon name={city === "Зарубежье" ? "globe" : "pin"} size={14} />
              {city}
              <span>Изменить</span>
            </button>
            {eventType && (
              <button
                type="button"
                onClick={() => onEdit(1)}
                aria-label={`Изменить формат: ${eventType}`}
              >
                {eventType}
                <span>Изменить</span>
              </button>
            )}
          </div>
        )}
        <div className="agent-message">
          <span className="mini-star" aria-hidden="true">
            ✦
          </span>
          <p>
            {loading ? "Проверяем условия и доступность в каталоге…" : prompt}
          </p>
        </div>
        <div className="quick-replies">
          {step === 0 &&
            cities.map((v) => (
              <button
                key={v}
                className={city === v ? "active" : ""}
                aria-pressed={city === v}
                onClick={() => onCity(v)}
              >
                {v === "Зарубежье" && <Icon name="globe" size={16} />}
                {v}
              </button>
            ))}
          {step === 1 &&
            eventTypes.map((v) => (
              <button
                key={v}
                className={eventType === v ? "active" : ""}
                aria-pressed={eventType === v}
                onClick={() => onEvent(v)}
              >
                {v}
              </button>
            ))}
          {step === 3 && (
            <>
              <button onClick={() => onEdit(2)}>
                Изменить дату или бюджет
              </button>
              <button onClick={() => onEdit(0)}>Выбрать другой город</button>
            </>
          )}
        </div>
        <div className="assistant-hint">
          <Icon name="pin" size={14} />
          Выбор в диалоге и на карточках всегда совпадает.
        </div>
      </div>
      <div className="assistant-bottom">
        <span className="online-dot" />
        <span>Пошаговый помощник · работает без AI</span>
        <button onClick={onHide}>Выбрать самостоятельно</button>
      </div>
    </aside>
  );
}
