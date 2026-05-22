# PickHome Browser Regression Guide

This document describes a repeatable browser smoke and regression procedure for PickHome using **Chrome DevTools MCP** (`user-chrome-devtools`) or an equivalent browser automation driver.

It is intentionally written as a durable project test contract, not as a one-off click log. It should remain usable with a seeded database, a local development database, a restored backup, or future synthetic test data profiles.

## 1. Scope

This guide verifies that the most important PickHome user journeys work in the browser:

- Authentication, sessions, roles, and navigation
- Admin functions
- Account settings
- Dashboard and project access
- Project tabs
- Apartment detail workflows
- Scoring, criteria, checklist, team ratings, compare view
- Map, area filters, geocoding, overlays, and Street View links
- Calendar and iCal feed URLs
- Listing import (project quick-add and apartment Auto-Fill), PDF context, portal-specific extract outcomes, and LLM assisted features
- Viewing schedule conflict warnings (upcoming viewings)
- Backup UI and synthetic restore paths
- Mobile usability

This guide **does not replace** unit or integration tests. It complements them by validating full browser behavior, routing, visible UI state, runtime errors, and user flows.

## 2. Hard rules

These rules apply to every browser test session.

1. Do not document real user names, real addresses, real project names, real listing URLs, real IDs, real backup names, or real customer data.
2. Do not hardcode project IDs, apartment IDs, user IDs, route IDs, or database IDs.
3. Discover test targets at runtime from the UI or from synthetic seed fixtures.
4. Do not assume port `3000`. Always use the actual dev or container port.
5. If the app runs on a port other than `3000`, set `NEXT_PUBLIC_APP_URL=http://localhost:<port>` before testing calendar and iCal behavior.
6. Mutating tests must run only against disposable synthetic data or must be reverted before the session ends.
7. Every navigation step must be followed by a browser snapshot and a console error check.
8. Runtime errors, Next.js overlays, failed server actions, and unexpected HTTP 5xx responses are blockers unless explicitly listed as accepted external-service failures.
9. Do not mark a feature as passed only because a button is visible. The feature must reach a meaningful user outcome.
10. New features must extend this guide by feature contract, not by adding another long historical checklist.

## 3. Test levels

Use the right test level for each defect or feature.

| Level | Tool | Purpose | When to use |
|---|---|---|---|
| Static and build | TypeScript, Next build, Prisma generate | Compilation, schema compatibility, import correctness | Before every release and after schema or dependency changes |
| Unit | Vitest | Pure logic, formatting, calculations, parser behavior, URL builders, eligibility rules | For deterministic domain logic |
| Integration | Vitest | Prisma-backed actions, database behavior, backup roundtrips, upload routes, access checks | For server actions and persistence behavior |
| Browser smoke | Chrome DevTools MCP or equivalent | End-to-end UI sanity, navigation, runtime errors, visible state | Before merge or release for user-facing changes |
| Exploratory browser regression | Chrome DevTools MCP | New UI features, visual edge cases, external service behavior | When a feature cannot yet be fully automated |

## 4. Project commands

Run these from the repository root.

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

For a clean local test database:

```bash
npm run db:reset
npm run dev
```

For automated checks:

```bash
npm test
npm run test:unit
npm run test:integration
npm run build
```

For backup specific checks:

```bash
npm run data:export
npm run data:import -- data/backups/<synthetic-backup>.zip
node scripts/set-dev-logins.mjs
```

After a restored backup, run `set-dev-logins.mjs` so each account password equals its username (TOTP off). Admin seed login `admin` / `admin` remains available via `npm run db:seed` on an empty DB only.

If Prisma schema or generated client behavior changed:

```bash
npx prisma generate
npm run db:push
npm test
```

## 5. Environment setup

### 5.1 Local development

1. Start the app with `npm run dev`.
2. Read the actual port from the terminal output.
3. Set the browser base URL to `http://localhost:<port>`.
4. If `<port>` is not `3000`, set `NEXT_PUBLIC_APP_URL=http://localhost:<port>` in `.env.local` and restart the dev server before testing calendar and iCal behavior.
5. Connect Chrome DevTools MCP in Cursor or the chosen automation host.

### 5.2 Docker or production-like container

1. Start the container with a disposable test data directory.
2. Use a strong `SESSION_SECRET` even for smoke testing.
3. Use the mapped host port from Compose, not the internal container port.
4. Confirm the container can write to `data/`, `data/uploads/`, and `data/backups/`.
5. Do not run destructive import or restore tests against production data.

## 6. Test data profiles

Reliable regression testing requires predictable data. Use one of these profiles. If a profile does not exist yet, create it before relying on this guide for release testing.

| Profile | Purpose | Required content |
|---|---|---|
| `empty` | First start and minimal admin access | Admin account, no user projects, no apartments |
| `minimal` | Fast smoke test | Admin, one regular user, one project, one apartment, one criterion group |
| `rich` | Main regression profile | Admin, two regular users, at least two projects, multiple apartments, criteria, team ratings, checklist points, notes, viewings, map data |
| `map` | Area and geocoding regression | Project with apartments in and outside Wunschgebiet or NoGo zones, saved PLZ, district data, coordinates |
| `calendar` | Calendar and iCal regression | Future and past viewings, at least two apartments, stable app timezone |
| `llm` | Listing import and LLM regression | LLM settings; apartments covering: (a) readable non-bot listing URL, (b) bot-blocked major portal URL with data already in DB, (c) broker landing-page URL, (d) PDF exposé only (no URL), (e) URL + PDF, (f) partially filled fields for `onlyEmpty` checks |
| `backup` | Backup export and restore | Synthetic database, uploads, PDFs, backup ZIP, no real data |
| `mobile` | Responsive UI smoke | Same as `minimal` or `rich`, tested at a narrow viewport |

### 6.1 Runtime target discovery

Discover targets dynamically:

- **Admin project:** Open `/dashboard` as admin and select any visible project card.
- **Regular user project:** Open `/dashboard` as a regular user and select a project under the user's own project list.
- **Apartment:** Open the first apartment row with a visible title or address.
- **Apartment with viewings:** Prefer an apartment whose list row or detail page shows at least one viewing.
- **Apartment with coordinates:** Prefer an apartment where the map can show a marker or where the detail page has coordinates after geocoding.
- **Apartment for checklist:** Prefer an apartment in a project with enabled checklist points.
- **Apartment for team ratings:** Prefer an apartment rated by more than one project member.
- **Project with area filter:** Prefer a project with saved Wunschgebiet or NoGo PLZ entries.
- **Project with LLM data:** Prefer a project containing one apartment with PDF or listing URL test data.
- **Apartment for Auto-Fill (empty fields):** Prefer an apartment with a saved listing URL and at least one empty field in „Preis & Adresse“ (for example Grundstück m² or Beschreibung) so `onlyEmpty` behavior is observable.
- **Apartment for Auto-Fill (blocked portal):** Prefer an apartment whose listing URL points to a major portal known to block server-side fetch; expect controlled `fetch_failed` UI, not a crash.
- **Apartment for PDF-only extract:** Prefer an apartment with an uploaded PDF exposé and no listing URL; note whether extract returns fields or `no_fields` (depends on PDF text quality).
- **Apartment for KI-Vorschlag / draft restore:** Prefer an apartment with **already filled** title, price, or address (saved or visible in form) plus listing URL and/or PDF; after Auto-Fill, expect **KI-Vorschlag** rows on differing fields, not a full-form overwrite of saved values.
- **Apartment for post-save draft stability:** Same as above; after **Preis & Adresse** save (`?basics_saved=1` or success message), reload must show **DB values only** — no flicker between old KI extract and current display.
- **Two apartments with upcoming viewings same day:** Prefer two geocoded apartments with future viewing times less than travel gap apart to exercise schedule conflict warnings.

Do not copy runtime IDs into this file. Session-specific notes may say "project with two apartments" or "apartment with viewings", but not UUIDs or real addresses.

## 7. Evidence requirements

For each tested area, collect at least this evidence:

- Browser snapshot after navigation
- Console check after the page is stable
- Visible success or error message after mutations
- HTTP status for critical API or server action calls when available
- Returned route after redirects
- Confirmation that no Next.js runtime overlay is visible

When using Chrome DevTools MCP, prefer this pattern:

```text
navigate -> take_snapshot -> interact -> take_snapshot -> list_console_messages -> inspect network where needed
```

## 8. Severity rules

| Severity | Meaning | Examples |
|---|---|---|
| Blocker | Prevents release or merge | Login broken, project page crashes, data loss, admin access bypass, wrong user sees foreign project |
| High | Core flow degraded | Save action silently fails, calendar crashes, checklist count wrong after save, backup restore corrupts data |
| Medium | Important but not release blocking by itself | Visual regression, missing success message, stale count until refresh, optional provider timeout |
| Low | Cosmetic or documentation-only | Minor label mismatch, spacing issue, harmless console warning |

Accepted external-service failures must be explicit. For example, a listing provider blocking scraping may be acceptable if the UI shows a controlled message and no runtime error occurs.

## 9. Recommended run order

Use this sequence so authentication, project context, and data dependencies remain stable.

1. Preflight and automated checks
2. Auth and global navigation
3. Account settings
4. Admin tabs
5. Dashboard as admin
6. Dashboard as regular user
7. Roles and direct-access checks
8. One project, every tab in order
9. Apartment detail from the project list
10. Checklist fill page
11. Mutating feature checks on disposable data
12. Calendar and iCal
13. Map and area filters
14. LLM and listing import if configured (project quick-add **and** apartment Auto-Fill; see §12.17)
15. Viewing schedule conflict warnings if calendar or viewing code changed (see §12.14)
16. Mobile viewport
17. Optional backup export, restore, TOTP full activation
18. Session note

## 10. Preflight checklist

Before using the browser, run:

```bash
npm test
npm run build
```

The browser test may still run if these fail, but the result must then be marked as diagnostic, not as release-ready.

Confirm:

- The app starts cleanly.
- No Prisma client generation error is present.
- The configured database is disposable or intentionally selected.
- `NEXT_PUBLIC_APP_URL` matches the actual browser URL if calendar or iCal is in scope.
- The browser session is clean, or old cookies are intentionally reused for a session test.

## 11. Mandatory browser smoke matrix

| Area | Required | Minimum evidence |
|---|---|---|
| Auth | Login, bad password, logout, remembered login if in scope | Redirects, session cookie behavior, no console errors |
| Roles | Admin access, user access, direct `/admin` as user | Correct redirect and nav visibility |
| Account | Address, travel mode, company car, password form, TOTP start and cancel | Saved state or controlled cancel |
| Admin | Users, backup, timezone, LLM tabs | Tabs load, save/test actions where safe |
| Dashboard | Admin all projects, user own projects | Project cards and access behavior |
| Project tabs | Immobilien, Archiv, Team, Einstellungen, Kriterien, Checkliste, Vergleich, Karte, Kalender | Every tab loads without runtime errors |
| Apartment detail | Price/address, listing link, notes, **Finanzen**, **KI** chat, Auto-Fill + **KI-Vorschlag**, draft restore, rating (—/0–10), archive/delete, commute, checklist | Save or controlled no-op; no flicker after save/reload; chat shows **tippt…** and prose answers; no runtime errors |
| Checklist fill | Assignment filtering, 3-symbol status slider, notes, progress | Status persists after reload |
| Compare | Select 2 or more apartments | Comparison table appears |
| Map | Load addresses, markers, overlays, mode toggle, Street View link | Coordinate count and overlay API if available |
| Calendar | Upcoming and past viewings, iCal URL | URL host/port correct, no crash |
| LLM/listing | Configured and not configured states; project import + apartment Auto-Fill on ≥2 portal types | Controlled success/partial/failure; `onlyEmpty` respected; **pending-only** session draft restore; save persists after reload |
| Viewing conflicts | Two upcoming viewings same day, tight schedule | Warning on apartment detail (upcoming only) and project calendar (upcoming only); past section has no warnings |
| Mobile | Narrow viewport navigation and one project flow | No unusable horizontal overflow |

## 12. Feature contracts

Use the following contracts as the stable source of truth. UI labels may change. The user outcome must not break.

### 12.1 Authentication and global navigation

#### Must always hold

- `/login` shows username, password, remember-login option, and submit action.
- Invalid credentials show a controlled error message.
- Valid admin login redirects to the admin landing area or admin dashboard path.
- Valid regular user login redirects to `/dashboard`.
- Admin navigation exposes project and administration areas.
- Regular user navigation does not expose administration.
- Logout returns to `/login` and invalidates the authenticated UI state.
- Footer shows installed version information and optional update information without crashing.

#### Negative cases

- Wrong password
- Empty username or password
- Direct `/admin` access as regular user
- Direct protected route access while logged out
- Expired or deleted session cookie

#### Evidence

- Snapshot after login form
- Snapshot after bad password
- Snapshot after admin login
- Snapshot after user login
- Console check after each redirect

### 12.2 Account settings

#### Must always hold

- Admin back navigation returns to an admin-appropriate route.
- Regular user back navigation returns to a user-appropriate route.
- Standard travel mode can be changed and saved.
- Company car settings can be saved without breaking commute calculations.
- Workplace address can be stored and used by commute and company car calculations.
- Pendlerpauschale or commuter allowance fields are visible where supported.
- Additional addresses can be created, edited, or deleted on disposable data.
- Password change form is present and validates input.
- TOTP setup can start, show QR or secret text, show confirmation step, and cancel without enabling 2FA.

#### Negative cases

- Missing current password
- Password mismatch
- Invalid TOTP code
- Cancel TOTP setup after QR generation
- Company car enabled without required price field
- Workplace address not saved before commute calculation

#### Evidence

- Saved success state or controlled validation error
- Reload confirms persisted settings when a value was changed
- Console check

### 12.3 Admin area

Admin tabs currently expected:

- Users
- Backup
- Timezone
- LLM or KI settings

#### Must always hold

- Users tab lists users with role and project count.
- New user form is visible and validates input.
- The last admin cannot be deleted.
- Backup tab loads without being stuck in a loading state.
- Manual backup download action is visible.
- Backup import requires explicit confirmation.
- Scheduled backup settings load and can be saved on disposable data.
- Saved backup list shows available actions if backups exist.
- Timezone selection shows a valid IANA timezone value.
- LLM settings show base URL, model, system prompt, masked token handling, save action, restore default prompt action, and connection test where configured.
- Web-Recherche section states **DuckDuckGo** as default (no API key required); optional Tavily/Brave API key field; current provider label visible (`duckduckgo`, `tavily`, or `brave` from env).

#### Negative cases

- Non-admin opens `/admin`
- Create user with duplicate username
- Import invalid ZIP
- Import without confirmation checkbox
- LLM test without required settings
- LLM API unavailable

#### Evidence

- Tab snapshots
- Save or validation result
- Network status for LLM save and test actions where available
- Console check

### 12.4 Dashboard

#### Must always hold

- Admin sees all projects or an equivalent global project view.
- Regular user sees only own/member projects.
- Project cards open the matching project route.
- New project creation is available where permitted.
- Empty states are clear and do not crash.

#### Negative cases

- Regular user attempts to open a project where the user is not a member.
- Project was deleted or archived in another session.
- Project list is empty.

#### Evidence

- Snapshot as admin
- Snapshot as regular user
- Direct route access result
- Console check

### 12.5 Project shell and tabs

Project URL pattern:

```text
/project/<projectId>?tab=<tab>
```

Expected tab keys:

```text
default or immobilien
archived
team
settings
criteria
checklist
compare
map
calendar
```

#### Must always hold

- Project header shows name and budget or equivalent project summary.
- All tabs can be reached by UI interaction and direct URL.
- Unknown or missing tab does not crash the project page.
- Project deletion controls are visible only where permitted.
- Tab labels and counters remain consistent after navigation and reload.

#### Negative cases

- Invalid tab query
- Deleted project route
- Regular user without membership opens project route
- Project with no apartments

#### Evidence

- One snapshot per tab
- Console check after each tab
- Redirect or not-found behavior for invalid access

### 12.6 Immobilien tab

#### Must always hold

- Apartment list loads.
- Score legend is visible.
- Sorting works for available sort keys.
- Search filters the list without crashing.
- Rows show title, address or missing-address state, score or unrated state, budget hint, listing link when present, and checklist progress when configured.
- Area badges reflect Wunschgebiet or NoGo mode when configured.
- Add-apartment form exists.
- Listing preview/import handles success and controlled failure.
- „Inserat-URL“ + „Daten automatisch füllen“ on the add form calls `POST /api/listing/preview` and prefills **empty** quick-add fields only (`onlyEmpty: true`): title, price, size, plot (if returned), energy class, address, broker checkbox; optional description textarea when returned.
- While import runs, button shows „Wird ausgewertet…“ (or equivalent) and submit is disabled; after completion a short success line lists which fields were marked.
- User must click „Immobilie hinzufügen“ to persist; import alone does not create an apartment.

#### Negative cases

- Empty project
- Apartment without address
- Apartment without score
- Apartment over budget
- Invalid listing URL
- Provider blocks listing read
- Area filter configured but address has no coordinates
- Import clicked without URL
- Import on blocked portal URL (controlled failure message, form stays submittable manually)

#### Evidence

- Snapshot of list
- Snapshot after search
- Snapshot after sorting
- Snapshot of add form after successful import (filled fields visible)
- Optional: create apartment on disposable data and open detail to confirm listing URL saved
- Console check

### 12.7 Archiv tab

#### Must always hold

- Empty state is clear if no archived apartments exist.
- Archived apartments show meaningful row data if present.
- Restore and delete controls are visible where permitted.
- Checklist progress is shown consistently when checklist points exist.

#### Negative cases

- Restore already-deleted apartment
- Delete archived apartment on non-disposable data is skipped
- Archived apartment missing listing metadata

#### Evidence

- Snapshot
- Optional restore on disposable data
- Console check

### 12.8 Team tab

#### Must always hold

- Project members are listed.
- Creator or owner state is visible if supported.
- Add-member form exists.
- Removing or adding a user updates membership on disposable data.
- Regular users cannot perform unauthorized membership changes.

#### Negative cases

- Add unknown username
- Add existing member
- Remove creator or last required owner if blocked by business rules
- Regular user attempts admin-only team change

#### Evidence

- Snapshot
- Save or validation state
- Reload confirms persisted membership where changed
- Console check

### 12.9 Settings tab

#### Must always hold

- Project name and budget can be edited where permitted.
- Bundesland, purchase-cost defaults, broker settings, financing defaults, and dealbreaker threshold are visible where supported.
- PDF reindex action is visible.
- Address enrichment action is visible.
- Coordinate reindex action is visible.
- Long-running jobs show a visible running or completed state.
- Address enrichment returns a useful count or controlled no-op.

#### Negative cases

- Invalid budget
- Invalid financing values
- Address enrichment with no apartments
- Reindex with no PDFs
- Background job failure

#### Evidence

- Snapshot before action
- Snapshot after controlled action
- Network or visible status where available
- Console check

### 12.10 Criteria tab

#### Must always hold

- Criterion groups load with weights.
- Criteria load with weights and optional dealbreaker flags.
- Dealbreaker threshold from project settings is reflected.
- Group creation and criterion creation work on disposable data.
- Reordering or weight changes persist after reload if tested.
- Checklist tab label count remains consistent after criteria changes.

#### Negative cases

- Empty criteria set
- Invalid weight
- Delete criterion used by existing ratings or checklist
- Toggle dealbreaker on existing rated criterion

#### Evidence

- Snapshot
- Optional mutation on disposable data
- Reload after mutation
- Console check

### 12.11 Checklist configuration tab

#### Must always hold

- Summary shows enabled point count.
- Criteria can be included as checklist points.
- Assignment options include both members or individual assignees where applicable.
- Group-specific broker question text can be saved.
- Custom checklist-only points can be added.
- Tab label count matches enabled point count.
- Checklist changes do not modify apartment scoring directly.

#### Negative cases

- No criteria
- One project member only
- Custom point without name
- Remove criterion that is part of checklist
- Assignment to removed member

#### Evidence

- Snapshot of checklist config
- Optional save and reload
- Count comparison with apartment detail and fill page
- Console check

### 12.12 Compare tab

#### Must always hold

- Empty state is clear until enough apartments are selected.
- Up to five apartments can be selected.
- Selecting two or more apartments shows comparison tables.
- Comparison includes scores, criteria, purchase or finance data where available, and partner divergence where supported.
- Deselecting apartments updates the comparison state.

#### Negative cases

- Fewer than two apartments
- More than five selected attempts
- Apartment missing price or score
- Team ratings absent

#### Evidence

- Snapshot empty state
- Snapshot after selecting two apartments
- Console check

### 12.13 Map tab

#### Must always hold

- Leaflet map loads without runtime errors.
- Address loading action is visible.
- Coordinate count is displayed or inferable.
- Markers appear for apartments with coordinates.
- Marker popup links to the apartment and shows Street View action where coordinates exist.
- Base layer switch supports OpenStreetMap and aerial imagery where configured.
- Wunschgebiet or NoGo overlays can be shown and hidden when configured.
- Area panel supports mode, radius, city/PLZ entry, district or Ortsteil import, and save action where supported.
- Saved radius is reflected by overlay API values when available.
- NoGo mode inverts list badge semantics compared with Wunschgebiet mode.

#### Negative cases

- No apartments
- Apartment without address
- Address cannot be geocoded
- No saved PLZ areas
- Radius changed and page reloaded
- Switch Wunschgebiet to NoGo and revert
- Overlay API returns empty list

#### Evidence

- Snapshot before and after address loading
- Snapshot with overlay panel
- Optional browser console fetch for `/api/projects/<id>/plz-overlays`
- Confirm `radiusM` equals saved kilometers multiplied by 1000 where response is available
- Console check

### 12.14 Calendar tab

#### Must always hold

- Calendar tab loads without runtime error.
- iCal feed URL host and port match `NEXT_PUBLIC_APP_URL` or the actual dev URL.
- Copy URL action is visible.
- Upcoming viewings are listed where present.
- Past viewings are listed where present.
- Apartment links resolve.
- Timezone setting is respected by visible dates and feed generation.

#### Negative cases

- No viewings
- Only past viewings
- Only future viewings
- App running on port other than `3000`
- `NEXT_PUBLIC_APP_URL` unset
- Timezone changed in admin settings
- Duplicate viewing rows in data

#### Viewing schedule conflicts (when ≥2 upcoming viewings exist)

- Warnings are computed per project day for **upcoming** viewings only (`onlyUpcoming` default).
- Same-day pair with gap shorter than travel time + buffer (or overlap) shows German warning text referencing the other apartment title.
- Warnings appear under **Kommende** / **Anstehend** viewings on apartment detail and under **Kommende Termine** on the project calendar tab.
- **Vergangen** / past viewing lists must pass empty `scheduleWarnings` (no conflict banners on past appointments).
- Warning kinds include overlap and „Anschluss zu knapp“ (tight connection); message mentions gap minutes and estimated travel when coordinates exist.

#### Evidence

- Snapshot
- iCal URL text
- Optional feed request status
- Snapshot of calendar upcoming row with warning when test data allows
- Console check

### 12.15 Apartment detail

#### Must always hold

- Back navigation returns to the project.
- Header shows apartment title and listing link where available.
- Area badge reflects current project area mode where configured.
- Score legend and current user context are visible.
- Archive and delete controls are visible only where permitted.
- Price and address section supports edit and save, including optional cost fields (Hausgeld, Heizkosten, Grundsteuer, Sanierung).
- Geocoding action works for this address or returns a controlled failure.
- Street View link is available when coordinates or a resolvable address exist.
- Listing URL section can be expanded and saved; URL input uses full width of the section (same row as save button, `flex` layout).
- Toolbar **Auto-Fill** button (`ApartmentAutoFillButton`) is visible when LLM/listing features are in scope.
- While Auto-Fill runs in the toolbar: label **„wird verarbeitet“**, button keeps **minimum width** (~9.5rem), no extra status paragraph under the toolbar (status in `title` / tooltip only).
- Auto-Fill calls `POST /api/apartments/<apartmentId>/llm/extract` with URL from the listing URL input (unsaved input counts) or saved DB URL.
- Auto-Fill applies preview fields with **`onlyEmpty: true`** (does not overwrite user-edited or already filled inputs).
- When KI extract **differs** from a non-empty field, a **`KI-Vorschlag:`** row appears under that field with **Übernehmen** / **Verwerfen** (single-field apply; does not change other inputs).
- Toolbar `title` may list **„Abweichende KI-Vorschläge: …“** when suggestions exist.
- Extract uses **narrative-only** supplemental context (notes, description, checklist) — not structured Stammdaten as LLM anchors (comparison is client-side).
- **Session draft** (`sessionStorage`, key `pickhome-listing-draft:<apartmentId>`): stores `pending` (empty fields filled by Auto-Fill), `suggestionKeys` (differing filled fields), and field values **only for those keys** — not the entire last extract blob.
- **`ApartmentListingDraftRestore`** on page load: applies **pending** keys to the form only (`onlyEmpty: false` per key); **does not** re-apply saved or suggestion-only keys from stale extract data.
- After redirect with `?title_saved=1`, `?description_saved=1`, `?basics_saved=1`, or `?broker_saved=1`, pruned draft must not bring back values for saved sections on reload or tab return.
- **KI-Vorschlag** rows are UI-only until **Übernehmen**; reload without save must keep the user's manual values and still show suggestions if draft remains.
- After successful Auto-Fill, user must **save** each section: „Speichern“ under **Preis & Adresse** (redirect may include `?basics_saved=1`), separate save for **Beschreibung** and **Notizen** if changed.
- Auto-Fill marks newly filled inputs with green highlight (`pn-field-prefilled`); after **Preis & Adresse** save, highlights are cleared (including Hausgeld/Heizkosten/Grundsteuer/Sanierung).
- Auto-Fill does **not** persist to the database by itself.
- Notes and description sections can be expanded and saved.
- Collapsible section **Finanzen** (formerly „Kaufnebenkosten & Finanzierung“) reflects project defaults and apartment cost fields (Sanierung in Gesamtkosten, laufende Kosten in Monatsbelastung when net income is set); Makler checkbox with **Übernehmen** lives here.
- Commute section shows per-member travel data where account addresses exist.
- Company car and commuter allowance information appears when configured.
- Image, camera, and exposé upload inputs accept supported file types and reject unsupported file types.
- Camera allows taking another photo while earlier uploads still run in the background; progress text appears; gallery shows pending previews until sync completes.
- Viewing appointments can be listed and added on disposable data.
- Opinion differences appear when multiple members rated shared criteria.
- Criteria sliders: leftmost **—** = not rated (slider `min=-1`, distinct from score **0**); scale labels `— · 0 · 5 · 10`; setting **—** clears the rating in the DB; value label shows **—** when unrated.
- Criteria sliders can be changed (0–10) and persisted.
- Toolbar **KI** (Immobilien-Assistent) visible only when Admin → KI is configured (`isLlmConfigured`); see §12.18.
- Checklist blocks appear under criteria that are part of the checklist.
- Custom checklist-only items appear in a separate checklist section where configured.
- Toolbar **KI** opens Immobilien-Assistent (see §12.18).

#### Negative cases

- Apartment without price
- Apartment without address
- Invalid address
- Unsaved field changes followed by navigation
- PDF upload too large
- Image upload too large
- Unsupported file type
- LLM not configured
- Listing URL invalid or blocked
- User without permission opens apartment route

#### Evidence

- Snapshot at top of page
- Snapshot of expanded critical sections
- Save result or validation state
- Reload after one persisted mutation on disposable data (for example empty Grundstück filled by Auto-Fill, then **Preis & Adresse** saved — value still present after reload)
- Auto-Fill toolbar `title` includes field list and warnings when non-toolbar mode would show message text
- After save + reload: no visible alternation between SSR/DB values and an older KI extract (no „flicker“ on title, price, address)
- Console check

#### Draft restore procedure (MCP, after Auto-Fill)

Run on a disposable apartment with **mixed** empty and filled fields (for example saved title and price, empty plot or description).

1. Note current **Anzeigename**, **Preis**, and **Adresse** from snapshot (DB-backed).
2. Run toolbar **Auto-Fill** once — empty fields fill; filled fields that differ show **KI-Vorschlag** only.
3. Click **Speichern** under **Preis & Adresse** (and **Beschreibung** if it was filled and should be kept).
4. Expect redirect query `?basics_saved=1` and/or section success text; green prefilled highlights cleared on saved basics keys.
5. **Reload** the apartment page (full navigation, not only client transition).
6. Assert title, price, and address still match step 1 (or the values just saved) — **not** an older KI-only title or wrong price flash.
7. Run **Auto-Fill** again — previously saved basics must not revert; new empty fields may fill; new **KI-Vorschlag** rows may appear on still-filled differing fields.
8. Click **Verwerfen** on one suggestion — row disappears; input unchanged.
9. Click **Übernehmen** on another — **only** that field changes; others unchanged.
10. Navigate to project list and back to the same apartment — display remains stable (no alternating old/new values).

**Blocker:** Any step where saved DB values are replaced on load by stale session draft data for fields that are not in `pending`.

### 12.16 Checklist fill page

URL pattern:

```text
/project/<projectId>/apartment/<apartmentId>/checklist
```

#### Must always hold

- The page loads for the current apartment.
- A 3-position status control (symbols ○ / ✕ / ✓, no text labels) is visible for each assigned point.
- Notes can be added per point.
- Counter updates after status changes.
- Current user sees only points assigned to that user or to both members.
- Broker-question or Makler-Fragen block appears where configured.
- Status and notes persist after reload.
- Checklist state does not alter the apartment score.

#### Negative cases

- No checklist points
- Point assigned to another user only
- Removed checklist point
- Removed project member
- Apartment archived

#### Evidence

- Snapshot before change
- Snapshot after status and note save
- Reload confirmation
- Console check

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
13. **Draft restore:** save **Preis & Adresse**, reload — no flicker; optional second Auto-Fill does not overwrite saved basics (see §12.15 draft procedure).

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

Toolbar button **KI** opens modal dialog (`ApartmentLlmChatButton`). API: `POST /api/apartments/<apartmentId>/llm/chat` with `{ message, history }`. Server uses `runLlmChatWithOptionalWebSearch` (DuckDuckGo default).

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

#### MCP procedure

1. Open disposable apartment with notes/description (or indexed PDF).
2. Click toolbar **KI** — modal opens, no console errors.
3. Ask a **property-only** question → answer references on-page data; **tippt…** visible during wait.
4. Ask a **web** question (district quality, market norms) → wait for **tippt…** → answer in prose with sources/domains or explicit „keine Treffer“ / failure; **no** JSON tool bubble.
5. Optional DevTools: `POST /api/apartments/<id>/llm/chat` status 200; response JSON has string `answer`, not a JSON object as the only content.
6. Close modal with **×**; reopen — prior turns still visible in session until page reload.

#### Negative cases

- `llm_not_configured` → 503, German error in modal
- `no_source_text` → **KI** button disabled
- Empty message → no request
- `PICKHOME_WEB_SEARCH=0` → answers from property data only (no web claims)

#### Web search configuration (reference)

- **Default:** DuckDuckGo HTML — no `PICKHOME_WEB_SEARCH_API_KEY`.
- **Optional:** `PICKHOME_WEB_SEARCH_PROVIDER=tavily|brave` + API key; fallback to DuckDuckGo on API failure.
- Admin **KI** tab documents DuckDuckGo default and optional paid providers.

#### Evidence

- Snapshot: modal with **tippt…** (mid-request) and with final assistant answer
- Network: `llm/chat` 200
- Console: no errors

### 12.19 Backup export and restore

#### Must always hold

- Backup UI loads without endless loading state.
- Manual download action is visible.
- Scheduled backup settings can be loaded and saved on disposable data.
- Saved backup list is visible when backups exist.
- Restore requires explicit confirmation.
- Invalid restore ZIP is rejected safely.
- Valid synthetic restore preserves database and uploaded files.

#### Negative cases

- Invalid ZIP
- Missing confirmation checkbox
- Backup with missing upload files
- Restore while app is running if unsupported
- Permission error on `data/backups/`

#### Evidence

- Snapshot of backup panel
- Download file start if tested
- Restore result on synthetic backup only
- Console check

### 12.20 Mobile viewport

Recommended viewport:

```text
390 x 844
```

#### Must always hold

- Login is usable.
- Main navigation is reachable.
- Project tabs are reachable.
- Apartment list is usable.
- Apartment detail can be opened and saved where tested.
- Map tab does not make the page unusable.
- No main navigation horizontal overflow blocks use.

#### Negative cases

- Long project names
- Long apartment titles
- Many tabs
- Map and overlay panel on narrow viewport
- Admin tabs on narrow viewport

#### Evidence

- Snapshot of navigation
- Snapshot of project tab
- Snapshot of apartment detail
- Console check

## 13. Access control matrix

| Scenario | Expected result |
|---|---|
| Logged-out user opens `/dashboard` | Redirect to `/login` or controlled unauthenticated state |
| Logged-out user opens `/admin` | Redirect to `/login` or controlled unauthenticated state |
| Regular user opens `/admin` | Redirect to `/dashboard` or controlled forbidden state |
| Regular user opens own project | Access granted |
| Regular user opens foreign project | Access denied or redirect |
| Regular user opens foreign apartment by direct URL | Access denied or redirect |
| Admin opens any project | Access granted |
| Admin deletes last admin | Blocked |
| Regular user uses admin server action | Blocked |

## 14. Coverage matrix

Use this matrix to decide where a new feature needs tests.

| Area | Unit | Integration | Browser smoke | Manual optional |
|---|---:|---:|---:|---:|
| Auth and sessions | Required | Required | Required | Optional |
| Project access | Required | Required | Required | Optional |
| Admin user management | Optional | Required | Required | Optional |
| Backup export/import | Required | Required | Optional | Required for release |
| Dashboard visibility | Optional | Required | Required | Optional |
| Apartment CRUD | Required | Required | Required | Optional |
| Listing import | Required | Required | Required | Optional |
| LLM settings and extraction | Required | Required | Required when configured | Optional |
| Scoring and dealbreakers | Required | Required | Required | Optional |
| Criteria editing | Required | Required | Required | Optional |
| Checklist config and fill | Required | Required | Required | Optional |
| Team ratings and divergence | Required | Required | Required | Optional |
| Compare view | Optional | Optional | Required | Optional |
| Purchase costs and financing | Required | Required | Required | Optional |
| Commute and company car | Required | Required | Required | Optional |
| Map, PLZ, districts, overlays | Required | Required | Required | Optional |
| Geocoding and Street View links | Required | Optional | Required | Optional |
| Calendar and iCal | Required | Required | Required | Optional |
| Uploads and media routes | Required | Required | Required | Optional |
| Mobile layout | Not applicable | Not applicable | Required | Optional |

## 15. Regression case library

Keep these regression cases active. They are derived from previously observed issues and common PickHome risk areas.

| Regression | Required check |
|---|---|
| Dev server runs on non-3000 port | Calendar iCal URL must not point to stale `localhost:3000` when app runs on another port and env is configured |
| Calendar timezone prop missing | Calendar tab must not crash and must show viewings |
| Checklist count query unstable | Checklist tab label count must remain stable across criteria, map, compare, and calendar navigation |
| Checklist affects score incorrectly | Changing checklist status must not change apartment score |
| Area mode mutation affects shared data | Wunschgebiet and NoGo mode changes must be reverted or performed only on disposable projects |
| LLM not configured | LLM chat and extract actions must show controlled not-configured state |
| LLM configured | Save, connection test, chat, and extraction must complete or fail with controlled UI feedback |
| KI chat inline web_search JSON | Model must not leave `{"type":"web_search",…}` in the chat bubble; server parses and runs DuckDuckGo; user sees **tippt…** then prose |
| Listing provider blocked | UI must show controlled provider failure, not crash |
| Unsaved price or address edits | Navigation must warn about unsaved changes where implemented |
| Prisma schema changed | `npx prisma generate`, `npm run db:push`, `npm test`, and browser apartment page must pass |
| Backup panel loading | Auto-backup settings must resolve from loading state |
| Street View links | Map popup and apartment detail links must use coordinates where available |
| Public transit provider unavailable | Commute UI must degrade gracefully and avoid runtime crash |
| Auto-Fill toolbar layout shift | Toolbar button must keep min width while showing „wird verarbeitet“ |
| Auto-Fill overwrites filled fields | Must not change non-empty inputs (`onlyEmpty`) |
| Auto-Fill without save | Reload must not show new values after Auto-Fill alone |
| IS24 / Kleinanzeigen fetch | Controlled `fetch_failed`; no crash; existing apartment data intact |
| PDF-only extract | Apartment with PDF, empty URL: extract succeeds or controlled `no_fields` |
| PDF address regex weak | Incomplete address still editable; save persists corrected address |
| Viewing conflict on past tab | Past calendar/viewing sections show no schedule warnings |
| Project quick-add import | „Daten automatisch füllen“ fills add form; create still requires submit |
| Session draft stale fields | After Auto-Fill + save + reload, no flicker; non-pending keys must not overwrite DB display |
| KI-Vorschlag Übernehmen | Single-field apply only; other inputs unchanged |
| Second Auto-Fill after partial save | Saved basics stay; suggestions only on still-differing filled fields |

## 16. Release smoke checklist

Use this compact checklist before merging major UI, schema, or routing changes.

```text
[ ] npm test passed
[ ] npm run build passed
[ ] App started on tested port
[ ] NEXT_PUBLIC_APP_URL verified for tested port
[ ] Admin login passed
[ ] Regular user login passed
[ ] Regular user blocked from /admin
[ ] Admin dashboard passed
[ ] User dashboard passed
[ ] Every project tab loaded
[ ] Apartment detail loaded
[ ] One safe save action persisted after reload
[ ] Checklist config or fill page passed if checklist changed
[ ] Compare tab passed if scoring or apartment list changed
[ ] Map tab passed if address, PLZ, district, coordinate, or overlay code changed
[ ] Calendar tab and iCal URL passed if viewing, timezone, env, or route code changed
[ ] LLM/listing flow passed if import, PDF, or LLM code changed
[ ] KI chat passed if `ApartmentLlmChatButton`, `llm/chat`, or `llm-tools` changed (**tippt…**, no raw `web_search` JSON, web answer in prose)
[ ] Auto-Fill tested on ≥2 portal categories (one readable, one blocked or PDF-only)
[ ] Auto-Fill save + reload verified on disposable apartment
[ ] Draft restore: after basics save + reload, no flicker between old KI data and DB (if `apartment-listing-draft` or Auto-Fill changed)
[ ] KI-Vorschlag: Übernehmen changes one field only; Verwerfen removes hint only
[ ] Viewing schedule warnings checked if calendar/viewing code changed
[ ] Backup UI passed if persistence, data path, upload, or admin code changed
[ ] Mobile smoke passed for user-facing UI changes
[ ] Console checked after each tested area
[ ] No real data documented
```

## 17. New feature update rule

Every new UI route, tab, server action, API endpoint, or domain feature must update this guide with a feature contract.

Use this template:

```md
### Feature: <feature name>

#### Must always hold

- <stable user outcome>
- <stable access or data rule>
- <stable persistence rule>

#### Data requirements

- <required synthetic data>

#### Negative cases

- <validation case>
- <permission case>
- <empty-state case>
- <external failure case if relevant>

#### Evidence

- <snapshot>
- <network or visible state>
- <reload persistence where relevant>
```

Do not add long historical run logs to this file. Put session history into a separate file such as:

```text
docs/testing/MCP_BROWSER_REGRESSION_HISTORY.md
```

## 18. Session note template

Append short notes outside this guide. Do not paste IDs, real addresses, real names, or full logs.

```md
## YYYY-MM-DD - Browser regression session

- App mode: dev | docker | production-like
- Port: <port>
- Data profile: empty | minimal | rich | map | calendar | llm | backup | mobile | custom
- Tested areas: auth, admin, dashboard, project tabs, apartment detail, checklist, map, calendar, LLM/auto-fill, draft restore / KI-Vorschlag, viewing conflicts, backup, mobile
- Portal categories tested (no URLs in note): e.g. readable aggregator, landing-page host, bot-blocked major portal, PDF-only
- Passed:
  - <short statement>
- Failed:
  - <short statement, route, visible symptom, no real data>
- Blockers:
  - <blocker or none>
- Follow-up tests needed:
  - <short statement or none>
```

## 19. Developer guidance for stronger future coverage

### 19.1 Prefer deterministic tests before browser checks

If a bug can be tested without a browser, add a unit or integration test first. Browser tests are valuable but slower and more fragile.

Examples:

- Score calculation: unit or integration first
- iCal feed content: unit or integration first
- Access control: integration first, browser second
- Backup roundtrip: integration first, browser optional
- UI crash on tab navigation: browser required
- Mobile usability: browser required

### 19.2 Add stable selectors only for unstable UI

Use accessible roles and labels where possible. Add `data-testid` only for controls that are important and otherwise hard to locate reliably.

Recommended examples:

```tsx
data-testid="nav-admin"
data-testid="project-tab-calendar"
data-testid="project-tab-map"
data-testid="apartment-save-price-address"
data-testid="apartment-auto-fill"
data-testid="apartment-llm-extract"
data-testid="project-listing-import"
data-testid="map-load-addresses"
data-testid="map-area-mode"
data-testid="calendar-ical-url"
data-testid="checklist-progress"
data-testid="checklist-status-ok"
```

Do not use generated IDs as test selectors.

### 19.3 Test outcomes, not labels only

A button being present is not enough. A good browser test confirms:

- The action can be triggered.
- The user receives controlled feedback.
- The expected state persists after reload where relevant.
- Unauthorized users cannot perform the action.
- Empty and failure states are controlled.

### 19.4 Keep external services isolated

External listing providers, geocoding, OSRM, public transit APIs, and LLM endpoints may fail independently of PickHome. Browser tests must distinguish:

- PickHome UI bug
- Controlled external-provider failure
- Configuration issue
- Test data issue

Mock or self-host external dependencies for release-critical tests where possible.

## 20. Appendix: Optional MCP execution skeleton

This skeleton is intentionally generic. Adapt tool names to the actual MCP host.

```text
1. navigate to BASE_URL/login
2. take_snapshot
3. submit invalid credentials
4. take_snapshot
5. list_console_messages
6. submit admin credentials
7. take_snapshot
8. open admin tabs
9. take_snapshot after each tab
10. list_console_messages
11. logout
12. submit regular user credentials
13. open /admin directly
14. verify redirect or forbidden behavior
15. open /dashboard
16. open first owned project
17. iterate tabs: default, archived, team, settings, criteria, checklist, compare, map, calendar
18. take_snapshot and console check after each tab
19. open first suitable apartment
20. expand critical sections and perform one safe mutation
21. reload and verify persistence
22. open checklist fill page if configured
23. if llm profile: on Immobilien tab, run listing import on add form (readable URL)
24. open apartment with listing URL or PDF; run toolbar Auto-Fill; save Preis & Adresse; reload
25. draft restore: reload after save — confirm no flicker; optional second Auto-Fill + KI-Vorschlag Übernehmen/Verwerfen
26. optional: apartment on blocked portal — Auto-Fill shows controlled failure, no data loss
27. if calendar data: confirm upcoming viewing shows schedule warning when times are tight; past section has none
28. switch to mobile viewport and repeat navigation smoke
29. write short session note outside this guide
```
