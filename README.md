# TaskFlow API

A small, production-style **Task Management REST API** (Node.js + Express) built to
demonstrate a complete **7-stage Jenkins CI/CD pipeline** for the SIT223/SIT753 HD task.

## What it does

A REST API for managing tasks with authentication, validation, persistence
(pluggable repository layer), health checks, and Prometheus metrics.

| Method | Endpoint          | Auth | Description                        |
|--------|-------------------|------|------------------------------------|
| GET    | `/health`         | –    | Liveness/readiness + version       |
| GET    | `/metrics`        | –    | Prometheus metrics                 |
| GET    | `/api/tasks`      | –    | List tasks (`?status=` filter)     |
| GET    | `/api/tasks/:id`  | –    | Get one task                       |
| POST   | `/api/tasks`      | ✅   | Create a task                      |
| PUT    | `/api/tasks/:id`  | ✅   | Update a task                      |
| DELETE | `/api/tasks/:id`  | ✅   | Delete a task                      |

Write operations require an `X-API-Key` header.

## Tech stack

- **Runtime:** Node.js 20, Express 4
- **Validation:** zod
- **Metrics:** prom-client (custom counters, histogram, gauge)
- **Tests:** Jest + Supertest (unit + integration, coverage)
- **Lint:** ESLint
- **Container:** multi-stage Docker (non-root runtime)
- **Orchestration:** Docker Compose (API + Prometheus)
- **CI/CD:** Jenkins declarative pipeline (`Jenkinsfile`)
- **Code quality:** SonarQube  |  **Security:** Trivy  |  **Monitoring:** Prometheus

## Run locally (without Jenkins)

```bash
npm install
npm run lint
npm run test:coverage     # 27 tests
npm start                 # http://localhost:3000/health
```

Or the full staging stack (API + Prometheus):

```bash
API_KEY=staging-key docker compose up -d --build
# API:        http://localhost:3000/health
# Prometheus: http://localhost:9090
```

## Pipeline

See **[SETUP.md](SETUP.md)** to run the Jenkins pipeline and
**[SUBMISSION.md](SUBMISSION.md)** for the per-stage breakdown.
