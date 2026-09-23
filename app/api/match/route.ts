import { matchVendors } from '@/lib/match';
import { matchRequestSchema } from '@/lib/validation';
import { errorResponse, json, readJson } from '@/lib/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const query = matchRequestSchema().parse(await readJson(request));
    return json(matchVendors(query));
  } catch (error) { return errorResponse(error); }
}
