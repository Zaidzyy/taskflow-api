# SIT223/SIT753 — High Distinction Task: DevOps Pipeline with Jenkins

**Student:** Zaid
**Project:** TaskFlow API — a Task Management REST API with a full 7-stage Jenkins CI/CD pipeline

---

## Submission links

- **Demo video (≤10 min):** [DEMO VIDEO LINK]
- **GitHub repository:** [GITHUB REPO LINK]
  *(Access granted to both the Marker and the Unit Chair — see checklist in `SETUP.md`.)*

---

## 1. Project description & technology stack

**TaskFlow API** is a production-style REST API for managing tasks (create, read,
update, delete) with API-key authentication, request validation, health checks,
and Prometheus-instrumented metrics. It is intentionally structured in layers
(routes → services → repository) so it is modular, testable, and container-ready —
the qualities the rubric rewards for a "production-like project suitable for a full
pipeline."

| Concern         | Technology                                             |
|-----------------|--------------------------------------------------------|
| Language/runtime| Node.js 20, Express 4                                  |
| Validation      | zod schemas                                            |
| Observability   | prom-client (custom counter, histogram, gauge) + `/health` |
| Testing         | Jest + Supertest (27 tests: unit + integration, ~96% coverage) |
| Linting         | ESLint (`eslint:recommended`)                          |
| Containerization| Multi-stage Docker image, runs as non-root `node` user |
| Orchestration   | Docker Compose (API + Prometheus)                      |
| CI/CD           | Jenkins declarative pipeline (`Jenkinsfile`)           |
| Code quality    | SonarQube (sonar-scanner CLI)                          |
| Security        | Trivy (image scan + dependency/filesystem scan)        |
| Monitoring      | Prometheus (scrape config + 3 alerting rules)          |

**API surface:** `GET /health`, `GET /metrics`, and CRUD on `/api/tasks`
(writes require the `X-API-Key` header).

---

## 2. Stages implemented

**7 of 7 stages implemented** (targeting the Top HD band). One-line status:

| # | Stage         | Tool                          | Status                                   |
|---|---------------|-------------------------------|------------------------------------------|
| 1 | Build         | Docker (multi-stage)          | ✅ Tagged, versioned image artifact + saved tarball |
| 2 | Test          | Jest + Supertest + ESLint     | ✅ 27 tests, hard pass/fail gating       |
| 3 | Code Quality  | SonarQube                     | ✅ Scanner + blocking Quality Gate       |
| 4 | Security      | Trivy                         | ✅ Image + dependency scan, CRITICAL gate |
| 5 | Deploy        | Docker Compose                | ✅ Staging deploy + health verification  |
| 6 | Release       | Docker tagging + git tag      | ✅ Immutable promotion of tested image   |
| 7 | Monitoring    | Prometheus                    | ✅ Live scrape + alert-rule verification |

The pipeline also has a `Checkout` stage (computes the version/commit tag) and a
dedicated `Quality Gate` stage that blocks on the Sonar result.

---

## 3. Stage-by-stage description (as actually built)

### 1. Build — *Docker multi-stage image (the artifact)*
Runs `docker build` with `--build-arg APP_VERSION=1.0.<build>` and tags the image
`taskflow-api:1.0.<build>-<gitsha>` **and** `:latest`. The image is built in two
stages: a `build` stage that runs `npm ci` and prunes dev dependencies, and a slim
`node:20-alpine` runtime stage that runs as the non-root `node` user. The image
digest is recorded and the image is `docker save`-d to a gzipped tarball, which
Jenkins archives and fingerprints as the build artifact.

### 2. Test — *Jest + Supertest, with ESLint, gated*
Runs `npm ci`, then `npm run lint` (ESLint), then `npm run test:coverage`. The
suite is **27 tests**: unit tests for the repository, service, and zod schemas, and
Supertest integration tests that exercise the real Express app — auth (401 vs 201),
validation (400 with field details), status filtering, 404 handling, and the full
create→get→update→delete lifecycle. Any failing test or lint error returns a
non-zero exit code and **stops the pipeline**. The `lcov` coverage report is
archived and later fed to SonarQube.

### 3. Code Quality — *SonarQube*
Runs `sonar-scanner` (config in `sonar-project.properties`) against the `src`/`test`
trees, importing the Jest `coverage/lcov.info` so Sonar reports real coverage.
The Sonar token is injected from the Jenkins credential `sonar-token` (never
committed). A separate **Quality Gate** stage then calls `waitForQualityGate
abortPipeline: true` inside a 5-minute timeout, so a red gate **fails the build**.

### 4. Security — *Trivy (image + dependency scan)*
Three Trivy invocations: (a) `trivy image` on the freshly built image producing a
HIGH/CRITICAL table report, (b) `trivy fs --scanners vuln` scanning the source tree
and lockfile for vulnerable dependencies, and (c) a **gate**: `trivy image
--severity CRITICAL --exit-code 1 --ignorefile .trivyignore` that fails the build
on any unaccepted CRITICAL vulnerability. Accepted/justified exceptions are
documented in `.trivyignore` (each requires a written justification), demonstrating
"issues fixed, justified, or documented with mitigation." Both reports are archived.

### 5. Deploy (Staging) — *Docker Compose*
Runs `docker compose up -d --build`, bringing up the API alongside Prometheus on a
shared network. It injects the staging `API_KEY` from the Jenkins credential
`taskflow-api-key`. It then **polls `GET /health`** for up to ~60s; if the service
never becomes healthy it dumps the container logs and **fails the stage** — no
silent "assume it worked."

### 6. Release — *Docker tag promotion + versioned git tag*
Promotes the **exact tested image** (no rebuild, so released bits are byte-identical
to what passed Test/Security) by retagging it `:1.0.<build>` and `:release-latest`.
If a Docker registry is reachable at `REGISTRY`, it pushes the versioned tag;
otherwise it logs that it kept the tags local (documented, not silent). It writes
release notes as an archived artifact and creates an annotated git tag `v1.0.<build>`.

### 7. Monitoring & Alerting — *Prometheus*
Verifies monitoring is actually working, not just present: (a) confirms the app
exposes `http_requests_total` at `/metrics`, (b) queries the Prometheus API
(`up{job="taskflow-api"}`) and **fails if the target is not UP**, and (c) confirms
the alert rules (`TaskFlowApiDown`, `TaskFlowApiHighErrorRate`,
`TaskFlowApiHighLatency`) are loaded via `/api/v1/rules`. Prometheus scrapes the app
every 10s using `prometheus/prometheus.yml`; alert rules live in
`prometheus/alert.rules.yml` and cover availability, 5xx error rate, and p95 latency.

---

## 4. Jenkins pipeline screenshot

[JENKINS PIPELINE SCREENSHOT]

*(Insert the Stage View screenshot of a full green run of all 7 stages here.)*

---

## 5. Notes for the marker

- The pipeline **fails loudly** at every gate (tests, quality gate, CRITICAL vulns,
  health check, monitoring target) — it never skips a stage silently.
- All secrets are injected from Jenkins credentials at runtime; nothing sensitive is
  committed. Placeholder credential IDs and exactly what to plug in are documented in
  `SETUP.md`.
- End-to-end behaviour (image build, container health, `/health`, `/metrics`, auth,
  Prometheus scraping the app, and all three alert rules loading) was verified
  locally before submission.
