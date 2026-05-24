# Browser test contract: Photo gallery and uploads

Sections **§12.21** in [MCP_BROWSER_TEST_CHECKLIST.md](../MCP_BROWSER_TEST_CHECKLIST.md).

## §12.21 Photo gallery and uploads

### Feature: Apartment photo gallery with thumbnails

#### Must always hold

- Grid thumbnails and hero image load `thumbUrl` (WebP) when available, not the full original.
- Opening the lightbox loads the original `url` for the main image; zoom up to 300% works (toolbar buttons, double-tap/pinch on mobile, keyboard `+`/`-` on desktop).
- Photos without `thumbUrl` (pre-backfill or HEIC fallback) show the original via `thumbUrl ?? url` without errors or blank tiles.
- Deleting a photo removes it from the gallery after reload and does not leave broken image tiles.
- Upload queue shows progress for single and multi-file uploads; pending blob previews appear before server completion.
- After upload completes and page reload, all photos persist with stable order.

#### Data requirements

- One apartment with at least 2 existing photos (for gallery grid and lightbox navigation).
- One disposable apartment for mutating upload/delete tests.
- Synthetic JPEG/PNG test images only; no real listing or customer photos.

#### Negative cases

- Apartment with no photos: section shows empty state, no runtime error.
- File over 10 MB: controlled error message, no crash, other queued uploads continue.
- Invalid file type (e.g. `.txt`): controlled error, no upload.
- More than 20 files selected at once: first 20 queued, remainder rejected with message.

#### Upload scenarios (MCP)

1. Single JPEG upload → progress label → photo appears in gallery.
2. Multi-select 5 photos → queue progress → all appear.
3. Multi-select 12 photos → all accepted (queue limit 20), max 3 parallel uploads visible in progress.
4. Multi-select more than 20 photos → 20 accepted, rest rejected with message.
5. Large file near 10 MB → upload succeeds.
6. Mobile viewport: camera button visible and opens capture UI (snapshot only; no real camera required).
7. Reload after bulk upload → all photos still present.
8. Delete one photo → gone after reload.

#### Thumbnail bandwidth checks

- Network tab on apartment detail: grid/hero requests use `.webp` thumb URLs, not original `.jpg`/`.png` paths.
- Opening lightbox: network shows original URL loaded for main image only.
- Repeat visit (soft navigate away and back, or second apartment open): no new `/uploads/**` requests — browser serves from immutable cache (`Cache-Control: public, max-age=31536000, immutable`).
- Response headers on thumb and original URLs include `immutable` and `max-age=31536000`.

#### Mobile lightbox gestures

Test at **412×915** (Android Chrome, primary) and **390×844** (iPhone, secondary). Apartment with ≥30 photos recommended for swipe and bandwidth checks.

| Check | Expected |
|---|---|
| Swipe left/right | Next/previous image; counter updates |
| Double-tap / pinch | Zoom above 100% (MCP: double-tap simulable; pinch manual on device) |
| Swipe while zoomed | Pan only, no slide change |
| Tap on image (unzoomed) | Toolbar + thumbnails + caption toggle visible/hidden |
| Address bar collapse | Lightbox uses `100dvh`; no vertical clip when opening after page scroll (Android Chrome) |
| Bottom padding | Thumbnails above Android gesture bar / iOS home indicator |
| Close | Close button + Escape; **no** pull-down-to-close |
| Bandwidth | Unchanged: grid WebP thumbs, lightbox loads original only |

#### Evidence

- Snapshot after gallery load (grid + hero visible).
- Network panel or request list showing thumb vs original URLs.
- Snapshot after lightbox open with zoom at >100% (double-tap or toolbar zoom).
- Snapshot with chrome hidden after tap on image.
- Snapshot after multi-upload completion.
- Console check: no errors after upload, delete, or gallery navigation.
