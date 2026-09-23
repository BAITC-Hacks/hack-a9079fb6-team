'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CatalogOptions, CompareResponse, MatchRequest, MatchResponse } from '@/lib/contract';
import fixtures from '@/fixtures/demo-queries.json';
import { MatchResults } from '@/components/match-results';

type FormValues = { city: string; date: string; eventType: string; category: string; budget: string; hours: string; language: string; wish: string };
type Result = { request: MatchRequest; first: MatchResponse; second?: MatchResponse; secondDate?: string; removed: CompareResponse['removed'] };
const toForm = (request: MatchRequest): FormValues => ({ city: request.city, date: request.date, eventType: request.eventType, category: request.category, budget: String(request.budget), hours: request.hours === undefined ? '' : String(request.hours), language: request.language ?? '', wish: request.wish ?? '' });
const toRequest = (form: FormValues): MatchRequest => ({ city: form.city, date: form.date, eventType: form.eventType, category: form.category, budget: Number(form.budget), ...(form.hours ? { hours: Number(form.hours) } : {}), ...(form.language ? { language: form.language } : {}), ...(form.wish.trim() ? { wish: form.wish.trim() } : {}) });
const demos = [{ key: 'dense', label: 'Популярная категория', detail: 'Ведущие · Алматы' }, { key: 'rare', label: 'Редкая категория', detail: 'Флористы · Алматы' }, { key: 'none_pass', label: 'Никто не подходит', detail: 'Залы · декабрь' }] as const;

export default function Home() {
  const [form, setForm] = useState<FormValues>(() => toForm(fixtures.dense));
  const [catalog, setCatalog] = useState<CatalogOptions | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [compare, setCompare] = useState(false);
  const [secondDate, setSecondDate] = useState(fixtures.dense_other_date.date);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError('');
    fetch('/api/catalog', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Не удалось загрузить каталог. Попробуйте ещё раз.');
      return response.json() as Promise<CatalogOptions>;
    }).then(setCatalog).catch((cause: unknown) => {
      if (!controller.signal.aborted) setCatalogError(cause instanceof Error ? cause.message : 'Не удалось загрузить каталог.');
    });
    return () => controller.abort();
  }, [catalogAttempt]);
  useEffect(() => () => active.current?.abort(), []);

  function cancelPending() {
    active.current?.abort();
    active.current = null;
    setLoading(false);
    setError('');
  }
  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    cancelPending();
    setForm(previous => ({ ...previous, [key]: value }));
  }
  async function run(request: MatchRequest, comparison: boolean) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true); setError('');
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(comparison ? '/api/compare' : '/api/match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(comparison ? { request, secondDate } : request), signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось выполнить подбор. Попробуйте ещё раз.');
      if (active.current !== controller) return;
      if (comparison) {
        const data = payload as CompareResponse;
        setResult({ request, first: data.first, second: data.second, secondDate, removed: data.removed });
      } else setResult({ request, first: payload as MatchResponse, removed: [] });
      setTimeout(() => {
        resultsRef.current?.focus({ preventScroll: true });
        resultsRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }, 0);
    } catch (cause: unknown) {
      if (active.current !== controller) return;
      setError(controller.signal.aborted ? 'Подбор занял больше 10 секунд. Попробуйте ещё раз.' : cause instanceof Error ? cause.message : 'Ошибка соединения. Попробуйте ещё раз.');
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) { setLoading(false); active.current = null; }
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void run(toRequest(form), compare); }
  function demo(key: typeof demos[number]['key']) {
    const next = toForm(fixtures[key]);
    setForm(next); setCompare(false);
    void run(toRequest(next), false);
  }
  const dirty = result && (JSON.stringify(result.request) !== JSON.stringify(toRequest(form)) || Boolean(result.second) !== compare || (compare && result.secondDate !== secondDate));

  return <>
    <a className="skip-link" href="#match-form">Перейти к подбору</a>
    <header className="site-header"><a className="brand" href="/" aria-label="Firebird — главная"><span className="brand-mark" aria-hidden="true">f</span>firebird<span className="brand-dot">.</span></a><span className="header-note">Умный подбор подрядчиков</span><span className="header-pill">HackAlem · #79-lite</span></header>
    <main>
      <section className="hero"><div><p className="eyebrow">Меньше поиска. Больше ясности.</p><h1>Ваше событие.<br /><span>Подходящие люди.</span></h1><p className="hero-description">До трёх подрядчиков под вашу дату и бюджет.<br className="desktop-break" /> С конкретным объяснением, почему каждый в подборке.</p></div><div className="hero-note"><span className="hero-note-number">03</span><p>карточки максимум.<br />Только те, кто проходит условия.</p></div></section>
      <section className="demo-section" aria-label="Демонстрационные запросы"><p className="demo-label">Попробуйте на примере</p><div className="demo-buttons">{demos.map(item => <button className="demo-button" type="button" key={item.key} onClick={() => demo(item.key)} disabled={loading || !catalog}><span>{item.label}</span><small>{item.detail}</small><span className="demo-arrow" aria-hidden="true">↗</span></button>)}</div></section>
      <section className="workspace"><aside className="search-panel"><div className="section-heading"><span className="eyebrow">01 / Условия</span><h2>Расскажите о событии</h2></div>
        {catalogError && <div role="alert" className="error-box">{catalogError}<button type="button" className="text-button" onClick={() => setCatalogAttempt(value => value + 1)}>Загрузить снова</button></div>}
        {!catalog && !catalogError && <p role="status">Загружаем категории каталога…</p>}
        <form id="match-form" onSubmit={submit}>
          <div className="field-pair"><label>Город<select value={form.city} onChange={event => update('city', event.target.value)} required>{(catalog?.cities ?? [form.city]).map(value => <option key={value}>{value}</option>)}</select></label><label>Дата<input type="date" required min="2026-09-23" max="2026-12-31" value={form.date} onChange={event => update('date', event.target.value)} /></label></div>
          <label>Тип мероприятия<select value={form.eventType} onChange={event => update('eventType', event.target.value)} required>{(catalog?.eventTypes ?? [form.eventType]).map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Категория подрядчика<select value={form.category} onChange={event => update('category', event.target.value)} required>{(catalog?.categories ?? [form.category]).map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Бюджет, ₸<input type="number" required min="0" max="1000000000" step="1" value={form.budget} onChange={event => update('budget', event.target.value)} /></label>
          <details className="optional-fields"><summary>Язык, длительность и пожелания</summary><div className="field-pair"><label>Язык<select value={form.language} onChange={event => update('language', event.target.value)}><option value="">Любой</option>{catalog?.languages.map(value => <option key={value}>{value}</option>)}</select></label><label>Длительность, ч<input type="number" min="0.5" max="168" step="0.5" placeholder="Неважно" value={form.hours} onChange={event => update('hours', event.target.value)} /></label></div><label>Пожелание<textarea maxLength={1000} rows={3} placeholder="Например, опыт деловых мероприятий" value={form.wish} onChange={event => update('wish', event.target.value)} /></label><p className="field-help">Пожелание не меняет обязательные условия отбора.</p></details>
          <label className="checkbox-label"><input type="checkbox" checked={compare} onChange={event => { cancelPending(); setCompare(event.target.checked); }} />Сравнить две даты</label>
          {compare && <label>Вторая дата<input type="date" required min="2026-09-23" max="2026-12-31" value={secondDate} onChange={event => { cancelPending(); setSecondDate(event.target.value); }} /></label>}
          <button className="primary-button" type="submit" disabled={loading || !catalog}>{loading ? 'Проверяем условия…' : compare ? 'Сравнить даты' : 'Подобрать подрядчиков'}<span aria-hidden="true">→</span></button>
          <p className="field-help">Календарь: 23 сентября — 31 декабря 2026.<br />Без регистрации и бронирования.</p>
        </form>
      </aside>
      <section className="results-panel" ref={resultsRef} tabIndex={-1} aria-label="Результаты подбора" aria-busy={loading}>
        <div className="results-top"><span className="eyebrow">02 / Подборка</span><span className="offline-label"><span />По данным каталога</span></div>
        <div aria-live="polite" className={loading ? 'status-message' : 'sr-only'}>{loading ? 'Подбираем подрядчиков…' : result ? `Подбор завершён. ${result.first.message}` : ''}</div>
        {error && <div role="alert" className="error-box">{error}</div>}
        {dirty && <p className="stale-notice">Условия изменены. Нажмите кнопку подбора, чтобы обновить результат.</p>}
        {!result && !loading && <div className="initial-state"><div className="initial-symbol" aria-hidden="true">✳</div><h2>Хороший выбор начинается<br />с ваших условий</h2><p>Задайте дату, категорию и бюджет — проверим доступность и объясним каждую рекомендацию.</p><div className="initial-steps"><span>01 Проверим дату</span><span>02 Сопоставим условия</span><span>03 Объясним выбор</span></div></div>}
        {result && <><p className="result-context">{result.request.city} · {result.request.category} · {result.request.eventType} · до {Number(result.request.budget).toLocaleString('ru-RU')} ₸</p>{result.second && <aside className="comparison-note"><h3>Что изменилось на вторую дату</h3>{result.removed.length ? <ul>{result.removed.map(item => <li key={item.id}><strong>{item.name}</strong>: {item.reason === 'busy' ? 'занят на вторую дату — исключён.' : 'не вошёл в тройку после ранжирования; это не означает занятость.'}</li>)}</ul> : <p>Все карточки первой подборки остались во второй.</p>}</aside>}<div className={result.second ? 'results-columns' : ''}><MatchResults result={result.first} date={result.request.date} testId={result.second ? 'compare-first' : 'match-results'} />{result.second && result.secondDate && <MatchResults result={result.second} date={result.secondDate} testId="compare-second" />}</div></>}
      </section></section>
    </main><footer><span className="footer-brand">Firebird / HackAlem</span><p>Рекомендация — повод обсудить детали. Доступность и итоговую стоимость подтвердите с подрядчиком.</p></footer>
  </>;
}
