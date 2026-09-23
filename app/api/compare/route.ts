import { loadCatalog } from '@/lib/catalog-store';
import { matchCatalog } from '@/lib/match';
import { compareRequestSchema } from '@/lib/validation';
import { errorResponse, json, readJson } from '@/lib/http';
import type { CompareResponse } from '@/lib/contract';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const catalog = await loadCatalog();
    const input = compareRequestSchema(catalog.options).parse(body);
    const first = matchCatalog(input.request, catalog);
    const second = matchCatalog({ ...input.request, date: input.secondDate }, catalog);
    const validWindow = first.outcome !== 'date_out_of_range' && second.outcome !== 'date_out_of_range';
    const removed: CompareResponse['removed'] = validWindow ? first.cards
      .filter(card => !second.cards.some(other => card.id === other.id))
      .map(card => ({ id: card.id, name: card.name,
        reason: catalog.findById(card.id)?.busyDates.includes(input.secondDate) ? 'busy' : 'ranking' })) : [];
    return json({ first, second, removed } satisfies CompareResponse);
  } catch (error) { return errorResponse(error); }
}
