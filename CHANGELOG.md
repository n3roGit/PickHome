# Changelog

## [Unreleased]

## [1.3.0](https://github.com/n3roGit/PickHome/releases/tag/v1.3.0) (2026-05-22)

### Features

- Checklist fill: three-state status slider (not ok / unset / ok), camera shortcut on detail and checklist pages, batched photo uploads.
- Apartment basics: optional running/one-off cost fields, plot size (m²) in forms, listing import, compare, and purchase-cost estimates.
- Viewing schedule: 60-minute slots, driving-time buffer between addresses, overlap warnings on calendar and apartment pages.
- LLM assistant: optional web search (Tavily/Brave) with admin API key; tool-calling in apartment chat.
- Apartment detail: toolbar with score summary, collapsed criteria rating by default.

### Bug Fixes

- Viewing schedule warnings no longer crash calendar and appointment lists (`scheduleWarnings` prop).

### Changed

- Project checklist: enable scoring criteria for viewing notes, custom extra points, team assignee, fill on `/apartment/.../checklist`; filled info shows on rating sliders; custom points in a separate section.
- Map tab: instant Wunschgebiet PLZ circles from static PLZ centroids in `plz-de.json` (8158 PLZ).
- Map tab: toggle to show/hide Wunschgebiet circles; pins always colored by score.
- Map tab: removed separate pin color modes for Wunschgebiet and Dealbreaker.
- Browser regression guide extended for new flows.

## [1.2.0](https://github.com/n3roGit/PickHome/releases/tag/v1.2.0) (2026-05-20)

### Features

- Purchase cost estimates use the apartment address Bundesland when detectable (PLZ or name), overriding the project default.
- README demo screenshots.

### Bug Fixes

- Apartment list sort order is applied on the project page.

## [1.1.0](https://github.com/n3roGit/PickHome/releases/tag/v1.1.0) (2026-05-19)

### Features

- Rough purchase cost estimates per apartment (land transfer tax by federal state, notary/registry, broker).
- Full-text search across apartment fields, ratings, viewings, photos, and documents.
- Image upload limit raised to 10 MB with visible size errors.

### Bug Fixes

- Viewing appointment times no longer shift by timezone on save.
- PDF upload limit raised to 30 MB.
- Upload limit constants split from apartment-media for client bundle safety.

### Changed

- Releases: set version in `package.json` and push to `main` (no Release Please PR).

## [1.0.0](https://github.com/n3roGit/PickHome/releases/tag/v1.0.0) (2026-05-19)

First public release. See [release notes](https://github.com/n3roGit/PickHome/releases/tag/v1.0.0).

---

All notable changes are also listed in [GitHub Releases](https://github.com/n3roGit/PickHome/releases).

Release versions follow [Semantic Versioning](https://semver.org/). Each push to `main` bumps the patch digit in `package.json` and creates tag `v*` plus a [GitHub Release](https://github.com/n3roGit/PickHome/releases). Set major/minor in `package.json` manually when needed.
