# TaskFlow API

A small, production-style **Task Management REST API** (Node.js + Express) with
authentication, validation, health checks, and Prometheus metrics. It ships with a
one-command Docker Compose stack (API + Prometheus) and a full 7-stage Jenkins
CI/CD pipeline.

> **Goal of this README:** get you from `git clone` to a running API in **under 5 minutes**.

---

## 1. Prerequisites

| Tool | Version | Needed for |
|------|---------|------------|
| **Docker Desktop** (WSL2 backend on Windows) | current | The quick start below |
| **Docker Compose** | v2+ (bundled with Docker Desktop) | `docker compose` command |
| **Node.js** | **20+** (LTS) | Only if running the app or tests *without* Docker |
| **Git** | any | Cloning |

For the Quick Start you only need **Docker Desktop running** — Node is not required
on your machine because the app is built and run inside the container.

---

## 2. Quick start (Docker — under 5 minutes)

```bash
git clone https://github.com/Zaidzyy/taskflow-api.git
cd taskflow-api
cp .env.example .env        # provides the API key + version (see step 3)
docker compose up --build
```

That's it. The first build takes ~1–2 minutes; after that the API and Prometheus
are up. Leave it running and open a second terminal to hit the API (step 5).

Stop and clean up with:

```bash
docker compose down          # add -v to also remove the network/volumes
```

---

## 3. Environment configuration (`.env`)

The app reads its config from environment variables (see `src/config.js`). For the
Docker quick start, the only value Compose injects into the container is the
**`API_KEY`** (used to authorize write requests) and **`APP_VERSION`** (shown at
`/health`). A ready-made template is provided:

```bash
cp .env.example .env
```

`.env.example` contents (safe dummy values — change `API_KEY` for anything real):

```dotenv
API_KEY=dev-local-api-key-change-me
APP_VERSION=local-dev
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

Notes:
- **The quick start works even without a `.env`** — `docker-compose.yml` has safe
  fallbacks — but copying `.env.example` to `.env` is the documented, predictable
  path and lets you set your own `API_KEY`.
- Under Docker Compose, `PORT` and `NODE_ENV` are fixed by `docker-compose.yml`;
  `API_KEY`/`APP_VERSION` come from your `.env`. When running with `npm start`
  instead, all of the variables above apply.
- `.env` is **git-ignored**, so your key never gets committed.

---

## 4. What runs where

After `docker compose up`, using the ports defined in `docker-compose.yml`:

| Service | URL | Notes |
|---------|-----|-------|
| API (health) | http://localhost:3000/health | Liveness + version + uptime |
| API (metrics) | http://localhost:3000/metrics | Prometheus exposition format |
| API (tasks) | http://localhost:3000/api/tasks | REST resource (see below) |
| Prometheus UI | http://localhost:9090 | Scrapes the API every 10s; alert rules loaded |

Handy Prometheus links: **Targets** at http://localhost:9090/targets (the
`taskflow-api` target should be **UP**) and **Alerts** at
http://localhost:9090/alerts.

---

## 5. Hitting the API

Write operations (`POST`/`PUT`/`DELETE`) require the header
`X-API-Key: <your API_KEY>`. Reads are public. The examples below use the
`API_KEY` from `.env.example` (`dev-local-api-key-change-me`).

**Create a task — returns `201`:**

```bash
curl -i -X POST http://localhost:3000/api/tasks \
  -H "X-API-Key: dev-local-api-key-change-me" \
  -H "Content-Type: application/json" \
  -d '{"title":"Read the README","status":"in_progress"}'
```

**Create without the key — returns `401 Unauthorized`:**

```bash
curl -i -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"This will be rejected"}'
```

**List tasks (public) — returns `200`, optional `?status=` filter:**

```bash
curl -s http://localhost:3000/api/tasks
curl -s "http://localhost:3000/api/tasks?status=in_progress"
```

Full endpoint map:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | – | Liveness/readiness + version |
| GET | `/metrics` | – | Prometheus metrics |
| GET | `/api/tasks` | – | List tasks (`?status=` filter) |
| GET | `/api/tasks/:id` | – | Get one task |
| POST | `/api/tasks` | ✅ | Create a task |
| PUT | `/api/tasks/:id` | ✅ | Update a task |
| DELETE | `/api/tasks/:id` | ✅ | Delete a task |

Valid `status` values: `todo`, `in_progress`, `done`.

---

## 6. Running tests locally

Tests run on your machine with Node 20+ (no Docker needed):

```bash
npm install
npm test                 # 27 tests (unit + integration)
npm run test:coverage    # same, with a coverage report
```

Expect **27 passing tests** across 5 suites and roughly **~96% statement
coverage**. `npm run lint` (ESLint) should also pass clean.

---

## 7. Jenkins CI/CD pipeline

This repo includes a `Jenkinsfile` with all 7 stages — Build, Test, Code Quality
(SonarQube), Security (Trivy), Deploy, Release, and Monitoring (Prometheus).

Setting up Jenkins, SonarQube, credentials, and running the pipeline is documented
separately in **[SETUP.md](SETUP.md)**. A per-stage breakdown is in
**[SUBMISSION.md](SUBMISSION.md)**.

---

## Tech stack

Node.js 20 · Express 4 · zod (validation) · prom-client (metrics) ·
Jest + Supertest (tests) · ESLint · multi-stage Docker (non-root) ·
Docker Compose · Jenkins · SonarQube · Trivy · Prometheus.

---

## Project layout

```
src/            Express app (routes → services → repository), config, metrics
test/           Jest unit + Supertest integration tests
prometheus/     Prometheus scrape config + alert rules, baked into a small image
                via prometheus/Dockerfile (no bind mounts — see note below)
jenkins/        Custom Jenkins controller image (see SETUP.md)
Dockerfile      Multi-stage build for the API image
docker-compose.yml   API + Prometheus staging stack
Jenkinsfile     7-stage CI/CD pipeline
```

> **Note:** the Prometheus config and alert rules are **baked into a custom image**
> (`prometheus/Dockerfile`) rather than bind-mounted, so the stack deploys
> identically whether `docker compose` runs on your machine or inside the Jenkins
> container (the daemon-vs-host path mismatch that breaks bind mounts is avoided).
> `docker compose up --build` builds it automatically; if you edit
> `prometheus/*.yml`, re-run with `--build` to pick up the change.
