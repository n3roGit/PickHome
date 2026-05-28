# Feature: Apartment Sonnenstand, Sonnenbahn, AR-Kompass

## Must always hold

- On an apartment detail page with geocoded coordinates (`latitude` and `longitude` set), a collapsible section **Sonnenstand** is visible (`data-testid="solar-panel"`).
- Without coordinates, the section is **not** shown and the page loads without runtime errors.
- The panel shows sun altitude and compass direction for the selected date/time; sunrise, sunset, solar noon, and golden-hour times use the app timezone.
- The time slider (`data-testid="solar-time-slider"`) updates displayed altitude, direction, and map overlay without a full page reload.
- Season shortcuts (`data-testid="solar-season-summer"` etc.) set the date to mid-season (15 Jan / Apr / Jul / Oct of the current year).
- Expanding **Sonnenstand** shows the Leaflet mini map (`data-testid="solar-map"`) with a sun-path arc and a marker for the current slider time; **Karte ausblenden** hides it again.
- When a future viewing appointment exists, a line describes sun position at that appointment time.
- **AR vor Ort öffnen** (only when `DeviceOrientationEvent` is available) navigates to `/project/.../apartment/.../sonne-ar` without crashing.
- The AR page shows controlled errors for HTTPS/camera/compass denial — no uncaught exceptions or Next.js overlay.
- After **Kamera, Kompass & Standort starten**, hourly sun markers for the selected date appear (`data-testid="solar-date-input"` in AR header); the current hour uses a larger marker only when the date is today.
- While AR is running, the round **camera save** button (`data-testid="solar-ar-save-photo"`) saves the live preview including AR overlay to the apartment **Bilder** gallery without a confirmation dialog.
- AR requests **geolocation** and computes sun positions from the **device’s current GPS coordinates** (not the apartment’s stored geocode).
- When the phone lies flat (screen up or down on a table), AR shows **„Handy hochkant halten — flach auf dem Tisch keine AR-Sonnen“** and does **not** draw sun markers (gravity disambiguates Android `beta ≈ 0`).
- AR uses **absolute** device orientation when available (`deviceorientationabsolute`); no mixing with relative events.
- Opening AR from the panel passes `?date=YYYY-MM-DD` matching the panel date.

## Data requirements

- Profile `rich` or `map`: at least one apartment with geocoded coordinates.
- Optional: same or another apartment with a **future** viewing appointment for the viewing-time line.
- Optional: one apartment without coordinates to verify the section is hidden.

## Negative cases

- Apartment without coordinates: no solar section; no console errors.
- AR on desktop or without permissions: `data-testid="solar-ar-error"` or idle state with clear message (camera, compass, or location); no crash.
- AR phone flat on table: hint about holding upright; no sun markers until portrait viewing pose; no crash.
- AR over plain HTTP (non-localhost): `https_required` message is acceptable (Severity: Medium).

## Evidence

- Snapshot: solar panel expanded with day times visible.
- Snapshot: map visible when the section is expanded; sun marker moves when slider changes.
- Snapshot: AR page after opening link (error or running state).
- `list_console_messages` after each step — no red errors.
- Mobile viewport 390×844: panel and slider usable without horizontal overflow.

## Run order hint

After opening an apartment detail (main checklist §9 step 9), expand **Sonnenstand**, exercise slider and map, then optionally open AR. Re-check **Preis & Adresse** save and PDF dialog if this was a release regression pass.
