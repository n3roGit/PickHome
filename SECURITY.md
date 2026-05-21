# Security Policy

## Supported versions

Security fixes are provided for the latest release on the `main` branch and for
the most recent tagged release on
[GitHub Releases](https://github.com/n3roGit/PickHome/releases).

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| older   | :x:                |

## Reporting a vulnerability

If you discover a security issue, please **do not** open a public GitHub issue.

Instead, report it privately using one of these options:

1. **[GitHub Security Advisories](https://github.com/n3roGit/PickHome/security/advisories/new)** (preferred)
2. A private message to the maintainers if you already have a contact channel

Include:

- A clear description of the issue and impact
- Steps to reproduce (or a proof of concept if safe)
- PickHome version or Docker image tag (`n3ro88/pickhome:…`)
- Whether the instance is exposed to the internet or LAN-only

We aim to acknowledge reports within a reasonable time and will coordinate a fix
and disclosure when appropriate.

## Deployment expectations

PickHome is intended for **private or trusted network** use. If you expose it to
the internet:

- Terminate TLS at a reverse proxy
- Change default admin credentials immediately after first login
- Enable TOTP for accounts where possible
- Restrict network access (VPN, firewall, allowlists)
- Keep Docker images and dependencies updated (production image uses multi-stage
  build, Next.js standalone, and `node:22-alpine`; check Docker Scout on Hub)

Uploaded files are stored under `data/uploads/` and served from `/uploads/…`.
Treat backups (`data:export`) as sensitive — they contain user data and hashes.

## Out of scope

General hardening advice, feature requests, and non-security bugs belong in
[GitHub Issues](https://github.com/n3roGit/PickHome/issues) with the appropriate
template.
