# PickHome

Self-hosted apartment scoring for house hunting: weighted criteria, dealbreakers, comparison, photos, and viewing appointments. German UI, no payment integration.

Repository: [github.com/n3roGit/PickHome](https://github.com/n3roGit/PickHome)

## Features

- **Admin** (`/admin`): create users, reset passwords, delete users
- **Users**: projects, apartments, criteria (weight & dealbreaker), ratings 0–10, leaderboard, archive
- **Per apartment**: photos, viewing appointments (past/upcoming), notes on ratings

## Quick start (Docker)

Requirements: [Docker](https://docs.docker.com/get-docker/) with Compose.

### Pull from Docker Hub (recommended)

Image: **[`n3ro88/pickhome`](https://hub.docker.com/r/n3ro88/pickhome)**

Save as `docker-compose.yml` (or use the file from this repo):

```yaml
services:
  pickhome:
    image: n3ro88/pickhome:latest
    container_name: pickhome
    ports:
      - "${PICKHOME_PORT:-3000}:3000"
    environment:
      DATABASE_URL: "file:/app/data/pickhome.db"
      PICKHOME_DATA_DIR: "/app/data"
      NODE_ENV: production
      NEXT_PUBLIC_APP_URL: "${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

```bash
mkdir -p data
docker compose pull
docker compose up -d
```

From a git clone (uses the same `docker-compose.yml` in the repo):

```bash
git clone https://github.com/n3roGit/PickHome.git
cd PickHome
docker compose pull
docker compose up -d
```

Open **http://localhost:3000**

| Role | Default login |
|------|----------------|
| Administrator | `admin` / `admin` |

Change the admin password after first login (Admin → user → new password).

### Data persistence

All runtime data lives in **`./data/`** (gitignored). Docker bind-mounts the same folder:

| Path | Content |
|------|---------|
| `data/pickhome.db` | SQLite database |
| `data/uploads/` | Apartment photos and documents |

Stop / start:

```bash
docker compose down
docker compose up -d
```

Custom port:

```bash
PICKHOME_PORT=8080 docker compose up -d
```

## Local development (without Docker)

```bash
npm install
cp .env.example .env
npm run db:push && npm run db:seed
npm run dev
```

→ http://localhost:3000

## Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run unit + integration tests |
| `npm run test:watch` | Tests in watch mode |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run db:reset` | Reset DB + seed admin |
| `npm run db:push` | Apply Prisma schema |
| `npm run db:seed` | Seed admin user only |

## Stack

- Next.js 14 (App Router)
- SQLite + Prisma
- Tailwind CSS
- bcrypt session cookies

## Security notes

- Intended for **private / LAN** use. Put a reverse proxy with TLS in front if exposed to the internet.
- Default admin credentials are for first setup only — change them immediately.
- Uploaded images are stored under `data/uploads/` (served at `/uploads/...`).

## License

Private use — adjust as needed for your deployment.
