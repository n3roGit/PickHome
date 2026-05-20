# Contributing to PickHome

Thank you for your interest in contributing. PickHome is a self-hosted apartment
scoring app (Next.js, Prisma, SQLite) with a German UI.

## Before you start

- Read the [README](README.md) for setup (Docker or local dev).
- Search [existing issues](https://github.com/n3roGit/PickHome/issues) to avoid duplicates.
- For security vulnerabilities, follow [SECURITY.md](SECURITY.md) — do not open public issues for sensitive reports.

## Development setup

```bash
git clone https://github.com/n3roGit/PickHome.git
cd PickHome
npm install
cp .env.example .env   # if present; set DATABASE_URL and secrets
npm run db:push
npm run db:seed
npm run dev
```

Data lives under `./data/` (database, uploads). Do not commit `data/`, `.env`, or secrets.

## Code conventions

- **UI copy and page metadata:** German (`lang="de"`).
- **Code:** English — identifiers, comments, commit messages, tests.
- Path alias: `@/*` → `src/*`.
- Run `npm test` before opening a pull request.
- Keep changes focused; match existing style in the touched files.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Implement your change with tests when behavior changes.
3. Run `npm test` locally.
4. Open a PR against `main` using the pull request template.
5. Describe what changed, why, and how you tested it.

Releases: pushes to `main` bump the patch version in `package.json` via CI. Update `CHANGELOG.md` when you introduce user-visible changes worth noting in a release.

## Reporting bugs and ideas

Use the GitHub issue templates:

- **Bug report** — reproducible steps, environment, expected vs actual behavior.
- **Feature request** — problem, proposed solution, impact.

Please do not include passwords, session tokens, real apartment addresses, or backup archives in issues.

## Code of conduct

This project follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Participants are expected to uphold it.

## License

By contributing, you agree that your contributions will be licensed under the
same license as the project (GPL-3.0 — see [LICENSE](LICENSE)).
