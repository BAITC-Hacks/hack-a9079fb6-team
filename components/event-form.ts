import type { CompareResponse, MatchRequest, MatchResponse } from "@/lib/contract";

export type FormValues = {
  city: string;
  eventType: string;
  date: string;
  category: string;
  budget: string;
  hours: string;
  language: string;
  wish: string;
};
export type Result = {
  request: MatchRequest;
  first: MatchResponse;
  second?: MatchResponse;
  secondDate?: string;
  removed: CompareResponse["removed"];
};
export const initial: FormValues = {
  city: "",
  eventType: "",
  date: "2026-10-15",
  category: "Ведущий",
  budget: "1000000",
  hours: "",
  language: "",
  wish: "",
};
export const toForm = (q: MatchRequest): FormValues => ({
  city: q.city,
  eventType: q.eventType,
  date: q.date,
  category: q.category,
  budget: String(q.budget),
  hours: q.hours === undefined ? "" : String(q.hours),
  language: q.language ?? "",
  wish: q.wish ?? "",
});
export const toRequest = (q: FormValues): MatchRequest => ({
  city: q.city,
  eventType: q.eventType,
  date: q.date,
  category: q.category,
  budget: Number(q.budget),
  ...(q.hours ? { hours: Number(q.hours) } : {}),
  ...(q.language ? { language: q.language } : {}),
  ...(q.wish.trim() ? { wish: q.wish.trim() } : {}),
});
export const titles = [
  "Где пройдёт\nваше событие?",
  "Какой повод\nнас объединит?",
  "Добавим важные\nдетали.",
  "Вот кто подходит\nвашему событию.",
];
export const leads = [
  "Выберите город — здесь начнётся ваша история.",
  "Большой день или тёплый вечер. Выберите свой формат.",
  "Учитываем свободную дату, формат и ваш бюджет.",
  "До трёх вариантов с понятной причиной для каждого.",
];
export const eventInfo: Record<string, [string, string]> = {
  свадьба: ["Для большого «да»", "heart"],
  той: ["Когда рядом все свои", "spark"],
  корпоратив: ["Вне рабочих чатов", "people"],
  конференция: ["Для идей и встреч", "mic"],
  юбилей: ["Важная дата, близкие люди", "flower"],
  "день рождения": ["Ещё один прекрасный год", "spark"],
};
export const demos = [
  { key: "dense", label: "Популярная категория", detail: "Ведущие · Алматы" },
  { key: "rare", label: "Редкая категория", detail: "Флористы · Алматы" },
  { key: "none_pass", label: "Никто не подходит", detail: "Залы · декабрь" },
  { key: "no_category_in_city", label: "Категории нет в городе", detail: "Декоратор · Астана" },
] as const;

export class RequestError extends Error {}

export function resultTitle(result: Result | null): string {
  if (!result) return titles[3];
  if (result.second) return "Сравним варианты на две даты.";
  switch (result.first.outcome) {
    case "no_category_in_city": return "В городе нет\nэтой категории.";
    case "none_pass": return "По этим условиям\nнет совпадений.";
    case "date_out_of_range": return "Дата вне\nкалендаря каталога.";
    default: return `Подобрали ${result.first.cards.length} ${result.first.cards.length === 1 ? "вариант" : "варианта"}.`;
  }
}
