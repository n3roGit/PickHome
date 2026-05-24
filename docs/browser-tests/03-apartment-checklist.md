# Apartment detail and checklist fill

Part of the [PickHome Browser Regression Guide](../MCP_BROWSER_TEST_CHECKLIST.md).

Apply shared rules from the master guide: **§2 Hard rules**, **§7 Evidence requirements**, **§8 Severity rules**.

---

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
- Collapsible section **Finanzen** (formerly „Kaufnebenkosten & Finanzierung“) reflects project defaults and apartment cost fields (Sanierung in Gesamtkosten, laufende Kosten in Monatsbelastung when net income is set); when project **Fixkosten** are set, shows Fixkosten row, **Gesamtbelastung / Monat** (Rate + Wohnnebenkosten + Fixkosten), **Rest nach allen Kosten**, and contextual warnings for rate share (35 / 45 % guidelines), housing share (40 %), and tight/negative remaining buffer; Makler checkbox with **Übernehmen** lives here.
- Commute section shows per-member travel data where account addresses exist.
- Company car and commuter allowance information appears when configured.
- Image, camera, and exposé upload inputs accept supported file types and reject unsupported file types.
- Camera allows taking another photo while earlier uploads still run in the background; progress text appears; gallery shows pending previews until sync completes.
- Viewing appointments can be listed and added on disposable data.
- Opinion differences appear when multiple members rated shared criteria.
- Criteria rating (section **Kriterien bewerten**): **—** button = not rated (distinct from score **0**); **0–10** as a segmented tap scale (`RatingScalePicker`, no range slider); segments left of the selection are visually filled; current score shown at the right; tap persists to the DB.
- Criteria rating can be set to 0–10 or cleared with **—** and persists after reload.
- Toolbar **KI** (Immobilien-Assistent) visible only when Admin → KI is configured (`isLlmConfigured`); see [§12.18](04-listing-llm.md#1218-immobilien-assistent-ki-chat).
- Checklist blocks appear under criteria that are part of the checklist.
- Custom checklist-only items appear in a separate checklist section where configured.
- Toolbar **KI** opens Immobilien-Assistent (see [§12.18](04-listing-llm.md#1218-immobilien-assistent-ki-chat)).

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
- A 3-position status control (symbols ○ / ✕ / ✓ as tappable buttons, not a range slider; no text labels) is visible for each assigned point.
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
