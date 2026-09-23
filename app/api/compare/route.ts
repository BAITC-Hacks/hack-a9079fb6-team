import { loadVendors } from '@/lib/catalog';
import { matchVendors } from '@/lib/match';
import { compareRequestSchema } from '@/lib/validation';
import { errorResponse, json, readJson } from '@/lib/http';
import type { CompareResponse } from '@/lib/contract';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const input = compareRequestSchema().parse(await readJson(request));
    const vendors = loadVendors();
    const first = matchVendors(input.request, vendors);
    const second = matchVendors({ ...input.request, date: input.secondDate }, vendors);
    const validWindow = first.outcome !== 'date_out_of_range' && second.outcome !== 'date_out_of_range';
    const removed: CompareResponse['removed'] = validWindow ? first.cards
      .filter(card => !second.cards.some(other => card.id === other.id))
      .map(card => ({ id: card.id, name: card.name,
        reason: vendors.find(v => v.id === card.id)?.busyDates.includes(input.secondDate) ? 'busy' : 'ranking' })) : [];
    return json({ first, second, removed } satisfies CompareResponse);
  } catch (error) { return errorResponse(error); }
}
