# Development and Deployment

## Local development

### Prerequisites

- Node.js 20 LTS
- npm

### Setup

1. Create `.env` from `.env.example` and set:
   - `ORS_API_KEY`

2. Install dependencies:

```bash
npm install
npm install --prefix client
```

### Run dev servers

```bash
npm run dev
```

This starts:

- API on `http://localhost:4000`
- Vite dev server on `http://localhost:5173`

### Import ACI data

```bash
npm run import:aci
```

This loads Excel files from `data/aci-xlsx/` into `data/costi.sqlite`.

## Production (Hetzner + Traefik + Docker Compose)

### Files

- `Dockerfile` builds a single container that serves API + static frontend
- `docker-compose.yml` runs the app and connects to the external `traefik-net`

### VM provisioning (summary)

1. Install Docker + Compose plugin
2. Traefik is managed separately in `~/infra-traefik` (already on 80/443)
3. Ensure the external Docker network `traefik-net` exists
4. Create app directory: `/home/daniele/projects/costikm`
5. Clone repo into app directory

### Required `.env` on the VM

- `ORS_API_KEY=...`
- `DOMAIN=danzapp.duckdns.org`
- `PORT=4000`

Note: TLS is handled by the central Traefik (`tlsChallenge`), so `LE_EMAIL` lives in `~/infra-traefik/traefik/traefik.yml` (not in this app).

### First deploy (manual)
#
```bash
cd /home/daniele/projects/costikm
cp .env.example .env
# edit .env with real values
docker network create traefik-net || true
docker compose up -d --build
```

### CI/CD (GitHub Actions)

Workflow: `.github/workflows/deploy.yml`

Required GitHub secrets:

- `SSH_HOST`
- `SSH_USER`
- `SSH_KEY`
- `APP_DIR` (e.g., `/home/daniele/projects/costikm`)

On push to `main`, it SSHes to the VM and runs:

```bash
git pull
docker compose up -d --build
```

### Health check

```bash
curl -fsS https://danzapp.duckdns.org/
```
