# Listing import and KI assistant

Part of the [PickHome Browser Regression Guide](../MCP_BROWSER_TEST_CHECKLIST.md).

Apply shared rules from the master guide: **§2 Hard rules**, **§7 Evidence requirements**, **§8 Severity rules**.

---

### 12.17 Listing import and LLM assisted extraction

This section is the **browser contract** for listing/Auto-Fill behavior. API and client draft logic live in `src/lib/apartment-listing-import.ts`, `src/lib/listing-import-form.ts`, `src/lib/apartment-listing-draft.ts`, `src/lib/listing-field-suggestions.ts`, `src/components/ApartmentListingDraftRestore.tsx`, `src/components/ApartmentAutoFillButton.tsx`, and `POST /api/apartments/{id}/llm/extract`.

#### Data sources (priority)

1. **Listing URL** — `fetchListingPreview` (HTML scrape + optional LLM).
2. **PDF exposé** on the apartment — text from uploaded documents; merged when URL fails or to enrich fields.
3. If URL fetch fails **and** PDF text is shorter than ~80 characters → controlled error (no crash).
4. If URL is missing: extract may still run from PDF alone when enough text is present; otherwise `no_source` / `no_fields`.
5. **Apartment detail Auto-Fill only:** saved Stammdaten, Notizen, Beschreibung, Checkliste (status/note), and PDF text via `supplementalContext` — **not** used on project quick-add. Warning may include „bereits erfasste Angaben“; works with or without LLM (regex fallback).

#### Fields touched by import / Auto-Fill

| Field / area | Form location | `onlyEmpty` on Auto-Fill |
|---|---|---|
| Title | Anzeigename | Yes |
| Price, address, size, plot, energy | Preis & Adresse | Yes |
| Hausgeld, Heizkosten, Grundsteuer, Sanierung | Preis & Adresse (cost row) | Yes |
| Description | Beschreibung section | Yes |
| Broker involved | **Finanzen** (checkbox); hint to use „Übernehmen“ there | Yes |

Makler is **not** auto-saved with Preis & Adresse — UI tells user to confirm under **Finanzen**.

#### Portal / provider expectations (browser)

Test **at least two** readable provider categories per release when LLM/listing code changes. Do not document real URLs in session notes; use UI-discovered links.

| Provider category | Typical browser outcome | Notes |
|---|---|---|
| Readable aggregator / classifieds (e.g. immobilien.de-style) | Extract OK; price, size, energy often filled | Address may be incomplete (Ort/PLZ only) — user should correct before save |
| Broker agency detail page | Extract OK with PDF warning common | PDF regex fallback when LLM PDF step fails |
| Landing-page exposé host (e.g. `*.landingpage.immobilien`) | Extract OK; address often partial | Plot/description may come from PDF merge (values can differ from web snippet) |
| Major portal with bot protection (e.g. ImmobilienScout24, Kleinanzeigen) | **`fetch_failed`** / „Seite nicht lesbar“ | Accepted external failure if UI stays stable; existing DB data must not be wiped by Auto-Fill |
| PDF only, no listing URL | Success **or** `no_fields` | Depends on extractable PDF text; reindex PDF in project settings if needed |
| URL blocked + good PDF | Fallback message „Inserat-Seite nicht lesbar — versuche Exposé-PDF.“ then PDF fields | |

#### Apartment detail — Auto-Fill procedure (MCP)

1. Open apartment with listing URL and/or PDF (discovered from list „Inserat öffnen“ or detail form).
2. Optionally clear one disposable field (e.g. Grundstück m²) to verify `onlyEmpty`.
3. Expand **Inserat-Link** if URL is only in DB — confirm input matches expected host **category** (not a specific URL in this doc).
4. Click toolbar **Auto-Fill**.
5. Assert button shows **„wird verarbeitet“** then **Auto-Fill** again; toolbar layout does not jump.
6. Hover or read `title`: should mention „Leere Felder übernommen“, **„Abweichende KI-Vorschläge“** when applicable, listed fields, PDF/LLM warnings if any.
7. Verify only previously empty inputs changed; filled price/address unchanged when already set.
8. **KI-Vorschlag flow:** set one filled field to disagree with notes/PDF (e.g. Energieklasse **C** while extract expects **D**), run Auto-Fill — input stays **C**, **KI-Vorschlag: D** with **Übernehmen** / **Verwerfen** appears; **Übernehmen** updates only that field; **Verwerfen** removes the hint without changing the input.
9. Click **Speichern** under Preis & Adresse; expect `?basics_saved=1` or visible success.
10. Reload page; confirm saved fields persist.
11. If description was filled, save **Beschreibung** separately and reload again.
12. Reload without save after suggestion test — unsaved manual/accepted values must not persist.
13. **Draft restore:** save **Preis & Adresse**, reload — no flicker; optional second Auto-Fill does not overwrite saved basics (see [§12.15 draft procedure](03-apartment-checklist.md#draft-restore-procedure-mcp-after-auto-fill)).

Optional: `evaluate_script` → `fetch('/api/apartments/<id>/llm/extract', { method:'POST', body: JSON.stringify({ url }) })` to compare API vs UI (no PII in session notes).

Optional dev regression (no PII in notes): inject a stale `sessionStorage` draft with extra `fields` keys **not** in `pending` — after reload, non-pending inputs (title, price, address) must stay at SSR/DB values; only `pending` keys (e.g. description) may change.

#### Project tab — quick-add import procedure (MCP)

1. On **Immobilien** tab, paste listing URL into **Inserat-URL** (disposable test link from seed or synthetic listing).
2. Click **Daten automatisch füllen**.
3. Wait for **Wird ausgewertet…** → enabled **Immobilie hinzufügen**.
4. Confirm quick-add fields populated; message lists marked fields.
5. Submit **Immobilie hinzufügen** on disposable project or cancel after snapshot.

#### Must always hold

- Admin LLM settings can be saved when valid; connection test shows controlled success or failure.
- If LLM is not configured, extract/chat show controlled **503** / not-configured UI (no uncaught error).
- Listing import and Auto-Fill prefill **empty** fields only on extract (`onlyEmpty: true`).
- Session draft restore applies **pending** fields only on navigation/reload; **suggestionKeys** render as **KI-Vorschlag** UI, not silent overwrites.
- Saved sections (`title_saved`, `basics_saved`, etc.) are removed from draft on restore — must not reappear on reload.
- PDF context merges into preview; warnings distinguish LLM PDF success, regex fallback, and unreadable page.
- Broker detection sets checkbox in quick-add or hints „Übernehmen“ on detail page.
- Blocked portal: message **„Seite nicht lesbar“** or extract error in `title`; **no** Next.js overlay.
- Partial address from PDF (e.g. PLZ + „Ort“ without street) is a **data quality** issue, not a blocker, if user can edit and save.

#### Negative cases

- Missing API token / invalid LLM base URL / timeout / malformed model response
- Invalid listing URL
- `fetch_failed` on blocked portal
- PDF too short / no extractable text → `pdf_text_too_short` or `no_fields`
- Auto-Fill with no URL and no usable PDF → `no_source` or `no_fields`
- URL and PDF disagree (user must reconcile manually)
- User saves without reviewing bad autofill address (test that edit + save fixes list row)

#### Evidence

- Admin LLM settings snapshot
- Network: `POST /api/listing/preview` (project) and `POST /api/apartments/.../llm/extract` (detail) — status 200 vs 422/503
- Snapshots: toolbar loading state, filled form, save redirect query, reload
- No console errors

### 12.18 Immobilien-Assistent (KI chat)

Toolbar button **KI** opens modal dialog (`ApartmentLlmChatButton`). API: `POST /api/apartments/<apartmentId>/llm/chat` with `{ messages: ChatTurn[] }` (preferred — full in-modal history, up to 12 turns) or legacy `{ message, history }`. Server uses `runLlmChatWithOptionalWebSearch` (DuckDuckGo default) and embeds a chat recap in the system prompt when prior turns exist.

#### Prerequisites (browser)

- Admin → **KI**: Basis-URL, API-Token, and model saved; **Verbindung testen** succeeds.
- Without configuration, toolbar **KI** is **not rendered** (not merely disabled) — skip chat steps and record `llm_not_configured` in session notes.
- Disposable apartment with notes, description, and/or indexed PDF (`hasSourceText`).

#### Must always hold

- **KI** disabled when apartment has no source text (no PDF index / description / notes); enabled otherwise.
- Modal title **Immobilien-Assistent**; subtitle mentions optional Web-Recherche (DuckDuckGo).
- While request runs: visible **„tippt…“** in the message area (`aria-live="polite"`); input and **Senden** disabled.
- After response: **„tippt…“** disappears; assistant reply is normal German prose (no raw tool JSON).
- Answers must **not** show bare payloads like `{"type":"web_search","query":"…"}` — if the model emits that shape, server runs DuckDuckGo and returns a summarized answer instead.
- Property-only questions (e.g. „Was steht in den Notizen zur Energieklasse?“) answer from apartment context without requiring web search.
- Web-research questions (e.g. „Wie ist der Stadtteil …?“, „typische Sanierungskosten …?“) return a substantive answer **or** a controlled failure message (timeout, no results) — never an uncaught error or Next.js overlay.
- `POST …/llm/chat` returns **200** with `{ ok: true, answer, webSearchEnabled, webSearchUsed }` when LLM is configured; `webSearchUsed` may be true after external questions.
- Chat history in modal: last user + assistant turns visible; errors show in red banner without corrupting prior turns.
- Follow-up meta question (e.g. „Was habe ich davor gefragt?“) must answer from the visible in-modal history — not claim there were no prior messages.
- Finance estimate questions (e.g. „Was kostet mich das monatlich insgesamt?“, „Wie hoch sind die Kaufnebenkosten grob?“) use **Finanz-Schätzung (PickHome …)** context; answers must label values as **grobe Schätzung / Orientierung**, not as binding facts.
- Commute questions (e.g. „Wie weit ist es zur Arbeit?“) use **Fahrtwege (PickHome-Schätzung …)** from commute cache; if route not calculated, say so honestly — no invented times.
- Checklist questions (e.g. „Was wurde schon geprüft?“) use **Checkliste (PickHome)** entries with status and notes.
- Viewing questions (e.g. „Wann ist die nächste Besichtigung?“) use **Besichtigungstermine**; if none are stored, say so honestly.
- Price history questions (e.g. „Hat sich der Preis verändert?“) use **Preisverlauf**; if no history exists, say so honestly.
- BORIS questions (e.g. „Wie hoch ist der Bodenrichtwert?“) use **Bodenrichtwert (BORIS)**; if no coordinates or no BORIS data, say so honestly.
- Subsidy questions (e.g. „Welche Förderprogramme kommen in Frage?“) use **Förder-Hinweise (PickHome)** with program name and status.
- Cold rent questions (e.g. „Wie hoch ist die Kaltmiete?“) use the Stammdaten field **Kaltmiete monatlich**, not the finance estimate.
- Error banners in the modal (red box) must not remove prior chat turns; input and **Senden** stay usable after a failed request.

#### MCP procedure

1. Open disposable apartment with notes/description (or indexed PDF); project has Finanz-Annahmen (Eigenkapital, Laufzeit, Haushaltsnetto, optional Fixkosten); commute cache populated if testing Fahrtwege; prefer geocoded apartment with viewings, price history, and BORIS cache when testing new context sections.
2. Click toolbar **KI** — modal opens, no console errors.
3. Ask **„Was steht in den Notizen zur Energieklasse?“** → answer references on-page data; **tippt…** visible during wait.
4. Ask **„Wie hoch ist die Kaltmiete?“** → value from Stammdaten or honest „nicht hinterlegt“.
5. Ask **„Wann ist die nächste Besichtigung?“** → date from **Besichtigungstermine** or honest „kein Termin hinterlegt“.
6. Ask **„Hat sich der Preis seit dem ersten Eintrag verändert?“** → from **Preisverlauf** or honest „kein Preisverlauf“.
7. Ask **„Wie hoch ist der Bodenrichtwert?“** → EUR/m² from **Bodenrichtwert (BORIS)** or honest „keine Koordinaten / kein Wert“.
8. Ask **„Welche Förderprogramme kommen in Frage?“** → programs + status from **Förder-Hinweise (PickHome)**.
9. Ask **„Was kostet mich diese Immobilie monatlich insgesamt?“** → answer mentions Rate, Wohnnebenkosten, Fixkosten (if set), labels as Schätzung.
10. Ask **„Was wurde in der Checkliste schon geprüft?“** (when checklist entries exist) → status + notes from context.
11. Ask **„Suche im Internet: Wie sind die typischen Sanierungskosten pro m² in Deutschland?“** → wait for **tippt…** (may take longer) → prose answer with sources/domains or explicit failure; **no** JSON tool bubble; `webSearchUsed: true` in network response when search ran.
12. Ask **„Wie ist die Lage des Stadtteils und was kosten vergleichbare Objekte dort?“** → prose with sources or explicit „keine Treffer“ / controlled failure.
13. Ask **„Was habe ich als erstes gefragt?“** → assistant names or paraphrases the question from step 3.
14. **Error handling:** trigger a controlled failure (e.g. DevTools offline for one request, or POST with empty body via `evaluate_script`) → red error banner appears; prior turns from steps 3–13 remain visible; input and **Senden** stay enabled; no Next.js overlay.
15. Optional DevTools: `POST /api/apartments/<id>/llm/chat` status 200 for successful turns; request body includes full `messages` array; response JSON has string `answer`, not a JSON object as the only content.
16. Close modal with **×**; reopen — prior turns still visible in session until page reload.

#### Negative cases

- `llm_not_configured` → 503, German error in modal
- `no_source_text` → **KI** button disabled
- Empty message → no request
- `PICKHOME_WEB_SEARCH=0` → answers from property data only (no web claims)
- Failed chat request (timeout, network, invalid body) → red banner in modal; prior chat history preserved; input remains usable

#### Web search configuration (reference)

- **Default:** DuckDuckGo HTML — no `PICKHOME_WEB_SEARCH_API_KEY`.
- **Optional:** `PICKHOME_WEB_SEARCH_PROVIDER=tavily|brave` + API key; fallback to DuckDuckGo on API failure.
- Admin **KI** tab documents DuckDuckGo default and optional paid providers.

#### Evidence

- Snapshot: modal with **tippt…** (mid-request) and with final assistant answer
- Network: `llm/chat` 200
- Console: no errors
