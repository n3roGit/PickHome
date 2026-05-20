# Changelog

## [Unreleased]

### Features

- Map tab: instant Wunschgebiet PLZ circles from static PLZ centroids in `plz-de.json` (8158 PLZ).
- Map tab: toggle to show/hide Wunschgebiet circles; pins always colored by score.

### Changed

- Map tab: removed separate pin color modes for Wunschgebiet and Dealbreaker.

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
