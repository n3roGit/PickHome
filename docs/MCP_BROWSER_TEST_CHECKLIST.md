# MCP Browser Test Guide (Chrome DevTools)

Procedure for smoke-testing PickHome in the browser via **Chrome DevTools MCP** (`user-chrome-devtools`).
Use with **any** local database (seed, empty, or imported backup). Do not document real usernames, project names, addresses, or IDs in this file.

## Before you start

1. `npm run dev` — note the port from the terminal (often `3000` or `3001`).
2. Base URL: `http://localhost:<port>` — use this port everywhere; do not assume `3000`.
3. MCP connected in Cursor.
4. Pick credentials that work in **your** `data/` DB:
   - Fresh seed: admin user from `prisma/seed` (see seed script, not repeated here).
   - After backup import: run `node scripts/set-dev-logins.mjs` so each user's password equals their username, or use credentials you set locally.
5. **Environment:** If dev port ≠ `3000`, set `NEXT_PUBLIC_APP_URL=http://localhost:<port>` (e.g. in `.env.local`) so the Kalender iCal link matches the running server. Default without env is `http://localhost:3000`.
6. Discover targets at runtime (do not hardcode):
   - **Admin:** `/dashboard` lists all projects; open any card.
   - **Regular user:** `/dashboard` shows «Meine Projekte»; open a project you are a member of.
   - **Apartment:** first row on project «Immobilien» tab, or any listing with an address.
   - **Apartment with viewings:** needed for Kalender tab; pick one that shows «Besichtigung» on the list or open units until viewings exist.
   - **Apartment with coordinates:** needed for Karte; prefer listings where «Adressen auf Karte laden» shows a coordinate count > 0.
   - **Area filter active:** project where map tab shows overlay toggle or collapsible «Wunschgebiet» / «NoGo-Zone» with saved PLZ.
   - **Team ratings:** apartment where «Meinungsunterschiede» can appear (multiple members rated criteria).
7. **Data hygiene:** Switching Wunschgebiet ↔ NoGo on a shared test project changes list badges for everyone — prefer a disposable project or revert mode after map tests.

Use `take_snapshot` after each navigation; on errors check `list_console_messages` and the Next.js overlay.

## Recommended run order

Walk steps in this sequence so auth and project context stay consistent:

1. Auth and global (login, roles, footer)
2. Account settings (admin account)
3. Admin tabs (users → backup → timezone → **KI**)
4. Dashboard (admin, then user after logout/login)
5. One project — tabs in order: **immobilien → archiv → team → settings → criteria → checklist → compare → map → calendar**
6. Apartment detail (from immobilien list)
7. Optional: mobile viewport, backup download, TOTP full activation

## Auth and global

| Step | Route / action | Expect |
|------|----------------|--------|
| Login form | `/login` | Fields Benutzername, Passwort, «Anmeldung speichern», Anmelden |
| Bad password | wrong credentials | «Benutzername oder Passwort falsch.» |
| Admin login | valid admin user | Redirect `/admin`; nav: Projekte, **Verwaltung**, Einstellungen; user label «Administrator» |
| User login | valid non-admin user | `/dashboard`; nav: Projekte, Einstellungen only — **no** «Verwaltung» |
| Logout | Abmelden | Back to `/login` |
| Remember login | checkbox on + login | Optional: Network → login response → `Set-Cookie` on `ph_session` with long `Max-Age` (e.g. ~30 days) |
| TOTP setup | `/account/settings` → «Einrichtung starten» | QR + secret text + code field; «Abbrechen» leaves 2FA off |
| TOTP login | after full activation | Re-login → `/login/totp` challenge (optional; do not leave admin locked without recovery codes) |
| Footer | any page | Installed version; optional GitHub «Neue Version … verfügbar» link |

## Account settings (`/account/settings`)

- Admin: «← Zurück» points to `/admin`.
- Standard-Verkehrsmittel: change + Speichern (e.g. Rad).
- Firmenwagen checkbox + Bruttolistenpreis; **Arbeitsstätte** on work address (required for commute cost on apartments); Pendlerpauschale fields (optional).
- Meine Adressen: form «Adresse hinzufügen» (submit optional).
- Passwort ändern: three fields + Speichern (optional).
- 2FA: «Einrichtung starten» → confirm step (`?step=confirm`); cancel without activating unless testing full flow.

## Admin (`/admin`)

Tabs: **Benutzer**, **Sicherung**, **Zeitzone**, **KI**.

### Benutzer (`?tab=users` or default)

- User table with role and project count.
- «Neuer Benutzer» form (create/delete optional).

### Sicherung (`?tab=backup`)

- Manual block: «Backup herunterladen», import file + confirmation checkbox (import only with synthetic/test ZIP).
- **Auto-backup:** block loads (not stuck on «Lade Einstellungen…»); toggle, time, retention, optional subdirectory; «Einstellungen speichern», «Jetzt sichern».
- **Saved backups list:** rows with Download / Wiederherstellen / Löschen (download optional).

### Zeitzone (`?tab=timezone`)

- IANA combobox + Speichern (e.g. `Europe/Berlin` visible).

### KI (`?tab=llm`)

- Form: Basis-URL, Modell, **System-Prompt** (Textarea, Standard wiederherstellen), API-Token (maskiert; leer = unverändert).
- **Speichern** → Erfolgsmeldung; `PUT /api/admin/settings/llm` → `200`.
- **Verbindung testen** → `POST /api/admin/settings/llm/test` → `200`, Meldung mit GET `/models`.
- Nach Schema-Änderung an `AppSettings.llmModel`: Dev-Server neu starten + `npx prisma generate` (sonst Speichern fehlgeschlagen).

## Dashboard (`/dashboard`)

- Admin: heading «Alle Projekte», project cards, «Neues Projekt» form (name + budget; create optional).
- User: «Meine Projekte» only; member projects listed.
- Open one project card → `/project/<id>`.

## Roles and access (two accounts)

- Regular user: open `/admin` → redirect to `/dashboard` (not `/login`).
- Admin: open any project from «Alle Projekte» without being a member.

## Project — all tabs

URL pattern: `/project/<projectId>?tab=<tab>`. Tabs: default (immobilien), `archived`, `team`, `settings`, `criteria`, `checklist`, `compare`, `map`, `calendar`.

Project header: name, budget, «Projekt löschen» (if permitted).

### Immobilien (default tab)

- Score legend: Grün / Gelb / Rot / DB.
- Sortierung (Score, Preis, €/Punkt, Datum) + Reihenfolge; search «Immobilien durchsuchen».
- Per row: title link, optional «Inserat öffnen ↗», address, budget hint («unter/über Budget»), score, criteria count; if checklist configured: second progress bar labelled **Checkliste** (link to fill page).
- «Immobilie hinzufügen» + Inserat-URL «Daten laden» (optional).
- If area filter configured: badges «Im Wunschgebiet» / «Außerhalb …» or NoGo variants («In NoGo-Zone» / «Außerhalb NoGo-Zone»).
- Open one apartment → detail page.

### Archiv (`?tab=archived`)

- Empty state or archived listings; restore/delete if entries exist (optional).
- Same checklist progress bar on rows when project has checklist points (as immobilien tab).

### Team (`?tab=team`)

- «Projektmitglieder» list; creator may show «Erstellt das Projekt».
- «Person hinzufügen» with username field + «Hinzufügen».

### Einstellungen (`?tab=settings`)

- Projekt name/budget; Kaufnebenkosten; Finanzierung; Dealbreaker-Schwelle.
- «PDFs neu einlesen», **«Adressen jetzt anreichern»** (Wunschgebiet/OSM), «Koordinaten neu indizieren» buttons present.
- «Adressen jetzt anreichern»: status while running; after completion message with count (e.g. «N Adresse(n) angereichert»); apartment detail links here via «Alle Adressen im Projekt anreichern».

### Kriterien (`?tab=criteria`)

- Dealbreaker hint with threshold from project settings.
- Groups with weights, dealbreaker toggles, reorder, «Gruppe anlegen», per-group «Neues Kriterium».

### Checkliste (`?tab=checklist`)

- Summary: point count, criterion vs custom split.
- Per criterion: checkbox to include; when checked, **Zuordnung** radios (Beide / per member).
- Per group: optional **Makler-Fragen** textarea (saved on blur).
- **Zusätzliche Punkte:** add custom item (name + group); assignee like criteria.
- Tab label «Checkliste (N)» matches enabled point count.

### Vergleich (`?tab=compare`)

- Up to 5 checkboxes; empty state until selection.
- Select 2+ apartments → comparison tables appear.

### Karte (`?tab=map`)

- Leaflet map; «Adressen auf Karte laden»; coordinate count increases when addresses geocoded.
- Marker popup: «Street View öffnen ↗» → `google.com/maps` with `map_action=pano` and stored coordinates (`target=_blank`).
- Layer control (top-right): **OpenStreetMap** (default) ↔ **Luftbild** (Esri World Imagery).
- Overlay toggle: «Wunschgebiete ausblenden» or «NoGo-Zonen ausblenden» when areas configured.
- Collapsible area panel: Modus (Wunschgebiet / NoGo), **Kartenradius** (km + «Standard»), add PLZ per city.
- Per active city: **Stadtteile / Ortsteile** — import textarea, «Ortsteile übernehmen» (optional); OSM hint when no districts.
- Save area: redirect with `areas_saved=1`; success message optional.
- API check (browser console): `fetch('/api/projects/<id>/plz-overlays')` → `200`, each overlay has `radiusM` matching saved km (×1000).
- NoGo mode: red circles on map; list badges inverted vs Wunschgebiet (optional).

### Kalender (`?tab=calendar`)

- iCal-Feed URL host/port matches `NEXT_PUBLIC_APP_URL` or dev port (not stale `3000` when app runs on `3001`).
- «URL kopieren» button present (clipboard optional).
- «Kommende Termine» / «Vergangene Termine» with dates and apartment links; no runtime error.
- Note duplicate rows if same viewing appears twice (data/UI quirk, not a blocker).
- Regression: `appTimeZone` passed into `CalendarSection` in `ProjectCalendar.tsx`.

## Apartment detail (`/project/<projectId>/apartment/<apartmentId>`)

- «← Zurück» to project; header title, optional «Inserat öffnen ↗», area badge (Wunschgebiet/NoGo).
- Score legend + «angemeldet als …»; Archivieren, Löschen.
- Preis & Adresse: Adressfeld + **GetGeo** (nur diese Adresse); **Street View öffnen ↗** under address when coords/address present; Speichern für alle Felder; Hinweis bei nicht auflösbarer Adresse.
- **Daten automatisch füllen** (Header neben Archivieren): → `POST …/llm/extract` (Inserat-URL aus Feld/gespeichert + indexiertes Exposé-PDF) → `200`, «Leere Felder übernommen»; Titel/Beschreibung/Preis; **Makler**-Checkbox unter Kaufnebenkosten (nur wenn Kaufpreis gesetzt) → «Übernehmen» zum Speichern.
- Projekt «Immobilie hinzufügen»: «Daten automatisch füllen» oder URL + Hinzufügen → Felder + **Makler**-Checkbox; ImmoScout24-Abruf kann blockieren («Seite nicht lesbar»).
- **Inserat-Link** (expand): nur URL + Speichern.
- **KI-Assistent** (Header): Dialog «Exposé-Assistent», Frage senden → `POST …/llm/chat` → `200`, Antwort aus Beschreibung/Stammdaten/PDF-Kontext.
- **Anfahrt** (expand): per-member rows; km/min; with Firmenwagen + Arbeitsstätte: «Firmenwagen: Brutto …» and «Pendlerpauschale (geschätzt, Steuererklärung)» under workplace leg.
- **Kaufnebenkosten & Finanzierung** (expand): project financing reflected.
- Bilder / Kamera / Exposé upload UI: `multiple` on file inputs; optional multi-file upload smoke (dropzone or multi-select).
- Notizen, Beschreibung (expand + Speichern optional).
- Besichtigungstermine: list, add form (optional).
- **Meinungsunterschiede** (when team ratings exist): per-user scores vs «Noch keine gemeinsam bewerteten Kriterien».
- **Kriterien bewerten:** sliders; optional: move one slider, reload page, value persisted.
- **Checkliste:** link/button near score; under each criterion that is on the checklist: read-only **CHECKLISTE** block (status + note + «In Checkliste bearbeiten»); custom checklist-only items in separate section if any.
- Fill page `/project/<id>/apartment/<aptId>/checklist`: status buttons (— / OK / ? / n. a.), «Fakt notieren…» per point; counter «X von Y»; only points assigned to current user or «Beide»; optional **Makler-Fragen (Spickzettel)** details block.

### Archivieren

- Archivieren → redirect to project `?tab=archived` with listing visible (optional; use non-critical apartment).

## Optional / extended

| Area | Action | Expect |
|------|--------|--------|
| Mobile | `resize_page` ~390×844, repeat nav + one project tab | Usable layout, no horizontal overflow on main nav |
| Backup download | Admin → Sicherung → Download on saved backup | File download starts |
| Backup import | Test ZIP + checkbox confirm | Success message; only synthetic data |
| New project | Dashboard «Neues Projekt» | Redirect to new project (optional) |

## Known issues (environment / quirks)

- iCal URL uses `NEXT_PUBLIC_APP_URL` default `http://localhost:3000` — wrong port if env unset on `3001`.
- Auto-backup panel may briefly show «Lade Einstellungen…»; should resolve within a few seconds.
- Map/area tests mutate shared project filter mode — document or revert in changelog.

## After a session

- Append **short** notes only under «Changelog» below: date, port, what broke/fixed, which **areas** were tested — no PII, no UUIDs, no real addresses.
- Add new **sections** above when shipping new UI routes (not checkbox lists).

## Changelog (agent notes, no real data)

- **2026-05-21 (port 3000, UX auto-fill + unsaved guard):** Apartment detail: Preis geändert ohne Speichern → Modal «Ungespeicherte Änderungen» mit «Preis & Adresse», `pn-section-unsaved` am Bereich, «Auf der Seite bleiben» OK. Auto-Fill: leere Energieklasse → `POST …/llm/extract` 200, Meldung «Übernommen und markiert: Energieklasse», `pn-field-prefilled` auf Feld. Keine Console-Errors.
- **2026-05-21 (port 3000, full MCP + listing/LLM):** Recommended order end-to-end. OK: auth (bad password, admin/user, `/admin`→dashboard), account 2FA QR+Abbrechen, admin users/backup/timezone, dashboard roles, all project tabs (immobilien/archiv/team/compare/map/calendar; settings via nav), compare 2× tables, map 8/8 coords + Wunschgebiet 2,2 km, apartment Street View + `POST …/llm/extract` 200 (PDF merge message). **Immobilie hinzufügen:** `POST /api/listing/preview` 200 for immobilien.de → title/price/m²/D/Makler; IS24 → «Seite nicht lesbar» (expected). **KI:** Admin tab loads; «Verbindung testen» disabled (no API token in form); no «KI-Assistent» button (LLM not configured); `POST …/llm/chat` 503 `llm_not_configured`. iCal `localhost:3000`. Mobile 390×844. No console errors. Skipped: backup download/import, TOTP activation, criteria/settings tab deep, remember-login cookie, actual «Immobilie hinzufügen» submit.
- **2026-05-21 (port 3000, checklist retest):** Admin: config tab 4 points, archiv **4/4 Checkliste 100%**, fill page legend bottom + Partner-Ansicht (Jasmin read-only). Criteria tab **Checkliste (4)** stable. List **Inserat öffnen** below price/viewing. No runtime console errors (a11y form-id hints only). Vitest 428 pass.
- **2026-05-21 (port 3000, checklist full + dual user):** Auth admin; tab label **Checkliste (4)** stable on criteria/map/compare/calendar (count-query fix). Config: 4 points, assignees Christoph/Jasmin/Beide, custom item. **Christoph** fill: Kaufpreis OK+note, Heizung ?+note, Zusatz OK (3/3 visible). **Jasmin** fill: Wohnfläche OK+note (3/3, no Kaufpreis). Apartment detail (Jasmin): CHECKLISTE under Kaufpreis/Wohnfläche/Heizung with team notes; Zusatz accordion; score **0/100** unchanged vs Christoph **42/100** (checklist does not affect scoring). Archiv list **4/4 Checkliste 100%**. Map/calendar/compare OK. No console errors. Skipped: bad password, account/admin backup/KI deep, TOTP, mobile, compare 2-select tables.
- **2026-05-21 (port 3000, auto-fill + Makler):** Detail: extract 200, Makler-Checkbox nach Auto-Fill gesetzt (landingpage.immobilien); Beschreibung aus PDF/KI. Create: fp-Immofinanz preview → Makler checked, Titel/Preis/Beschreibung; IS24 preview fetch_failed. Keine Console-Errors.
- **2026-05-21 (port 3000, KI retest):** Admin KI: Speichern `auto-fastest` + Verbindung testen OK (`PUT`/`POST` llm settings 200). Apartment: KI-Chat 200 (95 m² / Bj. 1910 aus Beschreibung); PDF-Exposé-Extraktion 200, Highlights + leere Felder. Keine Console-Errors. Extract-Button nur mit PDF, nicht nur Inserat-URL.
- **2026-05-21 (port 3000, Inserat-Link merge):** Admin login; Apartment mit PDF+URL: kein «Aus Exposé (KI)»; «Daten laden» → `POST …/llm/extract` 200, «Leere Felder übernommen»; Hinweis «PDF ohne KI» wenn LLM nicht konfiguriert. Keine Console-Errors.
- **2026-05-21 (port 3002, KI):** Auth admin; Admin tab KI: Verbindung testen OK. Apartment detail: KI-Assistent chat 200; Daten laden (Inserat-Link) 200 inkl. PDF-Merge. Keine Console-Errors.
- **2026-05-21 (port 3000, Pendlerpauschale):** After schema change: `npx prisma generate` if apartment page throws Prisma validation on new user fields. Account: Firmenwagen + Pendlerpauschale fields; address **Arbeitsstätte** must be saved via «Aktualisieren» (not only Firmenwagen Speichern). Apartment Anfahrt OK: Firmenwagen Brutto/Netto + Pendlerpauschale/Jahr. Also: user `/admin`→dashboard, admin backup list + Download links, map mobile 390×844 (Menü), `plz-overlays` API 200 + `radiusM`. Skipped: backup download click, remember-login, TOTP activation.
- **2026-05-21 (port 3000, full pass):** Recommended order end-to-end after Street View feature. OK: auth, account (2FA start/Abbrechen), admin users/backup/timezone, dashboard user+admin roles, all project tabs, compare (2 selected), map (Street View popup, overlays API `radiusM` 2200), calendar (iCal `localhost:3000`), apartment detail (Street View, Anfahrt km/min), mobile 390×844 no overflow. Skipped optional: backup download/import, TOTP activation, archivieren, slider reload, remember-login cookie.
- **2026-05-21 (port 3000):** Street View links on map popup + apartment «Preis & Adresse»; pano URL with `viewpoint=` from geocoded coords; no console errors.
- **2026-05-21 (port 3001, expanded guide):** Ran recommended order end-to-end. OK: bad password, remember-login `Max-Age=2592000`, admin nav (Verwaltung), account (Firmenwagen, 2FA start), admin backup (auto + list + Jetzt sichern), timezone, dashboard both roles, all project tabs, compare (2 selected), map (leaflet, ausblenden, overlays API), apartment (NoGo badge, Route:, Meinungsunterschiede), user `/admin`→dashboard, mobile 390×844 no overflow. **Fail/known:** iCal URL still `localhost:3000` (env unset). Ortsteile UI not verified (panel collapsed). Optional skipped: backup download/import, TOTP activation, archivieren, slider reload.
- **2026-05-21 (port 3001):** Full MCP pass: auth (bad password, admin/user login, logout, `/admin` redirect for user), account settings (Verkehrsmittel Rad, 2FA setup QR + Abbrechen), admin users/backup/timezone (auto-backup loads; backup list visible), dashboard both roles, all project tabs (immobilien, archiv, team, settings, criteria, compare, map, calendar), apartment detail (Anfahrt routes, panels, criteria), NoGo badges + map overlays API `radiusM` 4000. Kalender OK after `appTimeZone` fix. Not exercised: backup import/download, remember-login cookie check, mobile viewport, completing TOTP activation.
- **2026-05-21:** Kalender tab crashed (`appTimeZone is not defined` in `CalendarSection`); fixed by passing prop from `ProjectCalendar`. Area map: Kartenradius + plz-overlays API. Earlier runs missed `?tab=calendar` — always walk every project tab explicitly.
