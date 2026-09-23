import { getCatalogOptions } from '@/lib/catalog';
import { checkRateLimit, errorResponse, json } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET() {
  try { checkRateLimit(); return json(getCatalogOptions()); }
  catch (error) { return errorResponse(error); }
}
