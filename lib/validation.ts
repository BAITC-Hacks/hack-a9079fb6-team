import { z } from 'zod';
import { getCatalogOptions } from './catalog';
import type { CatalogOptions } from './contract';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна иметь формат ГГГГ-ММ-ДД')
  .refine(value => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Такой календарной даты нет');

export function matchRequestSchema(options: CatalogOptions = getCatalogOptions()) {
  const option = (values: string[]) => z.string().trim().refine(value => values.includes(value), 'Выберите значение из каталога');
  return z.object({
    city: option(options.cities), date: dateSchema,
    eventType: option(options.eventTypes), category: option(options.categories),
    budget: z.number().finite().nonnegative().max(1_000_000_000),
    hours: z.number().finite().positive().max(168).optional(),
    language: option(options.languages).optional(),
    wish: z.string().trim().max(1000).optional(),
  }).strict();
}
export const compareRequestSchema = (options?: CatalogOptions) => z.object({ request: matchRequestSchema(options), secondDate: dateSchema }).strict();
