import { matchCatalog } from '@/lib/match';
import { loadCatalog } from '@/lib/catalog-store';
import { matchRequestSchema } from '@/lib/validation';
import { errorResponse, json, readJson } from '@/lib/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const catalog = await loadCatalog();
    const query = matchRequestSchema(catalog.options).parse(body);
    return json(matchCatalog(query, catalog));
  } catch (error) { return errorResponse(error); }
}
