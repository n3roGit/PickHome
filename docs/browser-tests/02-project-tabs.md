# Project shell and tabs

Part of the [PickHome Browser Regression Guide](../MCP_BROWSER_TEST_CHECKLIST.md).

Apply shared rules from the master guide: **§2 Hard rules**, **§7 Evidence requirements**, **§8 Severity rules**.

---

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
- Bundesland, purchase-cost defaults, broker settings, financing defaults (Eigenkapital, Laufzeit, Sollzins, Haushaltsnetto, **monatliche Fixkosten**), and dealbreaker threshold are visible where supported.
- **Monatliche Fixkosten** field appears under Haushaltsnetto in Finanzierung section; save persists after reload (`?settings_saved=1`); empty field clears value.
- Fixkosten help text clarifies Lebenshaltung außer Wohnen (Hausgeld/Heizung pro Immobilie).
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
- Group and criterion names are edited in one form; **Speichern** at the bottom saves all renames.
- `ProjectUnsavedGuard` highlights the name form (`pn-section-unsaved`) while typing; leaving the page shows the unsaved-changes dialog.
- Gewicht and Dealbreaker still save immediately on click.

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
- Finance comparison includes **Gesamtbelastung/Monat (grob)**; when at least one selected apartment has **Kaltmiete**, also shows **Kaltmiete**, **Mietdeckung Rate**, **Gesamtbelastung/Monat nach Miete (grob)**, and **Anteil Rate am Netto (nach Miete)** when Haushaltsnetto is configured.
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

