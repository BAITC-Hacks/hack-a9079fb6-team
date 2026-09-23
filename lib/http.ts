import { z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function createRateLimiter(limit = 200, windowMs = 60_000) {
  let window = { start: Date.now(), count: 0 };
  return (now = Date.now()) => {
    const previous = now - window.start >= windowMs ? { start: now, count: 0 } : window;
    window = { ...previous, count: previous.count + 1 };
    if (window.count > limit) throw new HttpError(429, 'Слишком много запросов. Повторите через минуту.');
  };
}
export const checkRateLimit = createRateLimiter();
export const json = (value: unknown, status = 200) => Response.json(value, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});
export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return json({ error: 'Проверьте поля запроса.', fields: error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) }, 400);
  console.error('Request failed:', error instanceof Error ? error.message : 'unknown error');
  return json({ error: 'Не удалось выполнить подбор. Повторите запрос.' }, 500);
}
export async function readJson(request: Request): Promise<unknown> {
  checkRateLimit();
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  // Next can normalize request.url to localhost; Host preserves the browser authority.
  const expectedOrigin = `${url.protocol}//${request.headers.get('host') ?? url.host}`;
  if (origin && origin !== expectedOrigin) throw new HttpError(403, 'Запрос разрешён только с этого сайта.');
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new HttpError(415, 'Требуется Content-Type: application/json.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Отсутствует тело запроса.');
  let text = '';
  let size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new HttpError(413, 'Запрос слишком большой.'); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    try { return JSON.parse(text); } catch { throw new HttpError(400, 'Некорректный JSON.'); }
  } finally { reader.releaseLock(); }
}
