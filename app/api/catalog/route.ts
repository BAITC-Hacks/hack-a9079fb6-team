import { loadCatalog } from '@/lib/catalog-store';
import { checkRateLimit, errorResponse, json } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET() {
  try { checkRateLimit(); return json((await loadCatalog()).options); }
  catch (error) { return errorResponse(error); }
}
