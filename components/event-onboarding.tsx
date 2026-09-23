"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  CatalogOptions,
  CompareResponse,
  MatchRequest,
  MatchResponse,
} from "@/lib/contract";
import fixtures from "@/fixtures/demo-queries.json";
import citiesImage from "./assets/cities.png";
import { MatchResults } from "./match-results";
import { Icon } from "./ui-icon";
import { OnboardingAssistant } from "./onboarding-assistant";
import { EventDatePicker, BudgetPicker } from "./event-controls";

type FormValues = {
  city: string;
  eventType: string;
  date: string;
  category: string;
  budget: string;
  hours: string;
  language: string;
  wish: string;
};
type Result = {
  request: MatchRequest;
  first: MatchResponse;
  second?: MatchResponse;
  secondDate?: string;
  removed: CompareResponse["removed"];
};
const initial: FormValues = {
  city: "",
  eventType: "",
  date: "2026-10-15",
  category: "Ведущий",
  budget: "1000000",
  hours: "",
  language: "",
  wish: "",
};
const toForm = (q: MatchRequest): FormValues => ({
  city: q.city,
  eventType: q.eventType,
  date: q.date,
  category: q.category,
  budget: String(q.budget),
  hours: q.hours === undefined ? "" : String(q.hours),
  language: q.language ?? "",
  wish: q.wish ?? "",
});
const toRequest = (q: FormValues): MatchRequest => ({
  city: q.city,
  eventType: q.eventType,
  date: q.date,
  category: q.category,
  budget: Number(q.budget),
  ...(q.hours ? { hours: Number(q.hours) } : {}),
  ...(q.language ? { language: q.language } : {}),
  ...(q.wish.trim() ? { wish: q.wish.trim() } : {}),
});
const titles = [
  "Где пройдёт\nваше событие?",
  "Какой повод\nнас объединит?",
  "Добавим важные\nдетали.",
  "Вот кто подходит\nвашему событию.",
];
const leads = [
  "Выберите город — здесь начнётся ваша история.",
  "Большой день или тёплый вечер. Выберите свой формат.",
  "Учитываем свободную дату, формат и ваш бюджет.",
  "До трёх вариантов с понятной причиной для каждого.",
];
const eventInfo: Record<string, [string, string]> = {
  свадьба: ["Для большого «да»", "heart"],
  той: ["Когда рядом все свои", "spark"],
  корпоратив: ["Вне рабочих чатов", "people"],
  конференция: ["Для идей и встреч", "mic"],
  юбилей: ["Важная дата, близкие люди", "flower"],
  "день рождения": ["Ещё один прекрасный год", "spark"],
};
const demos = [
  { key: "dense", label: "Популярная категория", detail: "Ведущие · Алматы" },
  { key: "rare", label: "Редкая категория", detail: "Флористы · Алматы" },
  { key: "none_pass", label: "Никто не подходит", detail: "Залы · декабрь" },
] as const;

export function EventOnboarding() {
  const [form, setForm] = useState<FormValues>(initial);
  const [step, setStep] = useState(0);
  const [assistant, setAssistant] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [catalog, setCatalog] = useState<CatalogOptions | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [compare, setCompare] = useState(false);
  const [secondDate, setSecondDate] = useState("2026-12-19");
  const [announcement, setAnnouncement] = useState("");
  const active = useRef<AbortController | null>(null);
  const stageRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    try {
      setAssistant(
        localStorage.getItem("firebird-assistant-hidden") !== "true",
      );
      const saved: unknown = JSON.parse(
        sessionStorage.getItem("firebird-event-draft") || "null",
      );
      if (
        saved &&
        typeof saved === "object" &&
        "form" in saved &&
        saved.form &&
        typeof saved.form === "object"
      ) {
        const next = { ...initial };
        for (const key of Object.keys(initial) as (keyof FormValues)[]) {
          const value = (saved.form as Record<string, unknown>)[key];
          if (typeof value === "string" && value.length <= 1000)
            next[key] = value;
        }
        setForm(next);
        const savedStep =
          "step" in saved && typeof saved.step === "number"
            ? Math.min(2, Math.max(0, Math.floor(saved.step)))
            : 0;
        setStep(
          !next.city ? 0 : !next.eventType ? Math.min(1, savedStep) : savedStep,
        );
      }
    } catch {
      /* Persistence is optional. */
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(
        "firebird-event-draft",
        JSON.stringify({ form, step }),
      );
      localStorage.setItem("firebird-assistant-hidden", String(!assistant));
    } catch {
      /* Continue in memory. */
    }
  }, [form, step, assistant, hydrated]);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let disposed = false;
    setCatalogError("");
    fetch("/api/catalog", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Не удалось загрузить каталог. Попробуйте ещё раз.");
        return response.json() as Promise<CatalogOptions>;
      })
      .then((data) => {
        if (!disposed) setCatalog(data);
      })
      .catch((cause) => {
        if (!disposed)
          setCatalogError(
            controller.signal.aborted
              ? "Каталог не ответил за 10 секунд. Повторите загрузку."
              : cause instanceof Error
                ? cause.message
                : "Ошибка загрузки каталога.",
          );
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      disposed = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);
  useEffect(() => () => active.current?.abort(), []);
  function cancel() {
    active.current?.abort();
    active.current = null;
    setLoading(false);
  }
  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    cancel();
    setError("");
    setForm((previous) => ({ ...previous, [key]: value }));
    setResult(null);
  }
  function focusStage() {
    requestAnimationFrame(() => {
      stageRef.current?.focus({ preventScroll: true });
      stageRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  function move(next: number) {
    cancel();
    setError("");
    setStep(next);
    focusStage();
  }
  function toggleAssistant() {
    setAssistant((value) => !value);
    setAnnouncement(
      assistant
        ? "Диалог скрыт. Все условия сохранены."
        : "Помощник открыт на текущем шаге.",
    );
    requestAnimationFrame(() =>
      toggleRef.current?.focus({ preventScroll: true }),
    );
  }
  function next() {
    if (step === 0 && !form.city) {
      setError("Выберите город на карточке или в диалоге.");
      return;
    }
    if (step === 1 && !form.eventType) {
      setError("Выберите формат мероприятия.");
      return;
    }
    move(Math.min(2, step + 1));
  }
  async function run(request: MatchRequest, comparison = compare) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setLoading(true);
    setError("");
    setAnnouncement("Проверяем каталог и занятость…");
    try {
      const response = await fetch(comparison ? "/api/compare" : "/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(comparison ? { request, secondDate } : request),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          [
            payload.error || "Подбор не выполнен.",
            ...(payload.fields || []).map(
              (field: { message: string }) => field.message,
            ),
          ].join(" "),
        );
      if (active.current !== controller) return;
      const data: Result = comparison
        ? {
            request,
            first: (payload as CompareResponse).first,
            second: (payload as CompareResponse).second,
            secondDate,
            removed: (payload as CompareResponse).removed,
          }
        : { request, first: payload as MatchResponse, removed: [] };
      setResult(data);
      setStep(3);
      setAnnouncement(`Подбор завершён. ${data.first.message}`);
      focusStage();
    } catch (cause) {
      if (active.current !== controller) return;
      setError(
        controller.signal.aborted
          ? "Подбор занял больше 10 секунд. Попробуйте ещё раз."
          : cause instanceof Error
            ? cause.message
            : "Ошибка соединения. Попробуйте ещё раз.",
      );
      setAnnouncement("Подбор не выполнен. Можно повторить запрос.");
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) {
        active.current = null;
        setLoading(false);
      }
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(toRequest(form));
  }
  function demo(key: (typeof demos)[number]["key"]) {
    const values = toForm(fixtures[key]);
    setForm(values);
    setResult(null);
    setStep(2);
    setCompare(false);
    void run(toRequest(values), false);
  }
  function restart() {
    cancel();
    setForm({ ...initial });
    setResult(null);
    setCompare(false);
    setSecondDate("2026-12-19");
    setStep(0);
    setError("");
    setAnnouncement("Новый подбор. Выберите город.");
    focusStage();
  }
  const comparisonDirty =
    result &&
    (Boolean(result.second) !== compare ||
      (compare && result.secondDate !== secondDate));
  const primaryLabel =
    step === 0
      ? "Подобрать подрядчиков"
      : step === 1
        ? "Перейти к деталям"
        : compare
          ? "Сравнить даты"
          : "Подобрать подрядчиков";
  return (
    <>
      <a className="skip" href="#stage">
        Перейти к выбору
      </a>
      <header className="header">
        <a className="brand" href="/" aria-label="Firebird — главная">
          Firebird<span>.</span>
        </a>
        <span className="brand-note">
          Есть повод
          <br />
          собраться
        </span>
        <nav id="progress" aria-label="Этапы подбора">
          {["Город", "Повод", "Детали", "Подбор"].map((label, index) => (
            <button
              key={label}
              disabled={index > step}
              aria-current={index === step ? "step" : undefined}
              onClick={() => move(index)}
            >
              <span>
                {index < step ? <Icon name="check" size={12} /> : index + 1}
              </span>
              {label}
            </button>
          ))}
        </nav>
        <button
          className="assistant-toggle"
          ref={toggleRef}
          aria-controls={assistant ? "assistant" : undefined}
          aria-expanded={assistant}
          onClick={toggleAssistant}
        >
          <Icon name="chat" size={17} />
          {assistant ? "Скрыть диалог" : "Вернуть помощника"}
        </button>
      </header>
      <main className={`layout ${assistant ? "" : "without-assistant"}`}>
        <section className="stage" id="stage" ref={stageRef} tabIndex={-1}>
          <div className="eyebrow">
            <span />
            Ваше событие начинается здесь
          </div>
          <div className="chosen">
            {form.city && (
              <button onClick={() => move(0)}>
                <Icon name="pin" size={14} />
                {form.city}
                <span>Изменить</span>
              </button>
            )}
            {form.eventType && (
              <button onClick={() => move(1)}>
                <Icon name="spark" size={14} />
                {form.eventType}
                <span>Изменить</span>
              </button>
            )}
          </div>
          <h1>
            {titles[step].split("\n").map((line, index) => (
              <span key={line}>
                {index > 0 && <br />}
                {line}
              </span>
            ))}
          </h1>
          <p className="lead">{leads[step]}</p>
          {catalogError && (
            <div role="alert" className="error-box">
              <p>{catalogError}</p>
              <button onClick={() => setAttempt((value) => value + 1)}>
                Загрузить снова
              </button>
            </div>
          )}
          {!catalog && !catalogError && (
            <p role="status">Загружаем города и категории…</p>
          )}
          <div className="stage-body" key={step}>
            {step === 0 && (
              <>
                <div
                  className="cities"
                  role="group"
                  aria-label="Город мероприятия"
                >
                  {(catalog?.cities || [])
                    .filter((city) => city !== "Зарубежье")
                    .map((city) => (
                      <button
                        key={city}
                        className={`city-card ${city === "Астана" ? "astana" : "almaty"} ${form.city === city ? "selected" : ""}`}
                        aria-pressed={form.city === city}
                        onClick={() => update("city", city)}
                      >
                        <span
                          className="city-photo"
                          style={{ backgroundImage: `url(${citiesImage.src})` }}
                        />
                        <span className="city-check">
                          <Icon name="check" size={17} />
                        </span>
                        <span className="city-caption">
                          <span className="city-name">{city}</span>
                          <span className="city-desc">
                            {city === "Алматы"
                              ? "Ближе к горам. Ближе к своим."
                              : "Большой город для больших встреч."}
                          </span>
                        </span>
                        <span className="city-bottom">
                          <Icon name="pin" size={15} />
                          Казахстан
                          <span>
                            {form.city === city ? "Выбрано" : "Выбрать город"}
                            <Icon name="arrow" size={17} />
                          </span>
                        </span>
                      </button>
                    ))}
                </div>
                {catalog?.cities.includes("Зарубежье") && (
                  <button
                    className={`abroad ${form.city === "Зарубежье" ? "selected" : ""}`}
                    aria-pressed={form.city === "Зарубежье"}
                    onClick={() => update("city", "Зарубежье")}
                  >
                    <Icon name="globe" />
                    <span>
                      <strong>За пределами Казахстана</strong>
                      <small>Подрядчики из категории «Зарубежье»</small>
                    </span>
                    <Icon
                      name={form.city === "Зарубежье" ? "check" : "arrow"}
                    />
                  </button>
                )}
                <p className="photo-note">
                  Иллюстрации городов созданы с помощью AI
                </p>
              </>
            )}
            {step === 1 && (
              <div className="events" role="group" aria-label="Тип мероприятия">
                {(catalog?.eventTypes || []).map((value, index) => (
                  <button
                    key={value}
                    className={`event-card event-${index % 6} ${form.eventType === value ? "selected" : ""}`}
                    aria-pressed={form.eventType === value}
                    onClick={() => update("eventType", value)}
                  >
                    <span className="event-art">
                      <Icon name={eventInfo[value]?.[1] || "spark"} size={44} />
                      <i aria-hidden="true">
                        {["✧", "✳", "✦", "◌", "✽", "✹"][index % 6]}
                      </i>
                    </span>
                    <span className="event-name">
                      {value[0].toUpperCase() + value.slice(1)}
                    </span>
                    <small>
                      {eventInfo[value]?.[0] || "Соберите своих людей"}
                    </small>
                    <span className="event-check">
                      <Icon name="check" size={14} />
                    </span>
                  </button>
                ))}
              </div>
            )}
            {step === 2 && (
              <form id="details-form" onSubmit={submit} autoComplete="off">
                <div className="detail-pair">
                  <EventDatePicker
                    label="Дата мероприятия"
                    name="date"
                    value={form.date}
                    onChange={(value) => update("date", value)}
                  />
                  <BudgetPicker
                    value={form.budget}
                    onChange={(value) => update("budget", value)}
                  />
                </div>
                <fieldset>
                  <legend>Кого найдём первым?</legend>
                  <div className="category-options">
                    {[
                      ["Ведущий", "mic"],
                      ["Фотограф", "camera"],
                      ["Банкетный зал", "venue"],
                      ["Флорист", "flower"],
                    ]
                      .filter(([value]) => catalog?.categories.includes(value))
                      .map(([value, icon]) => (
                        <button
                          key={value}
                          type="button"
                          className={`category-option ${form.category === value ? "selected" : ""}`}
                          aria-pressed={form.category === value}
                          onClick={() => update("category", value)}
                        >
                          <Icon name={icon} size={23} />
                          {value === "Банкетный зал" ? "Площадка" : value}
                        </button>
                      ))}
                  </div>
                  <label className="all-categories">
                    Все категории
                    <select
                      name="category"
                      required
                      value={form.category}
                      onChange={(e) => update("category", e.target.value)}
                    >
                      {catalog?.categories.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </fieldset>
                <details>
                  <summary>
                    Язык, длительность и пожелания <span>Необязательно</span>
                  </summary>
                  <div className="detail-pair">
                    <label>
                      Язык
                      <select
                        name="language"
                        value={form.language}
                        onChange={(e) => update("language", e.target.value)}
                      >
                        <option value="">Любой язык</option>
                        {catalog?.languages.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Длительность, ч
                      <input
                        name="hours"
                        type="number"
                        min="0.5"
                        max="168"
                        step="0.5"
                        value={form.hours}
                        onChange={(e) => update("hours", e.target.value)}
                        placeholder="Например, 6…"
                      />
                    </label>
                  </div>
                  <label className="wish-label">
                    Пожелание
                    <textarea
                      name="wish"
                      maxLength={1000}
                      value={form.wish}
                      onChange={(e) => update("wish", e.target.value)}
                      placeholder="Например, импровизация и живой юмор…"
                    />
                    <small>Дополнительные слова для поиска в описаниях.</small>
                  </label>
                </details>
              </form>
            )}
            {step === 3 && result && (
              <>
                <form className="comparison-form" onSubmit={submit}>
                  <label className="compare-toggle">
                    <input
                      type="checkbox"
                      checked={compare}
                      onChange={(e) => {
                        cancel();
                        setError("");
                        setCompare(e.target.checked);
                      }}
                    />
                    Сравнить две даты
                  </label>
                  {compare && (
                    <EventDatePicker
                      label="Вторая дата"
                      name="secondDate"
                      value={secondDate}
                      onChange={(value) => {
                        cancel();
                        setError("");
                        setSecondDate(value);
                      }}
                    />
                  )}
                  {comparisonDirty && (
                    <p className="dirty-note" role="status">
                      Параметры сравнения изменены. Нажмите «{primaryLabel}»,
                      чтобы обновить результат.
                    </p>
                  )}
                  <button className="primary" disabled={loading || !catalog}>
                    {loading ? "Проверяем каталог…" : primaryLabel}
                    <Icon name="arrow" size={18} />
                  </button>
                </form>
                {result.second && (
                  <div
                    className="date-comparison"
                    data-testid="date-comparison"
                  >
                    <h2>Что изменилось на вторую дату</h2>
                    {result.first.outcome === "date_out_of_range" ||
                    result.second.outcome === "date_out_of_range" ? (
                      <p>
                        Одна из дат вне календаря. Доступность на неё
                        неизвестна.
                      </p>
                    ) : result.removed.length ? (
                      <ul>
                        {result.removed.map((item) => (
                          <li key={item.id}>
                            <strong>{item.name}</strong>:{" "}
                            {item.reason === "busy"
                              ? "занят на вторую дату"
                              : "не вошёл в первые три из-за ранжирования"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Карточки первой выдачи сохранились во второй.</p>
                    )}
                  </div>
                )}
                <MatchResults
                  result={result.first}
                  date={result.request.date}
                  testId={result.second ? "compare-first" : "match-results"}
                />
                {result.second && (
                  <MatchResults
                    result={result.second}
                    date={result.secondDate!}
                    testId="compare-second"
                  />
                )}
                <p className="result-footnote">
                  Доступность проверена по предоставленному календарю. Подбор не
                  бронирует подрядчика и не отправляет заявку.
                </p>
              </>
            )}
          </div>
          {error && (
            <p className="step-error" role="alert">
              {error}
            </p>
          )}
          <div className="stage-actions">
            {step > 0 ? (
              <button className="back" onClick={() => move(step - 1)}>
                <Icon name="back" size={16} />
                Назад
              </button>
            ) : (
              <span className="reassurance">
                <Icon name="check" size={15} />
                Без заявок и обязательств
              </span>
            )}
            {step < 3 ? (
              <button
                className="primary next"
                type={step === 2 ? "submit" : "button"}
                form={step === 2 ? "details-form" : undefined}
                disabled={loading || !catalog}
                onClick={
                  step < 2
                    ? (event) => {
                        event.preventDefault();
                        next();
                      }
                    : undefined
                }
              >
                {loading ? "Проверяем каталог…" : primaryLabel}
                <Icon name="arrow" size={19} />
              </button>
            ) : (
              <button className="back" onClick={() => move(2)}>
                Изменить условия <Icon name="arrow" size={16} />
              </button>
            )}
          </div>
          <section
            className="demo-section"
            aria-label="Демонстрационные запросы"
          >
            <p>Попробуйте готовый запрос</p>
            <div className="demo-buttons">
              {demos.map((item) => (
                <button
                  key={item.key}
                  disabled={!catalog || loading}
                  onClick={() => demo(item.key)}
                >
                  {item.label}
                  <small>{item.detail}</small>
                </button>
              ))}
            </div>
          </section>
        </section>
        {assistant && (
          <OnboardingAssistant
            step={step}
            city={form.city}
            eventType={form.eventType}
            cities={catalog?.cities || []}
            eventTypes={catalog?.eventTypes || []}
            message={result?.first.message}
            loading={loading}
            onHide={toggleAssistant}
            onCity={(value) => {
              update("city", value);
              move(1);
            }}
            onEvent={(value) => {
              update("eventType", value);
              move(2);
            }}
            onEdit={move}
          />
        )}
      </main>
      <footer className="footer">
        <span>Firebird · Есть повод собраться.</span>
        <button id="restart" onClick={restart}>
          Начать заново
        </button>
        <span>66 профилей · Без регистрации и ключей</span>
      </footer>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
    </>
  );
}
