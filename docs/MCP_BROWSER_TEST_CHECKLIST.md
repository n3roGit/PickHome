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
14. LLM and listing import if configured (project quick-add **and** apartment Auto-Fill; see [04-listing-llm.md](browser-tests/04-listing-llm.md))
15. Viewing schedule conflict warnings if calendar or viewing code changed (see [02-project-tabs.md](browser-tests/02-project-tabs.md) §12.14)
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
| Apartment detail | Price/address, listing link, notes, **Finanzen** (Fixkosten, Gesamtbelastung, Rest), **KI** chat (Finanz/Pendel/Checkliste-Schätzungen), Auto-Fill + **KI-Vorschlag**, draft restore, rating scale (— + 0–10 tap segments), archive/delete, commute, checklist | Save or controlled no-op; no flicker after save/reload; chat shows **tippt…** and prose answers; Schätzwerte als Orientierung; no runtime errors |
| Checklist fill | Assignment filtering, 3-symbol status buttons (○/✕/✓, tap only), notes, progress | Status persists after reload |
| Compare | Select 2 or more apartments; **Gesamtbelastung/Monat (grob)** when finance configured | Comparison table appears |
| Map | Load addresses, markers, overlays, mode toggle, Street View link | Coordinate count and overlay API if available |
| Calendar | Upcoming and past viewings, iCal URL | URL host/port correct, no crash |
| LLM/listing | Configured and not configured states; project import + apartment Auto-Fill on ≥2 portal types | Controlled success/partial/failure; `onlyEmpty` respected; **pending-only** session draft restore; save persists after reload |
| Viewing conflicts | Two upcoming viewings same day, tight schedule | Warning on apartment detail (upcoming only) and project calendar (upcoming only); past section has no warnings |
| Mobile | Narrow viewport navigation and one project flow; scroll checklist fill + **Kriterien bewerten** without accidental rating/status changes | No unusable horizontal overflow; scroll does not change checklist status or criterion scores (tap only) |

## 12. Feature contracts

Stable per-area contracts. UI labels may change; user outcomes must not break. Shared rules: **§2**, **§7**.

| Area | Contract |
|------|----------|
| Authentication, account, admin, dashboard | [01-auth-admin-dashboard.md](browser-tests/01-auth-admin-dashboard.md) |
| Project shell, Immobilien, Archiv, team, settings, criteria, checklist config, compare, map, calendar | [02-project-tabs.md](browser-tests/02-project-tabs.md) |
| Apartment detail, checklist fill page | [03-apartment-checklist.md](browser-tests/03-apartment-checklist.md) |
| Listing import, Auto-Fill, Immobilien-Assistent (KI chat) | [04-listing-llm.md](browser-tests/04-listing-llm.md) |
| Backup export/restore, mobile viewport | [05-backup-mobile.md](browser-tests/05-backup-mobile.md) |
| Photo gallery, thumbnails, upload queue, camera | [06-photo-gallery.md](browser-tests/06-photo-gallery.md) |
| Regression case library (reference table) | [regression-library.md](browser-tests/regression-library.md) |

New features: add or extend the matching contract file and register it in this table. Template: **§17**.


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

Full table: [browser-tests/regression-library.md](browser-tests/regression-library.md).

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
[ ] Project settings: **Monatliche Fixkosten** save/reload if finance settings changed
[ ] Finanzen panel: **Gesamtbelastung/Monat** and **Rest nach allen Kosten** if Fixkosten + Haushaltsnetto set
[ ] Compare tab: **Gesamtbelastung/Monat (grob)** row if compare/finance code changed
[ ] KI chat: finance/commute/checklist estimate questions answered as **Schätzung** (if LLM context changed)
[ ] Auto-Fill tested on ≥2 portal categories (one readable, one blocked or PDF-only)
[ ] Photo gallery: grid loads WebP thumbs; lightbox loads original; upload/delete/reload if photo code changed
[ ] Photo gallery mobile (Android Chrome 412x915 + iPhone 390x844): swipe between images, double-tap or pinch zoom, no pull-down close, lightbox uses 100dvh (no jump when address bar collapses), bottom toolbar above gesture bar
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
22. open checklist fill page if configured; on mobile viewport scroll past several points — status unchanged until ○/✕/✓ tap
23. if llm profile: on Immobilien tab, run listing import on add form (readable URL)
24. open apartment with listing URL or PDF; run toolbar Auto-Fill; save Preis & Adresse; reload
25. draft restore: reload after save — confirm no flicker; optional second Auto-Fill + KI-Vorschlag Übernehmen/Verwerfen
26. optional: apartment on blocked portal — Auto-Fill shows controlled failure, no data loss
27. if calendar data: confirm upcoming viewing shows schedule warning when times are tight; past section has none
28. open Immobilien-Assistent; property question; then „Was habe ich davor gefragt?“ — must reference prior user message
29. switch to mobile viewport and repeat navigation smoke
30. write short session note outside this guide
```

### 20.1 Session note template (no PII)

```text
Date: YYYY-MM-DD | Port: <port> | Profile: rich + prod backup (logins reset)
Preflight: npm test OK | build: optional
Pass: auth, roles, account, admin tabs, project tabs (9), apartment detail, KI chat + history meta, compare UI, mobile nav
Criteria tab: name edits + bottom Speichern + unsaved highlight (see 02 §12.10)
Skip: backup restore, TOTP full enroll, mutating calendar
```
