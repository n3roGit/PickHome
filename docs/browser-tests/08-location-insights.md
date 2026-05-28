# Feature: Standort & Umfeld (Overpass, UBA-Lärm, BfG-Hochwasser)

Contract for apartment detail external location data. Master: [MCP_BROWSER_TEST_CHECKLIST.md](../MCP_BROWSER_TEST_CHECKLIST.md).

## Preconditions

- Local dev: `npm run db:push`, `npm run db:seed`, optional `npx tsx scripts/seed-readme-demo.ts`
- Log in as `demo` / `demo` (or any user with a project)
- Open an apartment with **geocoded coordinates** (address + successful geocode)

## Procedure

1. Navigate to `/project/{projectId}/apartment/{apartmentId}` (discover IDs from UI; do not hardcode production IDs).
2. Scroll to section **Standort & Umfeld** (below Anfahrt, above Finanzen).
3. Expand **Umgebung (OpenStreetMap)** — expect category counts or empty-state message; click **Aktualisieren** and confirm section reloads without error.
4. Expand **Lärm (UBA)** — expect hits or disclaimer that only major roads/rail/airports are mapped.
5. Expand **Hochwasser (BfG)** — expect HQ scenario badges or “kein Risiko”.
6. If toolbar warning badges appear (Hochwasser/Lärm), click one — page scrolls to `#location-insights`.
7. Open **Kriterien bewerten** — for noise-related criteria (e.g. Straßenlärm), optional UBA hint under slider when UBA returned data.
8. Export PDF (full) — section **Standort & Umfeld** present when data loaded.
9. Optional: LLM chat — ask “Liegt die Wohnung in einem Hochwassergebiet?” — answer should reference BfG block if cached.

## Pass criteria

- All three sub-panels render without server error
- Refresh buttons complete (page revalidates)
- Disclaimers visible for UBA empty-hit and BfG scope
- No PII from local dev DB in notes

## Known limits

- UBA: no full urban street noise coverage
- BfG: river flood zones only, not stormwater (Starkregen)
- Overpass: depends on public `overpass-api.de` rate limits
