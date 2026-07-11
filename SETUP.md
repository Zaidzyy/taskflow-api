# SETUP — Running the TaskFlow CI/CD Pipeline

This guide takes you from a fresh machine to a **full green run** of all 7 Jenkins
stages, then to submission. It assumes **Windows + Docker Desktop (WSL2 backend)**,
which is what the pipeline defaults are tuned for.

> **Networking model:** the pipeline runs Docker commands via the mounted docker
> socket, so the app/Prometheus/SonarQube containers all run on the **host** Docker
> daemon with published ports. The Jenkins agent reaches them via
> `host.docker.internal`, which resolves to the host on Docker Desktop/WSL2.
> (On native Linux, run the Jenkins container with
> `--add-host=host.docker.internal:host-gateway`.)

---

## 0. Prerequisites

- Docker Desktop (WSL2 backend) running
- Git + a GitHub account
- Ports free on the host: `8080` (Jenkins), `9000` (SonarQube), `3000` (app),
  `9090` (Prometheus), and optionally `5000` (local registry)

---

## 1. Push this project to GitHub

```bash
cd taskflow-api
git add .
git commit -m "Initial commit: TaskFlow API + 7-stage Jenkins pipeline"
git branch -M main
git remote add origin https://github.com/<your-username>/taskflow-api.git
git push -u origin main
```

---

## 2. Build & run the custom Jenkins controller

The image in `jenkins/Dockerfile` bakes in everything the pipeline needs
(docker CLI, Node 20, Trivy, sonar-scanner, plugins) so no tool has to be
installed at runtime.

### Windows / Docker Desktop (WSL2) — default path

On Docker Desktop the socket inside the container is owned by **root (GID 0)**, so
the `DOCKER_GID` group trick does **not** work — the Jenkins user ends up unable to
use the socket. The reliable path on Windows is to **run the Jenkins container as
`root`** (`-u root`) so it can talk to the mounted socket.

Run each command as a **single line** in PowerShell (PowerShell does not support
`\` line continuations):

```powershell
docker build -t taskflow-jenkins jenkins/
```

```powershell
docker run -d --name jenkins -u root -p 8080:8080 -p 50000:50000 -v jenkins_home:/var/jenkins_home -v //var/run/docker.sock:/var/run/docker.sock taskflow-jenkins
```

> The leading `//` in `//var/run/docker.sock` is intentional on Windows — it stops
> Git Bash / MSYS from rewriting the path. In PowerShell it is harmless.

Get the initial admin password and finish first-run setup at http://localhost:8080 :

```powershell
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Install **suggested plugins** (the pipeline-specific ones are already baked in).

> **Security note:** mounting the host Docker socket and running the agent as root
> gives the pipeline root-equivalent control of your host Docker daemon. That is an
> accepted trade-off for a trusted local dev pipeline — see the discussion in
> `SUBMISSION.md`.

### Linux — alternative (rootless-friendly)

On a native Linux host the socket is group-owned by the host `docker` group, so you
can grant access by matching that GID instead of running as root. Build with the
`DOCKER_GID` build-arg set to your host's docker group id:

```bash
# Find your host docker group id:
getent group docker | cut -d: -f3        # e.g. 999

docker build -t taskflow-jenkins --build-arg DOCKER_GID=<gid-from-above> jenkins/

docker run -d --name jenkins \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  taskflow-jenkins
```

Then get the admin password and install suggested plugins as above.

---

## 3. Run SonarQube (Code Quality stage)

```bash
docker run -d --name sonarqube -p 9000:9000 sonarqube:lts-community
```

1. Log in at http://localhost:9000 (default `admin` / `admin`, then change it).
2. Create a project **manually** with project key **`taskflow-api`**.
3. Generate a token: **My Account → Security → Generate Token**. Copy it.
4. Add a **webhook** so the Quality Gate stage gets a result:
   **Administration → Configuration → Webhooks → Create**
   - Name: `jenkins`
   - URL: `http://host.docker.internal:8080/sonarqube-webhook/`

---

## 4. (Optional) Local Docker registry (Release stage push)

```bash
docker run -d --name registry -p 5000:5000 registry:2
```

If this is **not** running, the Release stage still passes — it keeps the release
tags local and logs that no registry was found (documented behaviour, not a silent skip).

---

## 5. Add Jenkins credentials

**Manage Jenkins → Credentials → System → Global → Add Credentials**

| Kind          | ID                  | Value / notes                                             |
|---------------|---------------------|-----------------------------------------------------------|
| Secret text   | `sonar-token`       | The SonarQube token from step 3. **← plug in your token** |
| Secret text   | `taskflow-api-key`  | Any strong string, e.g. `staging-secret-123`. This becomes the app's `X-API-Key` in staging. |
| Username with password | `github-token` | **Optional.** Only needed if you set `PUSH_GIT_TAG=true` to publish the release tag to GitHub. Username = your GitHub username, password = a Personal Access Token with `repo` scope. |

> The `sonar-token` and `taskflow-api-key` IDs are referenced by name in the
> `Jenkinsfile`; if either is missing, the relevant stage **fails loudly** with a
> "credential not found" error rather than skipping. `github-token` is only read
> when `PUSH_GIT_TAG=true`, so you can skip it otherwise.

---

## 6. Register the SonarQube server in Jenkins

The Code Quality stage runs the scanner inside `withSonarQubeEnv('SonarQube')` so
the SonarQube Scanner plugin records the analysis task id — which the **Quality
Gate** stage needs. Register a SonarQube server whose **name matches exactly**:

**Manage Jenkins → System → SonarQube servers → Add SonarQube**
- **Name:** `SonarQube`  *(must match `withSonarQubeEnv('SonarQube')` exactly)*
- **Server URL:** `http://host.docker.internal:9000`
- **Server authentication token:** select the **`sonar-token`** credential (from step 5)

> Skip this (or misname the server) and the Quality Gate stage fails with
> *"No previous SonarQube analysis found on this pipeline execution."*
> The SonarQube Scanner for Jenkins plugin is already baked into the controller image.

---

## 7. Create the pipeline job

1. **New Item → Pipeline**, name it `taskflow-api`.
2. **Pipeline → Definition:** *Pipeline script from SCM*.
3. **SCM:** Git → your repo URL → branch `main`.
4. **Script Path:** `Jenkinsfile`.
5. Save.

---

## 8. Run it

Click **Build with Parameters** and accept the defaults:

| Parameter          | Default                              | When to change                          |
|--------------------|--------------------------------------|-----------------------------------------|
| `RUN_QUALITY_GATE` | `true`                               | Set `false` only if you skip the Sonar webhook in step 3. |
| `SONAR_HOST_URL`   | `http://host.docker.internal:9000`   | If SonarQube runs elsewhere.            |
| `PROMETHEUS_URL`   | `http://host.docker.internal:9090`   | If Prometheus is remapped.              |
| `APP_URL`          | `http://host.docker.internal:3000`   | If the app port is remapped.            |
| `PUSH_GIT_TAG`     | `false`                              | Set `true` to also push the release tag `v1.0.<build>` to GitHub (needs the `github-token` credential). Left local by default. |

**Expected result:** all 7 stages (plus Checkout + Quality Gate) go green, and the
`taskflow-api` + `taskflow-prometheus` containers stay up for the demo/screenshot.

---

## What plugs in where (placeholders summary)

| Placeholder / ID                | Where it lives            | You provide                              |
|---------------------------------|---------------------------|------------------------------------------|
| `sonar-token`                   | Jenkins credential        | SonarQube user token                     |
| `taskflow-api-key`              | Jenkins credential        | Any strong API key string                |
| `DOCKER_GID` build-arg          | `jenkins/` image build    | Host docker group id                     |
| `<your-username>` repo URL      | git remote / job SCM      | Your GitHub repo                          |
| Sonar webhook URL               | SonarQube admin           | `http://host.docker.internal:8080/sonarqube-webhook/` |
| `REGISTRY` (`localhost:5000`)   | `Jenkinsfile` env         | Only if pushing releases to a registry   |
| `github-token`                  | Jenkins credential        | Only if `PUSH_GIT_TAG=true` — GitHub username + PAT (`repo` scope) |

Nothing secret is committed to the repo — every credential is injected at runtime.

---

## Troubleshooting

- **`permission denied while trying to connect to the Docker daemon socket at
  unix:///var/run/docker.sock`** (Build stage, Windows/Docker Desktop) → the socket
  inside the container is owned by root, not the `docker` group, so the `DOCKER_GID`
  approach can't grant access. Confirm with:
  ```powershell
  docker exec jenkins stat -c '%g' /var/run/docker.sock   # prints 0 (root) on Docker Desktop
  ```
  Fix: recreate the Jenkins container with **`-u root`** (see the Windows path in
  step 2). On native Linux, use the `DOCKER_GID` alternative with the correct GID.
- **`fatal: not in a git directory`** at SCM checkout (after switching to `-u root`)
  → the existing workspace `.git` was created by the old `jenkins` user, and git now
  refuses it as an unsafe directory. Fix:
  ```powershell
  docker exec jenkins rm -rf /var/jenkins_home/workspace/taskflow-api
  docker exec jenkins git config --global --add safe.directory '*'
  ```
  Then re-run the build (a fresh checkout is created).
- **Quality Gate hangs then times out** → the Sonar webhook (step 3.4) is missing
  or points at the wrong URL. Fix the webhook, or set `RUN_QUALITY_GATE=false`.
- **Monitoring stage says target not up** → give Prometheus one scrape interval
  (~10s); the stage already retries for ~60s. Confirm the compose stack is up.
- **`host.docker.internal` not resolving (Linux)** → recreate the Jenkins
  container with `--add-host=host.docker.internal:host-gateway`.

---

## ✅ Final submission checklist (do NOT skip)

- [ ] **Grant repository access to BOTH your Marker AND the Unit Chair.**
      The task PDF is explicit: missing this **wastes your only feedback
      opportunity** (7.3HD allows just 2 submissions total). Add both as
      collaborators on the GitHub repo (or make it public and share the link).
- [ ] Run the pipeline until you get a **full green run of all 7 stages**.
- [ ] **Take the Jenkins pipeline screenshot** of that green run (Stage View
      showing all stages) and drop it into `SUBMISSION.md` where
      `[JENKINS PIPELINE SCREENSHOT]` is marked.
- [ ] **Record the ≤10 minute demo video** showing: cloning the repo, setting up
      the pipeline in Jenkins, the pipeline progressing through each stage, and
      the deployed app. Paste the link into `SUBMISSION.md`.
- [ ] Fill in `[DEMO VIDEO LINK]` and `[GITHUB REPO LINK]` in `SUBMISSION.md`.
- [ ] Export `SUBMISSION.md` to PDF and submit it.
