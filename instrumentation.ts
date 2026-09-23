/** Import and validate the catalog before this server instance accepts requests. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { loadCatalog } = await import('./lib/catalog-store');
    await loadCatalog();
  }
}
