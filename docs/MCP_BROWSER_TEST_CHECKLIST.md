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
- Listing import, PDF context, and LLM assisted features
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
```

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
| `llm` | Listing import and LLM regression | LLM settings, one listing URL, one PDF exposé, one apartment with empty fields, one apartment with existing fields |
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
14. LLM and listing import if configured
15. Mobile viewport
16. Optional backup export, restore, TOTP full activation
17. Session note

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
| Apartment detail | Price/address, listing link, notes, rating, archive/delete controls, commute, checklist links | Save or controlled no-op, no runtime errors |
| Checklist fill | Assignment filtering, 3-symbol status slider, notes, progress | Status persists after reload |
| Compare | Select 2 or more apartments | Comparison table appears |
| Map | Load addresses, markers, overlays, mode toggle, Street View link | Coordinate count and overlay API if available |
| Calendar | Upcoming and past viewings, iCal URL | URL host/port correct, no crash |
| LLM/listing | Configured and not configured states | Controlled 200, 4xx, or 503 behavior with user-friendly UI |
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

#### Negative cases

- Empty project
- Apartment without address
- Apartment without score
- Apartment over budget
- Invalid listing URL
- Provider blocks listing read
- Area filter configured but address has no coordinates

#### Evidence

- Snapshot of list
- Snapshot after search
- Snapshot after sorting
- Controlled listing import result if tested
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

#### Evidence

- Snapshot
- iCal URL text
- Optional feed request status
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
- Listing URL section can be expanded and saved.
- Notes and description sections can be expanded and saved.
- Purchase cost and financing section reflects project defaults and apartment cost fields (Sanierung in Gesamtkosten, laufende Kosten in Monatsbelastung when net income is set).
- Commute section shows per-member travel data where account addresses exist.
- Company car and commuter allowance information appears when configured.
- Image, camera, and exposé upload inputs accept supported file types and reject unsupported file types.
- Camera allows taking another photo while earlier uploads still run in the background; progress text appears; gallery shows pending previews until sync completes.
- Viewing appointments can be listed and added on disposable data.
- Opinion differences appear when multiple members rated shared criteria.
- Criteria sliders can be changed and persisted.
- Checklist blocks appear under criteria that are part of the checklist.
- Custom checklist-only items appear in a separate checklist section where configured.

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
- Reload after one persisted mutation on disposable data
- Console check

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

#### Must always hold

- On apartment detail, „Daten automatisch füllen“ may prefill empty cost fields in „Preis & Adresse“ when the listing or PDF mentions Hausgeld, Heizkosten, Grundsteuer, or Sanierung; user must save manually.
- Admin LLM settings can be saved when valid.
- LLM connection test shows a controlled success or controlled failure.
- If LLM is not configured, apartment LLM actions show a controlled not-configured state.
- Listing import can prefill empty fields when provider data is readable.
- Existing non-empty fields are not overwritten without clear user intent.
- PDF context can be used by LLM extraction when available.
- The UI clearly distinguishes successful extraction, partial extraction, and provider failure.
- Broker or Makler detection is reflected in the relevant checkbox where supported.

#### Negative cases

- Missing API token
- Invalid base URL
- LLM API timeout
- Model endpoint missing
- Invalid JSON or malformed response
- Listing provider blocks scraping
- PDF has no extractable text
- Listing URL and PDF data disagree

#### Evidence

- Admin LLM settings snapshot
- Network status for save and test where available
- Apartment extraction result
- No console errors

### 12.18 Backup export and restore

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

### 12.19 Mobile viewport

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
| Listing provider blocked | UI must show controlled provider failure, not crash |
| Unsaved price or address edits | Navigation must warn about unsaved changes where implemented |
| Prisma schema changed | `npx prisma generate`, `npm run db:push`, `npm test`, and browser apartment page must pass |
| Backup panel loading | Auto-backup settings must resolve from loading state |
| Street View links | Map popup and apartment detail links must use coordinates where available |
| Public transit provider unavailable | Commute UI must degrade gracefully and avoid runtime crash |

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
- Tested areas: auth, admin, dashboard, project tabs, apartment detail, checklist, map, calendar, LLM, backup, mobile
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
data-testid="apartment-llm-extract"
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
23. switch to mobile viewport and repeat navigation smoke
24. write short session note outside this guide
```
